/**
 * Expert-mode and quick-wins mini eval for the 2026-11-24 prompt upgrade (paid).
 *
 *   EVAL_ENV_FILE=<path to .env.local> EVAL_COST_CAP_USD=1.5 \
 *   OPENAI_MODEL_WRITER=gpt-6.1-terra OPENAI_MODEL_FAST=gpt-6-luna \
 *   npx tsx scripts/eval/expert-mini.ts <outDir>
 *
 * Runs the real prompt builders through the orchestrator's validate-and-retry
 * loop: full rewrite (3 cases x 3 runs, latency vs the 30 s workflow timeout),
 * cover letters (3 cases x 2 runs, incl. the Hebrew HE-6 case) and quick wins
 * (3 cases x 2 runs). Every call goes through CallLedger, which enforces the cost
 * cap and blocks non-model hosts. Writes <outDir>/expert-mini.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

if (process.env.EVAL_ENV_FILE) dotenv.config({ path: process.env.EVAL_ENV_FILE });
process.env.POSTHOG_API_KEY = '';
process.env.NEXT_PUBLIC_POSTHOG_KEY = '';

type Ctx = import('../../src/lib/expert-workflows/types').ExpertWorkflowContext;

const HE6 = {
  id: 'he-cover-letter-promises',
  resumeText: `רוני אברהם
roni.avraham@example.com | 050-0000006 | תל אביב

תקציר
רכזת שיווק דיגיטלי עם שנתיים ניסיון בניהול קמפיינים ברשתות חברתיות.

ניסיון
רכזת שיווק, סטודיו פיקסל בע"מ — יוני 2023 עד היום
- ניהלתי קמפיינים ממומנים בפייסבוק ובאינסטגרם.
- כתבתי תוכן לניוזלטר החודשי שנשלח ל-5,000 מנויים.

השכלה
B.A. בתקשורת, המכללה האקדמית ספיר — 2023`,
  jobDescription: `דרוש/ה מנהל/ת שיווק דיגיטלי ג'וניור לחברת קוסמטיקה.
דרישות: ניסיון בקמפיינים ממומנים, Google Ads, כתיבת תוכן.`,
  title: 'מנהל/ת שיווק דיגיטלי ג׳וניור',
  company: 'חברת קוסמטיקה',
};

const PROMISE = /מבטיח[הת]? ש|בטוח[הת]? שאצליח|אביא תוצאות של \d|guarantee|will get the job|land the interview/i;

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
}

async function main() {
  const outDir = process.argv[2] || join(process.cwd(), 'evals', 'resume-optimizer', 'output', `expert-mini-${Date.now()}`);
  mkdirSync(outDir, { recursive: true });
  const cap = Number(process.env.EVAL_COST_CAP_USD);
  if (!Number.isFinite(cap) || cap <= 0) throw new Error('EVAL_COST_CAP_USD must be a positive number');

  const { CallLedger } = await import('../../evals/resume-optimizer/call-ledger');
  const ledger = new CallLedger({ maxTransportRetries: 1, hardCapUsd: cap });
  const restore = ledger.install(globalThis as never);

  const OpenAI = (await import('openai')).default;
  const tiers = await import('../../src/lib/model-tiers');
  const { generateValidatedOutput } = await import('../../src/lib/expert-workflows/orchestrator');
  const { safeJsonObjectParse } = await import('../../src/lib/expert-workflows/validators');
  const { buildRewritePrompt } = await import('../../src/lib/expert-workflows/prompts/rewrite');
  const { buildCoverLetterPrompt } = await import('../../src/lib/expert-workflows/prompts/cover-letter');
  const { parseResumeToCanonical } = await import('../../src/lib/resume/canonicalize');
  const { generateQuickWins } = await import('../../src/lib/ats/quick-wins/generator');
  const { extractJobData } = await import('../../src/lib/ats/extractors/jd-extractor');
  const content = await import('../../evals/resume-optimizer/content-rules');
  const { manifest } = await import('../../evals/resume-optimizer/manifest');
  let guard: ((o: Record<string, unknown>, c: Ctx) => Promise<Record<string, unknown>>) | null = null;
  try {
    guard = (await import('../../src/lib/expert-workflows/rewrite-guard')).guardRewriteOutput;
  } catch {
    guard = null; // old prompts (baseline run): no rewrite guard
  }

  const client = new OpenAI();
  const generate = async (p: import('../../src/lib/expert-workflows/types').PromptBundle) => {
    const sel = tiers.selectModel(p.tier ?? 'FAST', p.model);
    const capFn = (tiers as Record<string, unknown>).outputTokenCap as
      | ((s: typeof sel, base: number, r: number) => number)
      | undefined;
    const maxTokens = capFn ? capFn(sel, p.max_tokens, (p as { reasoning_max_tokens?: number }).reasoning_max_tokens ?? 4000) : p.max_tokens;
    const started = Date.now();
    const completion = await client.chat.completions.create(
      tiers.adaptChatParams(sel, {
        temperature: p.temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user },
        ],
      })
    );
    callLatencies.push(Date.now() - started);
    finishReasons.push(completion.choices[0]?.finish_reason ?? 'unknown');
    const parsed = safeJsonObjectParse(completion.choices[0]?.message?.content || '');
    if (!parsed) throw new Error('Model returned malformed JSON.');
    return parsed;
  };
  let callLatencies: number[] = [];
  let finishReasons: string[] = [];

  const sources = [
    { id: HE6.id, resumeText: HE6.resumeText, jobDescription: HE6.jobDescription, title: HE6.title, company: HE6.company },
    ...['fit-data-analyst-sql', 'he-fit-qa-automation'].map((id) => {
      const c = manifest.find((m) => m.id === id)!;
      return { id, resumeText: c.resumeText, jobDescription: c.jobDescription, title: 'Target role', company: 'Target company' };
    }),
  ];
  const lang = (s: { resumeText: string; jobDescription: string }) =>
    /[֐-׿]/.test(s.resumeText) || /[֐-׿]/.test(s.jobDescription) ? 'he' : 'en';

  const rows: Array<Record<string, unknown>> = [];
  const rewriteLatencies: number[] = [];
  try {
    for (const s of sources) {
      ledger.setContext(`parse:${s.id}`, 'generation');
      const resume = await parseResumeToCanonical(s.resumeText);
      const ctx: Ctx = {
        user_id: 'eval',
        optimization_id: 'eval',
        workflow_type: 'full_resume_rewrite',
        options: {},
        evidence_inputs: {},
        resume_original_text: s.resumeText,
        job_description_text: s.jobDescription,
        job_title: s.title,
        job_company: s.company,
        current_resume_json: resume,
        current_ats_score_optimized: 58,
        current_ats_score_original: 45,
      };
      const expected = lang(s);

      for (let run = 1; run <= 3; run++) {
        ledger.setContext(`rewrite:${s.id}#${run}`, 'generation');
        callLatencies = [];
        finishReasons = [];
        const t0 = Date.now();
        try {
          const { output } = await generateValidatedOutput('full_resume_rewrite', buildRewritePrompt(ctx), generate);
          const guarded = guard ? await guard(output, ctx) : output;
          const check = content.checkTailoredResume(guarded.rewritten_resume as never, s.resumeText, expected);
          const report = JSON.stringify((output as Record<string, unknown>).report ?? {});
          rewriteLatencies.push(...callLatencies);
          rows.push({
            workflow: 'full_resume_rewrite', case: s.id, run, ok: true, wallMs: Date.now() - t0, callMs: callLatencies, finishReasons,
            languageRatio: check.languageRatio,
            findings: [...check.findings, ...content.contentRuleFindings(report, s.resumeText)],
            atsImpact: (output as { report?: { ats_impact_estimate?: unknown } }).report?.ats_impact_estimate ?? null,
          });
        } catch (error) {
          rewriteLatencies.push(...callLatencies);
          rows.push({ workflow: 'full_resume_rewrite', case: s.id, run, ok: false, error: (error as Error).message.slice(0, 200), callMs: callLatencies, finishReasons });
        }
      }

      for (let run = 1; run <= 2; run++) {
        ledger.setContext(`cover:${s.id}#${run}`, 'generation');
        callLatencies = [];
        finishReasons = [];
        try {
          const { output } = await generateValidatedOutput('cover_letter_architect', buildCoverLetterPrompt({ ...ctx, workflow_type: 'cover_letter_architect' }), generate);
          const letters = ((output as { cover_letter_variants?: Array<{ letter?: string }> }).cover_letter_variants ?? []).map((v) => v.letter ?? '');
          const text = letters.join('\n\n');
          const findings = [
            ...content.contentRuleFindings(text, s.resumeText),
            ...content.slashFormFindings(text),
            ...content.genderFindings(text, s.resumeText),
            ...(content.languageMatch(text, expected, s.resumeText).finding ? [content.languageMatch(text, expected, s.resumeText).finding!] : []),
            ...(PROMISE.test(text) ? [{ check: 'content.promise_pattern', severity: 'critical', detail: text.match(PROMISE)![0] }] : []),
            ...(/\[[^\]]{2,40}\]/.test(text) ? [{ check: 'cover.placeholder', severity: 'high', detail: text.match(/\[[^\]]{2,40}\]/)![0] }] : []),
          ];
          rows.push({ workflow: 'cover_letter_architect', case: s.id, run, ok: true, callMs: callLatencies, finishReasons, languageRatio: content.languageMatch(text, expected, s.resumeText).ratio, findings });
        } catch (error) {
          rows.push({ workflow: 'cover_letter_architect', case: s.id, run, ok: false, error: (error as Error).message.slice(0, 200), callMs: callLatencies });
        }
      }

      for (let run = 1; run <= 2; run++) {
        ledger.setContext(`quickwins:${s.id}#${run}`, 'generation');
        const wins = await generateQuickWins({
          resume_text: `${s.resumeText}\n<!-- run ${run} -->`,
          resume_json: resume,
          job_data: extractJobData(s.jobDescription),
          subscores: {} as never,
          current_ats_score: 55,
          job_text: s.jobDescription,
        });
        const text = wins.map((w) => `${w.optimized_text}\n${w.rationale}`).join('\n');
        rows.push({
          workflow: 'quick_wins', case: s.id, run, ok: true, wins: wins.length,
          estimatedImpact: wins.map((w) => w.estimated_impact),
          languageRatio: text ? content.languageMatch(text, expected, s.resumeText).ratio : null,
          findings: [...content.contentRuleFindings(text, s.resumeText), ...content.slashFormFindings(text)],
        });
      }
    }
  } finally {
    restore();
  }

  const spend = ledger.totalCostUsd();
  const summary = {
    models: { WRITER: tiers.selectModel('WRITER', 'gpt-4o'), FAST: tiers.selectModel('FAST', 'gpt-4o-mini') },
    spendUsd: Number(spend.toFixed(4)),
    rewriteCallMs: { p50: [...rewriteLatencies].sort((a, b) => a - b)[Math.floor(rewriteLatencies.length / 2)] ?? 0, p95: p95(rewriteLatencies), max: Math.max(0, ...rewriteLatencies), over30s: rewriteLatencies.filter((x) => x > 30000).length, calls: rewriteLatencies.length },
    blockedRequests: ledger.blocked.length,
    rows,
  };
  writeFileSync(join(outDir, 'expert-mini.json'), JSON.stringify(summary, null, 2));
  const byWorkflow = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rows) byWorkflow.set(String(r.workflow), [...(byWorkflow.get(String(r.workflow)) ?? []), r]);
  console.log(`spend=$${summary.spendUsd} rewrite p95=${summary.rewriteCallMs.p95}ms max=${summary.rewriteCallMs.max}ms over30s=${summary.rewriteCallMs.over30s}`);
  for (const [wf, list] of byWorkflow) {
    const failed = list.filter((r) => !r.ok).length;
    const crit = list.flatMap((r) => (r.findings as Array<{ severity: string }> | undefined) ?? []).filter((f) => f.severity === 'critical').length;
    const high = list.flatMap((r) => (r.findings as Array<{ severity: string }> | undefined) ?? []).filter((f) => f.severity === 'high').length;
    const warn = list.flatMap((r) => (r.findings as Array<{ severity: string }> | undefined) ?? []).filter((f) => f.severity === 'warning').length;
    const langOk = list.filter((r) => typeof r.languageRatio === 'number' && (r.languageRatio as number) >= 0.85).length;
    console.log(`${wf}: runs=${list.length} failed=${failed} critical=${crit} high=${high} warnings=${warn} languageOk=${langOk}/${list.filter((r) => typeof r.languageRatio === 'number').length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
