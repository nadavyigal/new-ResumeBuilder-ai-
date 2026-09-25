import { describe, it, expect, jest } from '@jest/globals';
import { manifest, MANIFEST_VERSION, type ManifestCase } from './manifest';
import { calibration } from './calibration';
import { EVALUATION_DATE, DATE_ONLY_FAKE_TIMERS } from './eval-date';
import { inputHash, configHash, type ConfigParts } from './fingerprint';
import { estimateBatch, estimateTokens } from './estimate';
import type { CallPhase, CallRecord } from './call-ledger';
import type { JudgeVerdict } from './judge';
import type { GroundingVerdict } from './judge-grounding';
import { JudgeInvalidError } from './judge-grounding';
import {
  planRuns,
  executePlan,
  accountRuns,
  buildStabilityReport,
  categorizeError,
  type ExecuteDeps,
  type PipelineOutcome,
  type RunResult,
} from './repeat';

const honest = calibration.find((x) => x.id === 'cal-01-honest-no-cloud-cert')!.resume;
const fabricated = calibration.find((x) => x.id === 'cal-02-credential-in-summary')!.resume;

function outcome(resume = honest, optimized = 60, recs = ['a', 'b']): PipelineOutcome {
  return {
    resume,
    scores: { original: 40, optimized, confidence: 0.8 },
    recommendationIds: recs,
    passesUsed: 2,
    lift: { meaningful: optimized - 40 >= 5, displayScores: optimized - 40 >= 5, delta: optimized - 40 },
  };
}

const passJudge: JudgeVerdict = { truthfulness: 5, atsAlignment: 4, clarity: 4, completeness: 4, overallPass: true, reason: 'ok' };

function passGrounding(c: ManifestCase): GroundingVerdict {
  return {
    requirements: c.requirements.map((r) => ({ id: r.id, ruling: r.support === 'not-evidenced' ? 'not-evidenced' : 'evidenced' })),
    unsupportedStatements: [],
    honestGapPreserved: true,
    honestGapQuote: '',
  };
}

/** A ledger stand-in that charges a fixed amount per generation. */
function fakeLedger(costPerRun = 0.05) {
  const records: CallRecord[] = [];
  let key: string | null = null;
  let phase: CallPhase | null = null;
  return {
    records,
    setContext(k: string | null, p: CallPhase | null) {
      key = k;
      phase = p;
      if (k && p === 'generation') {
        records.push({
          runKey: k,
          phase,
          endpoint: 'chat.completions',
          requestedModel: 'gpt-4o',
          returnedModel: 'gpt-4o-2024-08-06',
          status: 200,
          retryCount: 0,
          latencyMs: 1,
          usage: null,
          costUsd: costPerRun,
        });
      }
    },
    forRun: (k: string) => records.filter((r) => r.runKey === k),
    totalCostUsd: () => records.reduce((n, r) => n + (r.costUsd ?? 0), 0),
    get current() {
      return { key, phase };
    },
  };
}

function deps(overrides: Partial<ExecuteDeps> = {}): ExecuteDeps {
  return {
    cases: manifest,
    configHash: 'cfg',
    generate: async () => outcome(),
    nightlyJudge: async () => passJudge,
    groundingJudge: async (c) => passGrounding(c),
    ledger: fakeLedger(),
    costCapUsd: 100,
    projectedRunCostUsd: 0.1,
    now: () => 0,
    ...overrides,
  };
}

describe('repeat plan and accounting (offline)', () => {
  it('plans 60 runs, run-major, with one input hash per case', () => {
    const plan = planRuns(manifest, 3);
    expect(plan).toHaveLength(60);
    expect(new Set(plan.map((p) => p.key)).size).toBe(60);
    expect(plan.slice(0, 20).every((p) => p.runIndex === 1)).toBe(true);
    for (const c of manifest) {
      const hashes = new Set(plan.filter((p) => p.caseId === c.id).map((p) => p.inputHash));
      expect(hashes.size).toBe(1);
    }
  });

  it('accounts for all 60 runs when everything completes', async () => {
    const plan = planRuns(manifest, 3);
    const results = await executePlan(plan, deps());
    const acc = accountRuns(plan, results);
    expect(acc).toMatchObject({ planned: 60, recorded: 60, complete: true, missing: [], duplicates: [] });
    expect(acc.byStatus.completed).toBe(60);
  });

  it('records a generation error as a run, not a gap', async () => {
    const plan = planRuns(manifest, 3);
    const results = await executePlan(
      plan,
      deps({
        generate: async (c) => {
          if (c.id === 'fit-icu-nurse') throw Object.assign(new Error('Request timed out.'), { status: 408 });
          return outcome();
        },
      })
    );
    const failed = results.filter((r) => r.caseId === 'fit-icu-nurse');
    expect(failed.map((r) => [r.status, r.verdict, r.errorCategory])).toEqual([
      ['generation-error', 'error', 'timeout'],
      ['generation-error', 'error', 'timeout'],
      ['generation-error', 'error', 'timeout'],
    ]);
    expect(accountRuns(plan, results).complete).toBe(true);
  });

  it('counts an invalid judge answer as a failed evaluation, never a pass', async () => {
    const plan = planRuns(manifest.slice(0, 1), 1);
    const [r] = await executePlan(
      plan,
      deps({
        groundingJudge: async () => {
          throw new JudgeInvalidError('grounding judge returned non-JSON');
        },
      })
    );
    expect(r.status).toBe('judge-invalid');
    expect(r.verdict).toBe('fail');
    expect(r.components?.groundingJudge).toBeNull();
  });

  it('keeps an uncited or unverifiable judge concern as a lead, and passes the run', async () => {
    const plan = planRuns(manifest.slice(0, 1), 1);
    const [r] = await executePlan(
      plan,
      deps({
        groundingJudge: async (c) => ({
          ...passGrounding(c),
          honestGapPreserved: false,
          honestGapQuote: '',
          unsupportedStatements: [{ quote: 'text the rewrite does not contain', category: 'forbidden-claim' }],
        }),
      })
    );
    expect(r.verdict).toBe('pass');
    expect(r.groundingJudgeFindings).toMatchObject({ uncitedGapConcern: true, verified: [], pass: true });
    expect(r.groundingJudgeFindings?.unverified).toHaveLength(1);
  });

  it('fails a run whose output carries a fabricated credential', async () => {
    const plan = planRuns(manifest.slice(0, 1), 1);
    const [r] = await executePlan(plan, deps({ generate: async () => outcome(fabricated) }));
    expect(r.verdict).toBe('fail');
    expect(r.components?.deterministic).toBe(false);
    expect(r.failureReasons.some((f) => f.startsWith('grounding:credential'))).toBe(true);
  });

  it('stops after three identical failures and records the rest as skipped', async () => {
    const plan = planRuns(manifest, 3);
    const results = await executePlan(
      plan,
      deps({
        generate: async () => {
          throw new Error('OPENAI_API_KEY environment variable is not set');
        },
      })
    );
    expect(results.slice(0, 3).map((r) => r.status)).toEqual(['generation-error', 'generation-error', 'generation-error']);
    expect(results.slice(3).every((r) => r.status === 'skipped-repeated-failure')).toBe(true);
    expect(accountRuns(plan, results)).toMatchObject({ recorded: 60, complete: true });
  });

  it('stops before a run that would cross the cost cap, and records the rest', async () => {
    const plan = planRuns(manifest, 3);
    const ledger = fakeLedger(1);
    const results = await executePlan(plan, deps({ ledger, costCapUsd: 5.5, projectedRunCostUsd: 1 }));
    // $1 per run, $1 projected: runs 1 to 5 fit under $5.50, run 6 would not.
    expect(results.filter((r) => r.status === 'completed')).toHaveLength(5);
    expect(results.filter((r) => r.status === 'skipped-cost-cap')).toHaveLength(55);
    expect(ledger.totalCostUsd()).toBeLessThanOrEqual(5.5);
    expect(accountRuns(plan, results).complete).toBe(true);
  });

  it('notices a missing, duplicated or unplanned result', () => {
    const plan = planRuns(manifest.slice(0, 2), 2);
    const base = (key: string): RunResult => ({
      key,
      caseId: key.split('#')[0],
      runIndex: 1,
      inputHash: 'x',
      configHash: 'cfg',
      status: 'completed',
      verdict: 'pass',
      failureReasons: [],
    });
    const results = [base(plan[0].key), base(plan[0].key), base(plan[1].key), base('ghost#9')];
    const acc = accountRuns(plan, results);
    expect(acc.complete).toBe(false);
    expect(acc.missing.sort()).toEqual([plan[2].key, plan[3].key].sort());
    expect(acc.duplicates).toEqual([plan[0].key]);
    expect(acc.unexpected).toEqual(['ghost#9']);
  });

  it('classifies errors into stable categories', () => {
    expect(categorizeError(new Error('eval transport retry cap reached'))).toBe('transport-retry-cap');
    expect(categorizeError(new Error('eval hard cost cap reached'))).toBe('cost-cap');
    expect(categorizeError(new Error('eval harness blocked an outbound request to x'))).toBe('side-effect-blocked');
    expect(categorizeError(Object.assign(new Error('slow down'), { status: 429 }))).toBe('rate-limit');
    expect(categorizeError(new SyntaxError('Unexpected token'))).toBe('invalid-output');
  });
});

describe('stability report (offline)', () => {
  it('shows a rerun flip, a score range and changed recommendations', async () => {
    const plan = planRuns(manifest, 3);
    // The stand-in generator returns the honest no-cloud-cert résumé for every case,
    // so only that case passes cleanly; the others fail the same way every run.
    const flipping = 'no-cloud-cert';
    const results = await executePlan(plan, deps());
    // Make the second run of one case fail, and move its score and recommendations.
    const target = results.find((r) => r.caseId === flipping && r.runIndex === 2)!;
    target.verdict = 'fail';
    target.scores = { original: 40, optimized: 72, confidence: 0.8 };
    target.recommendationIds = ['a', 'c'];

    const report = buildStabilityReport(manifest, plan, results, {
      manifestVersion: MANIFEST_VERSION,
      evaluationDate: EVALUATION_DATE,
      repeats: 3,
      config: null,
      wallTimeMs: 10,
      ledgerRecords: [],
      blockedSideEffects: 0,
    });
    expect(report.verdictFlipCount).toBe(1);
    expect(report.casesWithVerdictFlips).toEqual([flipping]);
    const c = report.cases.find((x) => x.caseId === flipping)!;
    expect(c.verdicts).toEqual(['pass', 'fail', 'pass']);
    expect(c.optimizedScore).toMatchObject({ min: 60, max: 72, range: 12 });
    expect(c.recommendations).toEqual({ stable: ['a'], changed: ['b', 'c'] });
    expect(c.identicalInputHash).toBe(true);
    expect(c.identicalConfigHash).toBe(true);
    expect(report.accounting.complete).toBe(true);
    expect(report.notes.join(' ')).toMatch(/not proof of stability/);
  });

  it('totals what the job-ad terms guard did across runs', async () => {
    const plan = planRuns(manifest.slice(0, 2), 2);
    const guard = {
      checkedTerms: 2, unsupportedBefore: ['Salesforce'], lostBefore: [], retried: true,
      retryReason: 'unsupported_job_ad_terms' as const, repairAccepted: false,
      removedTerms: ['Salesforce'], restoredTerms: [], unresolvedTerms: [],
    };
    const results = await executePlan(plan, deps({ generate: async () => ({ ...outcome(), truthGuard: guard }) }));
    const report = buildStabilityReport(manifest.slice(0, 2), plan, results, {
      manifestVersion: MANIFEST_VERSION, evaluationDate: EVALUATION_DATE, repeats: 2, config: null,
      wallTimeMs: null, ledgerRecords: [], blockedSideEffects: 0,
    });
    expect(report.totals.truthGuard).toEqual({ runsRetried: 4, repairsAccepted: 0, termsRemoved: 4, termsRestored: 0, termsUnresolved: 0 });
  });

  it('flags a regression against a baseline, and refuses to compare a changed input', async () => {
    const plan = planRuns(manifest, 3);
    const meta = {
      manifestVersion: MANIFEST_VERSION,
      evaluationDate: EVALUATION_DATE,
      repeats: 3,
      config: null,
      wallTimeMs: null,
      ledgerRecords: [],
      blockedSideEffects: 0,
    };
    const baseline = buildStabilityReport(manifest, plan, await executePlan(plan, deps()), meta);
    baseline.cases.find((c) => c.caseId === 'fit-saas-account-exec')!.inputHash = 'older-input';

    const current = await executePlan(plan, deps({ generate: async (c) => outcome(c.id === 'no-cloud-cert' ? fabricated : honest, 50) }));
    const report = buildStabilityReport(manifest, plan, current, meta, baseline);
    expect(report.regressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ caseId: 'no-cloud-cert', kind: 'pass-rate-dropped' }),
        expect.objectContaining({ caseId: 'no-cloud-cert', kind: 'median-score-dropped' }),
        expect.objectContaining({ caseId: 'fit-saas-account-exec', kind: 'not-comparable' }),
      ])
    );
  });
});

describe('fingerprints, fixed date and estimate (offline)', () => {
  it('hashes identical inputs identically, and any change differently', () => {
    const c = manifest[0];
    expect(inputHash(c, EVALUATION_DATE)).toBe(inputHash({ ...c }, EVALUATION_DATE));
    expect(inputHash(c, EVALUATION_DATE)).not.toBe(inputHash(c, '2026-10-01'));
    expect(inputHash(c, EVALUATION_DATE)).not.toBe(inputHash({ ...c, jobDescription: `${c.jobDescription} ` }, EVALUATION_DATE));
  });

  it('hashes config independent of key order but sensitive to any value', () => {
    const parts: ConfigParts = {
      promptSourceHash: 'p',
      pipelineSourceHash: 'q',
      scorerSourceHash: 's',
      scoreVersion: 'v',
      optimizationModel: 'gpt-4o',
      temperature: 0.35,
      maxTokens: 4000,
      nightlyJudge: 'n',
      groundingJudge: 'g',
      harnessVersion: 'h',
    };
    const reordered = Object.fromEntries(Object.entries(parts).reverse()) as unknown as ConfigParts;
    expect(configHash(reordered)).toBe(configHash(parts));
    expect(configHash({ ...parts, temperature: 0.4 })).not.toBe(configHash(parts));
  });

  it('pins Date to the evaluation date while real timers keep running', async () => {
    jest.useFakeTimers(DATE_ONLY_FAKE_TIMERS as unknown as Parameters<typeof jest.useFakeTimers>[0]);
    try {
      expect(new Date().toISOString().slice(0, 10)).toBe(EVALUATION_DATE);
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(new Date().toISOString().slice(0, 10)).toBe(EVALUATION_DATE);
    } finally {
      jest.useRealTimers();
    }
  });

  it('estimates the 60-run batch from the real prompts, with a cap below the theoretical worst', () => {
    const e = estimateBatch(manifest, 3, calibration.length);
    expect(e.runs).toBe(60);
    expect(e.typicalUsd).toBeGreaterThan(0);
    expect(e.worstUsd).toBeGreaterThan(e.typicalUsd);
    expect(e.recommendedCapUsd).toBeGreaterThanOrEqual(Math.ceil(e.typicalUsd));
    expect(e.recommendedCapUsd).toBeLessThanOrEqual(Math.ceil(e.worstUsd + e.calibrationUsd));
    expect(estimateTokens('שלום עולם')).toBeGreaterThan(estimateTokens('hello wor'));
  });
});
