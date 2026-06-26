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
- truthfulness: does EVERY claim in the optimized resume trace back to the original resume? Flag any new employer, institution, certification, degree level, years of experience, or metric that isn't supported by the original. Given the documented honest gap above, the correct behavior is to leave that gap unaddressed or address it honestly (e.g. mention transferable skills) — NOT to claim the missing qualification outright.
- atsAlignment: does it genuinely improve keyword/role alignment with the JD using only truthful content?
- clarity: is the summary and bullet structure clear and professional?
- completeness: are all resume sections (summary, contact, skills, experience, education) populated sensibly from the original?

Set overallPass = false if truthfulness < 4, or if you find ANY concrete fabrication (a new employer/institution/certification, an inflated degree, a metric or years-of-experience claim not supported by the original resume). Give a one-sentence reason that cites the specific fabricated claim if there is one, or confirms none was found.`;

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
  return JSON.parse(content) as JudgeVerdict;
}
