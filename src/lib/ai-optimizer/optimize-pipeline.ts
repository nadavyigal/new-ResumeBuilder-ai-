import OpenAI from 'openai';
import { trackedChatCompletion, type AITraceOptions } from '@/lib/posthog-ai';
import {
  RESUME_OPTIMIZATION_SYSTEM_PROMPT,
  RESUME_OPTIMIZATION_GAP_PROMPT,
  OPTIMIZATION_CONFIG,
  type ResumeOptimizationGaps,
} from '../prompts/resume-optimizer';
import { optimizeResume, type OptimizedResume } from './index';
import { scoreOptimization, resumeJsonToText } from '@/lib/ats/integration';
import { extractJobData } from '@/lib/ats/extractors/jd-extractor';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';
import type { ATSScoreOutput } from '@/lib/ats/types';

export interface OptimizationPipelineResult {
  optimizedResume: OptimizedResume;
  atsResult: ATSScoreOutput;
  passesUsed: number;
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

    return JSON.parse(responseContent) as OptimizedResume;
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

  const shouldRunPass2 =
    score1.ats_score_optimized < 75 ||
    score1.ats_score_optimized - score1.ats_score_original < 10;

  if (!shouldRunPass2) {
    console.log('Pipeline: pass 2 not needed, returning pass 1 result');
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 1 };
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
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 1 };
  }

  const candidate2 = stripFabricatedMetrics(candidate2Raw, resumeText);

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
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 2 };
  }

  // Keep the winner
  if (score2.ats_score_optimized >= score1.ats_score_optimized) {
    console.log('Pipeline: pass 2 wins');
    return { optimizedResume: candidate2, atsResult: score2, passesUsed: 2 };
  }

  console.log('Pipeline: pass 1 wins over pass 2');
  return { optimizedResume: candidate1, atsResult: score1, passesUsed: 2 };
}
