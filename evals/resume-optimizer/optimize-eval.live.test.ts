/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cases } from './cases';
import { generateResumeForEval } from './generate';
import { judgeResume } from './judge';
import { runChecks, criticalFailures } from './checks';

// Live eval (paid). Skipped unless RUN_LIVE_EVAL=1 so normal `npm test` and CI
// stay free. Run with: `npm run eval:resume` (or the nightly GitHub Action).
//
// Gate:
//   - ZERO fabrication-critical deterministic failures across the golden set, AND
//   - LM-judge pass rate >= JUDGE_PASS_THRESHOLD.

const LIVE = process.env.RUN_LIVE_EVAL === '1';
const JUDGE_PASS_THRESHOLD = 0.85;
const describeOrSkip = LIVE ? describe : describe.skip;

describeOrSkip('resume-optimizer live eval', () => {
  it(
    'meets factual-accuracy and quality gates across the golden set',
    async () => {
      const report: Array<Record<string, unknown>> = [];

      for (const c of cases) {
        const gen = await generateResumeForEval(c);
        const checks = runChecks(gen.resume, c);
        const crit = criticalFailures(checks);
        const verdict = await judgeResume(c, gen.resume);
        report.push({
          id: c.id,
          description: c.description,
          honestGap: c.honestGap,
          passesUsed: gen.passesUsed,
          criticalFailures: crit.map((x) => `${x.id}: ${x.detail}`),
          checks,
          verdict,
          resume: gen.resume,
        });
      }

      const dir = join(process.cwd(), 'evals', 'resume-optimizer');
      mkdirSync(dir, { recursive: true });

      const judgePassCount = report.filter(
        (r) =>
          (r.verdict as { overallPass: boolean; truthfulness: number }).overallPass &&
          (r.verdict as { truthfulness: number }).truthfulness >= 4
      ).length;
      const judgePassRate = judgePassCount / report.length;
      const criticalCases = report.filter((r) => (r.criticalFailures as string[]).length > 0);

      writeFileSync(
        join(dir, 'report.json'),
        JSON.stringify(
          {
            feature: 'resume-optimizer',
            caseCount: report.length,
            judgePassRate: Number(judgePassRate.toFixed(3)),
            judgePassThreshold: JUDGE_PASS_THRESHOLD,
            criticalFailureCases: criticalCases.map((r) => r.id),
            cases: report,
          },
          null,
          2
        )
      );

      console.log(
        `[resume-eval] cases=${report.length} judgePassRate=${(judgePassRate * 100).toFixed(0)}% criticalFailureCases=${criticalCases.length}`
      );
      for (const r of criticalCases) {
        console.log(`  CRITICAL ${r.id}: ${(r.criticalFailures as string[]).join('; ')}`);
      }

      expect(criticalCases.map((r) => r.id)).toEqual([]);
      expect(judgePassRate).toBeGreaterThanOrEqual(JUDGE_PASS_THRESHOLD);
    },
    600000
  );
});
