/**
 * Content-rule report for a repeat-eval run directory (free, no model calls).
 *
 *   npx tsx scripts/eval/content-report.ts evals/resume-optimizer/output/repeat-<ts>
 *
 * Reads runs.jsonl, runs evals/resume-optimizer/content-rules.ts on every
 * tailored resume against its case, and writes content-report.json next to it.
 * Expected language follows the product rule (Hebrew if either text has a
 * Hebrew letter).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTailoredResume, type ContentFinding } from '../../evals/resume-optimizer/content-rules';
import { selectEvalCases } from '../../evals/resume-optimizer/manifest-prompt-upgrade';

const dir = process.argv[2];
if (!dir) throw new Error('usage: content-report.ts <run dir>');

const cases = new Map(selectEvalCases({ EVAL_CASE_SET: 'prompt-upgrade' }).map((c) => [c.id, c]));
const runs = readFileSync(join(dir, 'runs.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { key: string; caseId: string; status: string; verdict: string; resume?: unknown });

const rows = runs.map((r) => {
  const c = cases.get(r.caseId);
  if (!c || !r.resume) return { key: r.key, caseId: r.caseId, verdict: r.verdict, checked: false, findings: [] as ContentFinding[] };
  const lang = /[֐-׿]/.test(c.resumeText) || /[֐-׿]/.test(c.jobDescription) ? 'he' : 'en';
  const out = checkTailoredResume(r.resume as never, c.resumeText, lang);
  return { key: r.key, caseId: r.caseId, verdict: r.verdict, checked: true, expectedLanguage: lang, languageRatio: out.languageRatio, findings: out.findings };
});

const count = (sev: string) => rows.reduce((n, r) => n + r.findings.filter((f) => f.severity === sev).length, 0);
const checked = rows.filter((r) => r.checked);
const summary = {
  runs: rows.length,
  checked: checked.length,
  critical: count('critical'),
  high: count('high'),
  warnings: count('warning'),
  languageMatch: `${checked.filter((r) => (r as { languageRatio?: number }).languageRatio! >= 0.85).length}/${checked.length}`,
  byCheck: rows
    .flatMap((r) => r.findings)
    .reduce<Record<string, number>>((acc, f) => ({ ...acc, [`${f.check}:${f.severity}`]: (acc[`${f.check}:${f.severity}`] ?? 0) + 1 }), {}),
};
writeFileSync(join(dir, 'content-report.json'), JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
for (const r of rows) {
  const notable = r.findings.filter((f) => f.severity !== 'warning');
  if (notable.length) console.log(`${r.key}: ${notable.map((f) => `${f.check}(${f.detail})`).join(', ')}`);
}
