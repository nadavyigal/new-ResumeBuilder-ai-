/**
 * @jest-environment node
 *
 * Re-judge a finished repeat run with another judge model, on the SAME outputs,
 * so a judge change is measured apart from generation variance. Also runs the
 * calibration set (planted fabrications) with that judge. Paid; skipped unless
 * RUN_REJUDGE=1.
 *
 *   RUN_REJUDGE=1 EVAL_REJUDGE_DIR=evals/resume-optimizer/output/repeat-<ts> \
 *     EVAL_REJUDGE_MODEL=gpt-4o-mini npx jest evals/resume-optimizer/rejudge.live.test.ts --runInBand
 *
 * Writes rejudge-<model>.json next to the run, and prints agreement with the
 * judge the run used.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { manifest } from './manifest';
import { calibration } from './calibration';
import { judgeResume } from './judge';
import { judgeGrounding, groundingFindings } from './judge-grounding';

const LIVE = process.env.RUN_REJUDGE === '1';
const DIR = process.env.EVAL_REJUDGE_DIR ?? '';
const MODEL = process.env.EVAL_REJUDGE_MODEL?.trim() || 'gpt-4o-mini';

interface RunRow {
  key: string;
  caseId: string;
  status: string;
  resume?: OptimizedResume;
  components?: { nightlyJudge: boolean | null; groundingJudge: boolean | null };
}

(LIVE ? describe : describe.skip)(`rejudge with ${MODEL}`, () => {
  it(
    're-judges every completed run and the calibration set',
    async () => {
      expect(DIR).not.toBe('');
      const runs: RunRow[] = readFileSync(join(DIR, 'runs.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));

      const rows: Array<Record<string, unknown>> = [];
      let nightlyAgree = 0;
      let groundingAgree = 0;
      let compared = 0;
      for (const run of runs) {
        if (run.status !== 'completed' || !run.resume || !run.components) continue;
        const c = manifest.find((m) => m.id === run.caseId);
        if (!c) continue;
        const v = await judgeResume(c, run.resume, MODEL);
        const nightly = v.overallPass && v.truthfulness >= 4;
        const findings = groundingFindings(await judgeGrounding(c, run.resume, MODEL), run.resume);
        compared += 1;
        if (nightly === run.components.nightlyJudge) nightlyAgree += 1;
        if (findings.pass === run.components.groundingJudge) groundingAgree += 1;
        rows.push({
          key: run.key,
          caseId: run.caseId,
          original: run.components,
          rejudged: { nightlyJudge: nightly, groundingJudge: findings.pass },
          nightlyReason: v.reason,
          groundingFindings: findings,
        });
      }

      const cal: Array<Record<string, unknown>> = [];
      for (const item of calibration) {
        const c = manifest.find((m) => m.id === item.caseId)!;
        const v = await judgeResume(c, item.resume, MODEL);
        const g = groundingFindings(await judgeGrounding(c, item.resume, MODEL), item.resume);
        cal.push({
          id: item.id,
          expected: item.expected,
          nightlyJudge: v.overallPass && v.truthfulness >= 4 ? 'pass' : 'fail',
          groundingJudge: g.pass ? 'pass' : 'fail',
        });
      }
      const calOk = (k: string) => cal.filter((r) => r[k] === r.expected).length;
      const missed = cal.filter((r) => r.expected === 'fail' && r.groundingJudge === 'pass' && r.nightlyJudge === 'pass').map((r) => r.id);

      const summary = {
        model: MODEL,
        compared,
        nightlyAgreement: `${nightlyAgree}/${compared}`,
        groundingAgreement: `${groundingAgree}/${compared}`,
        nightlyPass: rows.filter((r) => (r.rejudged as { nightlyJudge: boolean }).nightlyJudge).length,
        groundingPass: rows.filter((r) => (r.rejudged as { groundingJudge: boolean }).groundingJudge).length,
        calibrationNightly: `${calOk('nightlyJudge')}/${cal.length}`,
        calibrationGrounding: `${calOk('groundingJudge')}/${cal.length}`,
        fabricationsMissedByBothJudges: missed,
      };
      writeFileSync(join(DIR, `rejudge-${MODEL}.json`), JSON.stringify({ summary, rows, calibration: cal }, null, 2));
      console.log(`[rejudge] ${JSON.stringify(summary)}`);
      expect(compared).toBeGreaterThan(0);
    },
    1_800_000
  );
});
