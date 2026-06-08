import OpenAI from 'openai';
import {
  RESUME_OPTIMIZATION_SYSTEM_PROMPT,
  RESUME_OPTIMIZATION_GAP_PROMPT,
  OPTIMIZATION_CONFIG,
  type ResumeOptimizationGaps,
} from '../prompts/resume-optimizer';
import { optimizeResume, type OptimizedResume } from './index';
import { scoreOptimization, resumeJsonToText } from '@/lib/ats/integration';
import { extractJobData } from '@/lib/ats/extractors/jd-extractor';
import type { ATSScoreOutput } from '@/lib/ats/types';

export interface OptimizationPipelineResult {
  optimizedResume: OptimizedResume;
  atsResult: ATSScoreOutput;
  passesUsed: number;
}

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
  isHebrew: boolean
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

    const completion = await openai.chat.completions.create(
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
  jobDescription: string
): Promise<OptimizationPipelineResult> {
  const hebrewPattern = /[֐-׿]/;
  const isHebrew = hebrewPattern.test(resumeText) || hebrewPattern.test(jobDescription);

  console.log('Pipeline start:', { isHebrew, resumeLen: resumeText.length });

  // Step 1: Extract JD structure
  const jobExtraction = extractJobData(jobDescription);
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
    isHebrew
  );

  if (!candidate1) {
    console.warn('Pipeline pass 1 gap call failed, falling back to plain optimizeResume');
    const fallbackResult = await optimizeResume(resumeText, jobDescription);
    if (!fallbackResult.success || !fallbackResult.optimizedResume) {
      throw new Error(fallbackResult.error || 'Failed to optimize resume in pipeline pass 1');
    }
    candidate1 = fallbackResult.optimizedResume;
  }

  // Step 3: Score pass 1 candidate
  const score1 = await scoreOptimization({
    resumeOriginalText: resumeText,
    resumeOptimizedJson: candidate1,
    jobDescriptionText: jobDescription,
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

  const candidate2: OptimizedResume | null = await callOpenAIWithGapPrompt(
    gapPrompt2,
    RESUME_OPTIMIZATION_SYSTEM_PROMPT,
    isHebrew
  );

  if (!candidate2) {
    console.warn('Pipeline pass 2 failed, keeping pass 1 candidate');
    return { optimizedResume: candidate1, atsResult: score1, passesUsed: 1 };
  }

  // Score pass 2 candidate
  const score2 = await scoreOptimization({
    resumeOriginalText: resumeText,
    resumeOptimizedJson: candidate2,
    jobDescriptionText: jobDescription,
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
