/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from '@jest/globals';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPTIMIZATION_CONFIG } from '@/lib/prompts/resume-optimizer';
import { SCORE_VERSION } from '@/lib/ats/core';
import { clearCache as clearEmbeddingsCache } from '@/lib/ats/utils/embeddings';
import { manifest, MANIFEST_VERSION } from './manifest';
import { calibration } from './calibration';
import { EVALUATION_DATE, DATE_ONLY_FAKE_TIMERS } from './eval-date';
import { estimateBatch } from './estimate';
import { CallLedger, summarizeCalls } from './call-ledger';
import { buildConfigFingerprint, hashSources, HARNESS_VERSION } from './fingerprint';
import { planRuns, executePlan, buildStabilityReport, type StabilityReport } from './repeat';
import { runPipelineForEval } from './generate';
import { judgeResume } from './judge';
import { judgeGrounding, GROUNDING_JUDGE_MODEL, GROUNDING_JUDGE_VERSION } from './judge-grounding';

// Paid repeat eval. Skipped unless RUN_REPEAT_EVAL=1 AND a positive EVAL_COST_CAP_USD
// are set, so `npm test` never spends money. Run through the wrapper:
//   EVAL_COST_CAP_USD=<approved cap> npm run eval:resume:repeat
// Estimate only (no API key, no spend):
//   npm run eval:resume:estimate

const REPEAT = process.env.RUN_REPEAT_EVAL === '1';
const ESTIMATE = process.env.EVAL_ESTIMATE === '1';
const REPEATS = Number(process.env.EVAL_REPEATS ?? 3);
const CAP = Number(process.env.EVAL_COST_CAP_USD);
const CALIBRATE = process.env.EVAL_CALIBRATE !== '0';
const BASELINE = process.env.EVAL_BASELINE;

const OUTPUT_ROOT = join(process.cwd(), 'evals', 'resume-optimizer', 'output');

(ESTIMATE ? describe : describe.skip)('resume-optimizer repeat eval: cost estimate (free)', () => {
  it('estimates the batch from the real prompts', () => {
    const estimate = estimateBatch(manifest, REPEATS, calibration.length);
    mkdirSync(OUTPUT_ROOT, { recursive: true });
    writeFileSync(join(OUTPUT_ROOT, 'estimate.json'), JSON.stringify(estimate, null, 2));
    console.log(
      `[repeat-eval estimate] runs=${estimate.runs} model=${estimate.generationModel} ` +
        `typical=$${estimate.typicalUsd.toFixed(2)} worst=$${estimate.worstUsd.toFixed(2)} ` +
        `calibration=$${estimate.calibrationUsd.toFixed(3)} recommendedCap=$${estimate.recommendedCapUsd} ` +
        `(prices checked ${estimate.pricesCheckedOn})`
    );
    expect(estimate.runs).toBe(manifest.length * REPEATS);
  });
});

(REPEAT ? describe : describe.skip)('resume-optimizer repeat eval (paid)', () => {
  it(
    'runs every planned case N times and accounts for every run',
    async () => {
      if (!Number.isFinite(CAP) || CAP <= 0) {
        throw new Error('EVAL_COST_CAP_USD must be a positive number. Run `npm run eval:resume:estimate` first.');
      }
      // Belt and braces with the wrapper script: no analytics key, so the pipeline's
      // PostHog tracing is a no-op, and the ledger blocks any other outbound host.
      process.env.POSTHOG_API_KEY = '';
      process.env.NEXT_PUBLIC_POSTHOG_KEY = '';

      const realStart = new Date().toISOString();
      const wallStart = performance.now();
      const outDir = join(OUTPUT_ROOT, `repeat-${realStart.replace(/[:.]/g, '-')}`);
      mkdirSync(outDir, { recursive: true });

      jest.useFakeTimers(DATE_ONLY_FAKE_TIMERS as unknown as Parameters<typeof jest.useFakeTimers>[0]);
      expect(new Date().toISOString().slice(0, 10)).toBe(EVALUATION_DATE);

      const ledger = new CallLedger({ maxTransportRetries: 1, hardCapUsd: CAP });
      const restoreFetch = ledger.install(globalThis as unknown as { fetch: (input: any, init?: any) => Promise<Response> });

      try {
        const root = process.cwd();
        const config = buildConfigFingerprint(root, {
          scoreVersion: SCORE_VERSION,
          optimizationModel: OPTIMIZATION_CONFIG.model,
          temperature: OPTIMIZATION_CONFIG.temperature,
          maxTokens: OPTIMIZATION_CONFIG.maxTokens,
          nightlyJudge: `gpt-4o-mini:${hashSources(root, ['evals/resume-optimizer/judge.ts']).slice(0, 12)}`,
          groundingJudge: `${GROUNDING_JUDGE_MODEL}:${GROUNDING_JUDGE_VERSION}:${hashSources(root, ['evals/resume-optimizer/judge-grounding.ts']).slice(0, 12)}`,
          harnessVersion: `${HARNESS_VERSION}:${hashSources(root, [
            'evals/resume-optimizer/checks.ts',
            'evals/resume-optimizer/grounding.ts',
            'evals/resume-optimizer/repeat.ts',
            'evals/resume-optimizer/call-ledger.ts',
          ]).slice(0, 12)}`,
        });
        const estimate = estimateBatch(manifest, REPEATS, calibration.length);
        writeFileSync(join(outDir, 'config.json'), JSON.stringify({ config, estimate, capUsd: CAP, realStart }, null, 2));

        // Judge calibration first: cheap, and it says how far to trust the judges below.
        const calibrationResults: Array<Record<string, unknown>> = [];
        if (CALIBRATE) {
          for (const item of calibration) {
            const c = manifest.find((m) => m.id === item.caseId)!;
            ledger.setContext(`calibration:${item.id}`, 'calibration');
            const row: Record<string, unknown> = { id: item.id, expected: item.expected };
            try {
              const v = await judgeResume(c, item.resume);
              row.nightlyJudge = v.overallPass && v.truthfulness >= 4 ? 'pass' : 'fail';
            } catch (error) {
              row.nightlyJudge = `invalid: ${(error as Error).message.slice(0, 120)}`;
            }
            try {
              const g = await judgeGrounding(c, item.resume);
              const pass =
                g.honestGapPreserved &&
                g.unsupportedStatements.length === 0 &&
                g.requirements.every((r) => r.ruling !== 'claimed-without-support');
              row.groundingJudge = pass ? 'pass' : 'fail';
            } catch (error) {
              row.groundingJudge = `invalid: ${(error as Error).message.slice(0, 120)}`;
            }
            calibrationResults.push(row);
          }
          ledger.setContext(null, null);
          writeFileSync(join(outDir, 'calibration.json'), JSON.stringify(calibrationResults, null, 2));
        }

        const plan = planRuns(manifest, REPEATS);
        writeFileSync(join(outDir, 'plan.json'), JSON.stringify(plan, null, 2));

        const results = await executePlan(plan, {
          cases: manifest,
          configHash: config.configHash,
          generate: runPipelineForEval,
          nightlyJudge: judgeResume,
          groundingJudge: judgeGrounding,
          ledger,
          costCapUsd: CAP,
          projectedRunCostUsd: estimate.maxWorstRunUsd,
          beforeRun: () => clearEmbeddingsCache(),
          onRunComplete: (r) => {
            appendFileSync(join(outDir, 'runs.jsonl'), `${JSON.stringify(r)}\n`);
            console.log(
              `[repeat-eval] ${r.key} status=${r.status} verdict=${r.verdict} ` +
                `score=${r.scores?.optimized ?? '-'} cost=$${(r.calls?.costUsd ?? 0).toFixed(4)} ` +
                `spent=$${ledger.totalCostUsd().toFixed(3)}`
            );
          },
        });

        const baseline: StabilityReport | undefined =
          BASELINE && existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : undefined;
        const report = buildStabilityReport(
          manifest,
          plan,
          results,
          {
            manifestVersion: MANIFEST_VERSION,
            evaluationDate: EVALUATION_DATE,
            repeats: REPEATS,
            config,
            wallTimeMs: performance.now() - wallStart,
            ledgerRecords: ledger.records,
            blockedSideEffects: ledger.blocked.length,
          },
          baseline
        );

        writeFileSync(join(outDir, 'report.json'), JSON.stringify({ ...report, calibration: calibrationResults }, null, 2));
        writeFileSync(join(outDir, 'ledger.json'), JSON.stringify({ records: ledger.records, blocked: ledger.blocked, summary: summarizeCalls(ledger.records) }, null, 2));

        console.log(
          `[repeat-eval] planned=${report.accounting.planned} recorded=${report.accounting.recorded} ` +
            `complete=${report.accounting.complete} flips=${report.verdictFlipCount} ` +
            `cost=$${report.totals.costUsd.toFixed(3)} blockedSideEffects=${report.totals.blockedSideEffects} out=${outDir}`
        );

        // The gate for this harness is accounting and isolation, not quality: flips and
        // failures are findings to read, and must never silently disappear.
        expect(report.accounting.missing).toEqual([]);
        expect(report.accounting.complete).toBe(true);
        expect(report.totals.blockedSideEffects).toBe(0);
        expect(report.cases.every((c) => c.identicalInputHash && c.identicalConfigHash)).toBe(true);
      } finally {
        restoreFetch();
        jest.useRealTimers();
      }
    },
    3 * 60 * 60 * 1000
  );
});
