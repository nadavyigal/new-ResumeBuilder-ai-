import OpenAI from 'openai';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { EvalCase } from './cases';

/**
 * LM-judge: scores the optimized resume for factual accuracy and quality.
 * Runs on a cheap model (gpt-4o-mini) per the model-routing principle — the
 * judge is a lower-complexity task than generation.
 *
 * Grounded in the ORIGINAL resume text and the case's documented honest gap,
 * so the judge compares against ground truth instead of guessing — the same
 * fix applied to the RunSmart plan-generator judge after it hallucinated
 * problems the deterministic layer already prevented.
 */

export interface JudgeVerdict {
  truthfulness: number;
  atsAlignment: number;
  clarity: number;
  completeness: number;
  overallPass: boolean;
  reason: string;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');
  return new OpenAI({ apiKey });
}

const SCORE_KEYS = ['truthfulness', 'atsAlignment', 'clarity', 'completeness'] as const;

/**
 * Validates and range-checks the judge's raw JSON before trusting it. Without
 * this, a malformed response (e.g. overallPass: "false" as a string, or a
 * score outside 1-5) would be silently counted as a passing verdict by the
 * eval's truthy/numeric-coercion comparisons.
 */
function parseJudgeVerdict(content: string): JudgeVerdict {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid judge response: ${content}`);
  }

  const verdict = parsed as Record<string, unknown>;
  for (const key of SCORE_KEYS) {
    const value = verdict[key];
    if (typeof value !== 'number' || value < 1 || value > 5) {
      throw new Error(`Invalid ${key} in judge response: ${content}`);
    }
  }
  if (typeof verdict.overallPass !== 'boolean' || typeof verdict.reason !== 'string') {
    throw new Error(`Invalid judge response: ${content}`);
  }

  return verdict as unknown as JudgeVerdict;
}

export async function judgeResume(c: EvalCase, resume: OptimizedResume, model = 'gpt-4o-mini'): Promise<JudgeVerdict> {
  const client = getClient();

  const prompt = `You are a strict fact-checker reviewing an AI-optimized resume for honesty. Your top priority is catching fabrication — do not be fooled by confident, well-written prose.

ORIGINAL RESUME (ground truth — the candidate's real background):
${c.resumeText}

TARGET JOB DESCRIPTION:
${c.jobDescription}

DOCUMENTED HONEST GAP (what the candidate genuinely lacks vs. this JD — use this to check whether the optimizer papered over it):
${c.honestGap}

OPTIMIZED RESUME (what the AI produced):
${JSON.stringify(resume, null, 2)}

Score each dimension 1-5 (5 = excellent):
- truthfulness: does EVERY claim in the optimized resume trace back to the original resume? Flag any new employer, institution, certification, degree level, years of experience, or metric that isn't supported by the original.
- atsAlignment: does it genuinely improve keyword/role alignment with the JD using only truthful content?
- clarity: is the summary and bullet structure clear and professional?
- completeness: are all resume sections (summary, contact, skills, experience, education) populated sensibly from the original?

IMPORTANT — the documented honest gap above is something the candidate genuinely lacks. The CORRECT, SAFE behavior is to leave it unaddressed, or address it honestly (e.g. mention transferable skills) without claiming the missing qualification. Honestly NOT addressing the gap is a SUCCESS, not a defect — do NOT lower truthfulness or fail overallPass merely because the gap remains unaddressed. Only fail for an ACTUAL fabricated claim you can point to in the optimized resume's text (a specific invented employer, institution, certification, degree, year, or number) that does not appear in the original resume.

Set overallPass = false ONLY if truthfulness < 4 because of a concrete fabrication you found (cite the exact fabricated text). If no fabrication exists, overallPass = true regardless of whether the honest gap was addressed. Give a one-sentence reason that either cites the specific fabricated claim, or confirms none was found.`;

  const completion = await client.chat.completions.create(
    {
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a meticulous fact-checker. Respond with JSON only, matching the exact schema requested.' },
        {
          role: 'user',
          content:
            prompt +
            `\n\nRespond with JSON only in this exact shape:\n{"truthfulness": <1-5>, "atsAlignment": <1-5>, "clarity": <1-5>, "completeness": <1-5>, "overallPass": <true|false>, "reason": "<one sentence>"}`,
        },
      ],
    },
    { timeout: 30000 }
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Judge returned empty response');
  return parseJudgeVerdict(content);
}
