import OpenAI from 'openai';
import { trackedChatCompletion, type AITraceOptions } from '@/lib/posthog-ai';
import {
  RESUME_OPTIMIZATION_SYSTEM_PROMPT,
  RESUME_OPTIMIZATION_GAP_PROMPT,
  OPTIMIZATION_CONFIG,
  type ResumeOptimizationGaps,
} from '../prompts/resume-optimizer';
import { optimizeResume, type OptimizedResume } from './index';
import { normalizeExperienceBullets, countBullets } from './normalize-experience';
import { scoreOptimization, resumeJsonToText } from '@/lib/ats/integration';
import { assessLift, MIN_MEANINGFUL_LIFT, type LiftAssessment } from '@/lib/ats/lift';
import { extractJobData } from '@/lib/ats/extractors/jd-extractor';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';
import type { ATSScoreOutput } from '@/lib/ats/types';

export interface OptimizationPipelineResult {
  optimizedResume: OptimizedResume;
  atsResult: ATSScoreOutput;
  passesUsed: number;
  /**
   * Whether this run actually improved on where the user started (WP-45 S2).
   *
   * The pipeline previously compared pass 1 against pass 2 and never against
   * the original, so a run that moved the score by +2 — or moved it down —
   * was returned as a result. Callers must consult `lift.displayScores` before
   * showing a before/after pair.
   */
  lift: LiftAssessment;
}

type OptimizationPipelineOptions = {
  jobExtractedJson?: Record<string, unknown>;
  aiTrace?: AITraceOptions;
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

async function callOpenAIWithGapPrompt(
  userPrompt: string,
  systemPrompt: string,
  isHebrew: boolean,
  aiTrace?: AITraceOptions
): Promise<OptimizedResume | null> {
  try {
    const openai = getOpenAIClient();

    const languageInstruction = isHebrew
      ? `\n\nHEBREW OUTPUT REQUIREMENT:
- Write all resume content values in Hebrew.
- Keep JSON field names in English exactly as required by the schema.
- Preserve natural right-to-left Hebrew phrasing.
- Keep proper nouns (company names, product names, tools) in their original form when needed.
- Use truthful, professional Hebrew and avoid unnecessary English text.`
      : '';

    const completion = await trackedChatCompletion(
      openai,
      {
        model: OPTIMIZATION_CONFIG.model,
        temperature: OPTIMIZATION_CONFIG.temperature,
        max_tokens: OPTIMIZATION_CONFIG.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemPrompt + languageInstruction,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      },
      aiTrace || { traceName: 'optimize' },
      { timeout: OPTIMIZATION_CONFIG.timeout }
    );

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      return null;
    }

    // WP-64: normalize the bullet key here too — the gap pass is a second,
    // independent model call and drifts the same way.
    return normalizeExperienceBullets(
      JSON.parse(responseContent) as OptimizedResume
    );
  } catch (error) {
    console.error('Gap-prompt OpenAI call failed:', error);
    return null;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PERCENT_PATTERN = /\d+(?:\.\d+)?%/g;

/**
 * Deterministically removes any percentage figure in an achievement bullet
 * that the model invented (i.e. does not appear anywhere in the candidate's
 * original resume text). The system prompt already instructs "if no metric
 * exists, keep impact statements non-numeric" — proven, by the eval harness
 * (evals/resume-optimizer/, 2026-06-26), that gpt-4o violates this under
 * pressure when the source resume has zero metrics to draw from. Mirrors
 * RunSmart's enforcePlanSafety: enforce deterministically, don't trust the
 * prompt alone for the fabrication-prone case.
 */
export function stripFabricatedMetrics(resume: OptimizedResume, originalResumeText: string): OptimizedResume {
  const experience = (resume.experience ?? []).map((entry) => {
    const achievements = (entry.achievements ?? []).map((bullet) => {
      const percentages = [...new Set(bullet.match(PERCENT_PATTERN) ?? [])];
      const fabricated = percentages.filter((pct) => !originalResumeText.includes(pct));
      if (fabricated.length === 0) return bullet;

      let cleaned = bullet;
      for (const pct of fabricated) {
        const escaped = escapeRegExp(pct);
        cleaned = cleaned
          // "by 20%", "to 20%"
          .replace(new RegExp(`\\s*(?:by|to)\\s+${escaped}\\b`, 'gi'), '')
          // "20% improvement/increase/reduction/growth/gain (in/to)"
          .replace(new RegExp(`${escaped}\\s+(?:improvement|increase|reduction|growth|gain)\\s*(?:in|to)?`, 'gi'), '')
          // leftover bare percentage
          .replace(new RegExp(escaped, 'g'), '');
      }
      // Tidy artifacts left by removal: collapse adjacent duplicate/connector
      // words ("by by", "by through" -> "through"), strip a connector word
      // left dangling before punctuation, and collapse whitespace.
      const CONNECTORS = '(?:by|to|through|via)';
      let prevCleaned: string;
      do {
        prevCleaned = cleaned;
        cleaned = cleaned
          .replace(new RegExp(`\\b${CONNECTORS}\\s+${CONNECTORS}\\b`, 'gi'), (m) => m.split(/\s+/).pop() ?? m)
          .replace(new RegExp(`\\s+${CONNECTORS}\\s*([.,;]|$)`, 'gi'), '$1');
      } while (cleaned !== prevCleaned);
      cleaned = cleaned
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;])/g, '$1')
        .trim();
      return cleaned || bullet.replace(PERCENT_PATTERN, '').trim();
    });
    return { ...entry, achievements };
  });

  return { ...resume, experience };
}

/**
 * WP-64 — a candidate that returns roles with no bullets under any of them has
 * deleted the candidate's evidence, whatever the score says. On the 2026-07-29
 * live run that shape scored 61 against an original of 38, because the scorer
 * reads the same empty `achievements` key the renderer does, so nothing in the
 * scoring path can be relied on to catch it.
 *
 * Deliberately narrow: only the total-loss case. Legitimate optimizations do
 * merge and drop individual bullets, and this must not fight them.
 */
export function hasTotalBulletLoss(candidate: OptimizedResume | null | undefined): boolean {
  const roles = Array.isArray(candidate?.experience) ? candidate.experience : [];
  return roles.length > 0 && countBullets(candidate) === 0;
}

/**
 * WP-64 — pass 2 starts from pass 1's output and never sees the original
 * resume, so any content it drops is unrecoverable. Comparing the two candidate
 * bullet counts is therefore the only place content loss across passes can be
 * detected at all. Mirrors the WP-45 S2 posture for scores: a pass must be
 * compared against what it started from, not only against the other pass.
 */
export function losesContentAgainst(
  candidate: OptimizedResume | null | undefined,
  previous: OptimizedResume
): boolean {
  const after = countBullets(candidate);
  const before = countBullets(previous);
  if (before === 0) return false;
  // A pass may consolidate; losing more than a third of the evidence is not
  // consolidation.
  return after < Math.ceil(before * (2 / 3));
}

function buildInitialGaps(resumeText: string, mustHave: string[]): ResumeOptimizationGaps {
  const resumeLower = resumeText.toLowerCase();
  const missingKeywords = mustHave.filter(term => {
    const termLower = term.toLowerCase();
    return !resumeLower.includes(termLower);
  });

  return {
    missingKeywords,
    lowSubscores: {},
    mustHave,
  };
}

function buildGapsFromAtsResult(
  atsResult: ATSScoreOutput,
  mustHave: string[]
): ResumeOptimizationGaps {
  const missingKeywords: string[] = [];

  for (const suggestion of atsResult.suggestions) {
    const action = suggestion.action;
    if (action?.type === 'add_keyword') {
      const keywords = (action.params as { keywords?: string[] }).keywords;
      if (keywords) {
        missingKeywords.push(...keywords);
      }
    }
  }

  const lowSubscores: Record<string, number> = {};
  const subscores = atsResult.subscores as unknown as Record<string, number>;
  for (const [key, value] of Object.entries(subscores)) {
    if (typeof value === 'number' && value < 60) {
      lowSubscores[key] = value;
    }
  }

  return {
    missingKeywords: [...new Set(missingKeywords)],
    lowSubscores,
    mustHave,
  };
}

export async function runOptimizePipeline(
  resumeText: string,
  jobDescription: string,
  options?: OptimizationPipelineOptions
): Promise<OptimizationPipelineResult> {
  const hebrewPattern = /[֐-׿]/;
  const isHebrew = hebrewPattern.test(resumeText) || hebrewPattern.test(jobDescription);

  console.log('Pipeline start:', { isHebrew, resumeLen: resumeText.length });

  // Step 1: Extract JD structure (use parsed_data fallbacks when available)
  const jobExtraction = options?.jobExtractedJson
    ? buildJobDataFromExtractedJson(options.jobExtractedJson, jobDescription)
    : extractJobData(jobDescription);
  console.log('Pipeline JD extraction:', {
    must_have_count: jobExtraction.must_have.length,
    nice_to_have_count: jobExtraction.nice_to_have.length,
  });

  // Step 2: Pass 1 — gap-injected rewrite
  const initialGaps = buildInitialGaps(resumeText, jobExtraction.must_have);
  console.log('Pipeline pass 1 gaps:', {
    missingKeywords: initialGaps.missingKeywords.length,
  });

  const gapUserPrompt = RESUME_OPTIMIZATION_GAP_PROMPT(resumeText, jobDescription, initialGaps);

  let candidate1: OptimizedResume | null = await callOpenAIWithGapPrompt(
    gapUserPrompt,
    RESUME_OPTIMIZATION_SYSTEM_PROMPT,
    isHebrew,
    options?.aiTrace
  );

  if (!candidate1) {
    console.warn('Pipeline pass 1 gap call failed, falling back to plain optimizeResume');
    const fallbackResult = await optimizeResume(resumeText, jobDescription, options?.aiTrace);
    if (!fallbackResult.success || !fallbackResult.optimizedResume) {
      throw new Error(fallbackResult.error || 'Failed to optimize resume in pipeline pass 1');
    }
    candidate1 = fallbackResult.optimizedResume;
  }

  candidate1 = stripFabricatedMetrics(candidate1, resumeText);

  // WP-64: if pass 1 came back with roles and no bullets under any of them, the
  // candidate's evidence is gone. Normalization has already recovered the known
  // key-drift cause, so reaching here means a genuinely empty generation —
  // retry once through the plain optimizer rather than returning a skeleton.
  if (hasTotalBulletLoss(candidate1)) {
    console.warn('Pipeline pass 1 returned roles with zero bullets (WP-64), retrying once');
    const retry = await optimizeResume(resumeText, jobDescription, options?.aiTrace);
    const retryCandidate = retry.success && retry.optimizedResume
      ? stripFabricatedMetrics(retry.optimizedResume, resumeText)
      : null;
    if (retryCandidate && !hasTotalBulletLoss(retryCandidate)) {
      candidate1 = retryCandidate;
    } else {
      console.error('Pipeline: retry also produced zero bullets (WP-64), returning it unrepaired');
    }
  }

  // Step 3: Score pass 1 candidate
  const score1 = await scoreOptimization({
    resumeOriginalText: resumeText,
    resumeOptimizedJson: candidate1,
    jobDescriptionText: jobDescription,
    jobExtractedJson: options?.jobExtractedJson,
  });

  console.log('Pipeline pass 1 score:', {
    original: score1.ats_score_original,
    optimized: score1.ats_score_optimized,
  });

  if (score1.ats_score_optimized === 0 && score1.confidence === 0) {
    console.warn('Pipeline: scoring returned zero-confidence fallback, pass 2 will likely also fail');
  }

  const lift1 = liftFor(score1, 1);

  // Run the second pass when the result is weak in absolute terms, when the
  // gain is thin, or — the case the old condition missed entirely — when the
  // run has not meaningfully beaten the resume the user started with.
  const shouldRunPass2 =
    score1.ats_score_optimized < 75 ||
    score1.ats_score_optimized - score1.ats_score_original < 10 ||
    !lift1.meaningful;

  if (!shouldRunPass2) {
    console.log('Pipeline: pass 2 not needed, returning pass 1 result');
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 1, lift: lift1 };
  }

  // Step 4: Conditional pass 2
  console.log('Pipeline: running pass 2');
  const gaps2 = buildGapsFromAtsResult(score1, jobExtraction.must_have);
  const candidate1Text = resumeJsonToText(candidate1);
  const gapPrompt2 = RESUME_OPTIMIZATION_GAP_PROMPT(candidate1Text, jobDescription, gaps2);

  const candidate2Raw: OptimizedResume | null = await callOpenAIWithGapPrompt(
    gapPrompt2,
    RESUME_OPTIMIZATION_SYSTEM_PROMPT,
    isHebrew,
    options?.aiTrace
  );

  if (!candidate2Raw) {
    console.warn('Pipeline pass 2 failed, keeping pass 1 candidate');
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 1, lift: lift1 };
  }

  const candidate2 = stripFabricatedMetrics(candidate2Raw, resumeText);

  // WP-64: pass 2 never sees the original resume, so anything it drops is gone
  // for good. Keep pass 1 rather than shipping a thinner document, regardless of
  // how pass 2 scores — the score cannot see this loss.
  if (hasTotalBulletLoss(candidate2) || losesContentAgainst(candidate2, candidate1)) {
    console.warn('Pipeline pass 2 lost experience content (WP-64), keeping pass 1 candidate', {
      pass1Bullets: countBullets(candidate1),
      pass2Bullets: countBullets(candidate2),
    });
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 1, lift: lift1 };
  }

  // Score pass 2 candidate
  const score2 = await scoreOptimization({
    resumeOriginalText: resumeText,
    resumeOptimizedJson: candidate2,
    jobDescriptionText: jobDescription,
    jobExtractedJson: options?.jobExtractedJson,
  });

  console.log('Pipeline pass 2 score:', {
    original: score2.ats_score_original,
    optimized: score2.ats_score_optimized,
  });

  if (score2.ats_score_optimized === 0 && score2.confidence === 0) {
    console.warn('Pipeline pass 2: scoring returned zero-confidence fallback, keeping pass 1 result');
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 2, lift: liftFor(score1, 2) };
  }

  // Keep the winner
  if (score2.ats_score_optimized >= score1.ats_score_optimized) {
    console.log('Pipeline: pass 2 wins');
    return { optimizedResume: candidate2, atsResult: score2, passesUsed: 2, lift: liftFor(score2, 2) };
  }

  console.log('Pipeline: pass 1 wins over pass 2');
  return { optimizedResume: candidate1, atsResult: score1, passesUsed: 2, lift: liftFor(score1, 2) };
}

/**
 * Judge a scored candidate against the resume the user started with.
 *
 * Note what this does NOT do: it never raises a score, never clamps the delta
 * positive, and never applies a minimum. A run that failed to improve the
 * resume stays reported as a run that failed to improve the resume — the
 * caller decides how to say so (WP-45 S2).
 */
function liftFor(score: ATSScoreOutput, passesUsed: number): LiftAssessment {
  const lift = assessLift({
    original: score.ats_score_original,
    optimized: score.ats_score_optimized,
    subscoresOriginal: score.subscores_original,
    subscores: score.subscores,
    passesUsed,
  });

  if (!lift.meaningful) {
    console.warn('Pipeline: no meaningful lift', {
      delta: lift.delta,
      floor: MIN_MEANINGFUL_LIFT,
      stalled: lift.stalledComponents,
    });
  }

  return lift;
}
