/**
 * Live smoke test for the WRITER and FAST call sites: 5 fixed inputs per call
 * site, run once with the current models and once with the target models.
 * Calls the real OpenAI API with a local OPENAI_API_KEY. Not part of `npm test`.
 *
 *   npx tsx scripts/smoke/model-tiers.ts                       # current defaults
 *   OPENAI_MODEL_WRITER=gpt-6.1-terra OPENAI_MODEL_FAST=gpt-6-luna \
 *     npx tsx scripts/smoke/model-tiers.ts                     # target
 *
 * SMOKE_OUT=<file.json> writes the per-call rows. Validity is checked with the
 * same validators production uses (expert workflows) or the shape the caller
 * needs (other sites). Prompts and schemas are the production ones, unchanged.
 */
import { writeFileSync } from 'node:fs';
import { manifest } from '../../evals/resume-optimizer/manifest';
import { parseResumeToCanonical } from '../../src/lib/resume/canonicalize';
import { classifyIntentLLM } from '../../src/lib/agent/intents';
import { generateAmendments } from '../../src/lib/ats/amendment-generator';
import { generateQuickWins } from '../../src/lib/ats/quick-wins/generator';
import { buildRefineSectionPrompt } from '../../src/lib/ai/prompt-builders/refineSectionPrompt';
import { trackedChatCompletion } from '../../src/lib/posthog-ai';
import { getOpenAI } from '../../src/lib/openai';
import { adaptChatParams, selectModel } from '../../src/lib/model-tiers';
import { generateValidatedOutput } from '../../src/lib/expert-workflows/orchestrator';
import { buildRewritePrompt } from '../../src/lib/expert-workflows/prompts/rewrite';
import { buildCoverLetterPrompt } from '../../src/lib/expert-workflows/prompts/cover-letter';
import { buildQuantifierPrompt } from '../../src/lib/expert-workflows/prompts/quantifier';
import { buildATSReportPrompt } from '../../src/lib/expert-workflows/prompts/ats-report';
import { buildSummaryLabPrompt } from '../../src/lib/expert-workflows/prompts/summary-lab';
import { buildScreeningAnswersPrompt } from '../../src/lib/expert-workflows/prompts/screening-answers';
import { buildOutreachKitPrompt } from '../../src/lib/expert-workflows/prompts/outreach-kit';
import { buildStoryBankPrompt } from '../../src/lib/expert-workflows/prompts/story-bank';
import type { ExpertWorkflowContext, ExpertWorkflowType, PromptBundle } from '../../src/lib/expert-workflows/types';
import type { OptimizedResume } from '../../src/lib/ai-optimizer';

// 3 English + 2 Hebrew cases from the eval manifest.
const CASE_IDS = ['fit-data-analyst-sql', 'fit-saas-account-exec', 'career-change-teacher-to-ld', 'he-fit-product-manager', 'he-fit-qa-automation'];
const CASES = CASE_IDS.map((id) => {
  const c = manifest.find((m) => m.id === id);
  if (!c) throw new Error(`manifest case missing: ${id}`);
  return c;
});

interface CallUsage { model: string; input: number; output: number; reasoning: number; ms: number }
interface Row { site: string; caseId: string; ok: boolean; detail: string; ms: number; calls: CallUsage[] }

// Record every model call's usage at the fetch layer.
let currentCalls: CallUsage[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const started = Date.now();
  const res = await realFetch(input, init);
  const url = typeof input === 'string' ? input : input?.url ?? '';
  if (url.includes('api.openai.com') && /chat\/completions|responses/.test(url)) {
    res.clone().json().then((j: any) => {
      const u = j?.usage ?? {};
      currentCalls.push({
        model: j?.model ?? '?',
        input: u.prompt_tokens ?? u.input_tokens ?? 0,
        output: u.completion_tokens ?? u.output_tokens ?? 0,
        reasoning: u.completion_tokens_details?.reasoning_tokens ?? u.output_tokens_details?.reasoning_tokens ?? 0,
        ms: Date.now() - started,
      });
    }).catch(() => undefined);
  }
  return res;
}) as typeof fetch;

const rows: Row[] = [];
async function run(site: string, caseId: string, fn: () => Promise<{ ok: boolean; detail: string }>) {
  currentCalls = [];
  const t = Date.now();
  let result: { ok: boolean; detail: string };
  try {
    result = await fn();
  } catch (error) {
    result = { ok: false, detail: `error: ${String(error).slice(0, 160)}` };
  }
  await new Promise((r) => setTimeout(r, 50)); // let the usage reader finish
  rows.push({ site, caseId, ...result, ms: Date.now() - t, calls: currentCalls });
  console.log(JSON.stringify({ site, caseId, ok: result.ok, ms: Date.now() - t, detail: result.detail.slice(0, 120) }));
}

function context(c: (typeof CASES)[number], resume: OptimizedResume, type: ExpertWorkflowType): ExpertWorkflowContext {
  return {
    user_id: 'smoke',
    optimization_id: `smoke-${c.id}`,
    workflow_type: type,
    options: {},
    evidence_inputs: {},
    resume_original_text: c.resumeText,
    job_description_text: c.jobDescription,
    job_title: c.jobDescription.split('\n')[0].slice(0, 80),
    job_company: 'Smoke Co',
    current_resume_json: resume,
    current_ats_score_optimized: 62,
    current_ats_score_original: 55,
  };
}

const EXPERT: Array<[ExpertWorkflowType, (ctx: ExpertWorkflowContext) => PromptBundle]> = [
  ['full_resume_rewrite', buildRewritePrompt],
  ['cover_letter_architect', buildCoverLetterPrompt],
  ['achievement_quantifier', buildQuantifierPrompt],
  ['ats_optimization_report', buildATSReportPrompt],
  ['professional_summary_lab', buildSummaryLabPrompt],
  ['screening_answer_studio', buildScreeningAnswersPrompt],
  ['recruiter_outreach_kit', buildOutreachKitPrompt],
  ['interview_story_bank', buildStoryBankPrompt],
];

const COMMANDS = ['make my summary punchier', 'add Kubernetes to skills', 'export as PDF', 'undo that', 'תשפר את הניסוח של הניסיון שלי'];

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  console.log(
    `# models: WRITER=${selectModel('WRITER', 'gpt-4o').model} FAST=${selectModel('FAST', 'gpt-4o-mini').model} ` +
      `effort FAST=${selectModel('FAST', 'gpt-4o-mini').reasoningEffort ?? '-'} WRITER=${selectModel('WRITER', 'gpt-4o').reasoningEffort ?? '-'}`
  );

  // canonicalize (FAST) also produces the resume JSON the other sites need.
  const parsed: Record<string, OptimizedResume> = {};
  for (const c of CASES) {
    await run('resume.canonicalize', c.id, async () => {
      const r = await parseResumeToCanonical(c.resumeText);
      parsed[c.id] = r;
      const ok = Array.isArray(r.experience) && r.experience.length > 0 && Boolean(r.contact?.name);
      return { ok, detail: `experience=${r.experience?.length ?? 0} skills=${(r.skills?.technical?.length ?? 0) + (r.skills?.soft?.length ?? 0)}` };
    });
  }

  for (const [type, build] of EXPERT) {
    for (const c of CASES) {
      await run(`expert.${type}`, c.id, async () => {
        const prompt = build(context(c, parsed[c.id], type));
        // maxAttempts 1: validity on the first answer, no corrective retry.
        const { validation } = await generateValidatedOutput(type, prompt, undefined, 1);
        return { ok: validation.valid, detail: validation.valid ? 'schema valid' : String(validation.error) };
      });
    }
  }

  for (const c of CASES) {
    const bullet = parsed[c.id].experience?.[0]?.achievements?.[0] ?? c.resumeText.split('\n').find((l) => l.trim().length > 40) ?? c.resumeText.slice(0, 200);
    await run('refine-section', c.id, async () => {
      const { system, user } = buildRefineSectionPrompt({
        req: {
          resumeId: 'smoke',
          selection: { text: bullet, field: 'achievements', sectionId: 'experience-0' },
          instruction: 'Make this more concise and outcome focused',
          jobDescription: c.jobDescription,
        } as any,
      });
      const completion = await trackedChatCompletion(getOpenAI(), adaptChatParams(selectModel('FAST', 'gpt-4o-mini'), {
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }), { traceName: 'smoke-refine-section' });
      const json = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
      return { ok: typeof json.suggestion === 'string' && json.suggestion.length > 0, detail: String(json.suggestion ?? '').slice(0, 100) };
    });
  }

  for (const c of CASES) {
    await run('ats.amendment-generator', c.id, async () => {
      const r = await generateAmendments(
        { id: 's1', text: 'Add the job’s core tools that the candidate already uses to the skills section', estimated_gain: 5, targets: ['skills'] } as any,
        parsed[c.id],
        { jobDescriptionText: c.jobDescription }
      );
      return { ok: r.success && r.affectedFields.length > 0, detail: `fields=${r.affectedFields.length} ${r.error ?? ''}` };
    });
  }

  for (const c of CASES) {
    await run('ats.quick-wins', c.id, async () => {
      const wins = await generateQuickWins({
        resume_text: c.resumeText,
        resume_json: parsed[c.id],
        job_data: {
          title: c.jobDescription.split('\n')[0].slice(0, 80),
          must_have: c.requirements.slice(0, 5).map((r) => r.requirement),
          nice_to_have: [],
          responsibilities: [],
        } as any,
        subscores: { keyword_exact: 40, keyword_phrase: 35, semantic_relevance: 60, title_alignment: 50, metrics_presence: 30, section_completeness: 80, format_parseability: 90, recency_fit: 70 },
        current_ats_score: 55,
        job_text: c.jobDescription,
      });
      // Fewer than 3 is valid by design; a thrown error or malformed JSON is not.
      return { ok: Array.isArray(wins), detail: `wins=${wins.length}` };
    });
  }

  for (const command of COMMANDS) {
    await run('agent.classifyIntent', command, async () => {
      const label = await classifyIntentLLM(command);
      return { ok: label !== null, detail: String(label) };
    });
  }

  const bySite = new Map<string, Row[]>();
  for (const row of rows) bySite.set(row.site, [...(bySite.get(row.site) ?? []), row]);
  console.log('\n| Site | Valid | p50 ms | max ms | in tok | out tok | reasoning tok | models |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const [site, list] of bySite) {
    const ms = list.map((r) => r.ms).sort((a, b) => a - b);
    const sum = (f: (u: CallUsage) => number) => list.reduce((n, r) => n + r.calls.reduce((m, u) => m + f(u), 0), 0);
    const models = [...new Set(list.flatMap((r) => r.calls.map((u) => u.model)))].join(' ');
    console.log(`| ${site} | ${list.filter((r) => r.ok).length}/${list.length} | ${ms[Math.floor(ms.length / 2)]} | ${ms[ms.length - 1]} | ${sum((u) => u.input)} | ${sum((u) => u.output)} | ${sum((u) => u.reasoning)} | ${models} |`);
  }
  if (process.env.SMOKE_OUT) writeFileSync(process.env.SMOKE_OUT, JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
