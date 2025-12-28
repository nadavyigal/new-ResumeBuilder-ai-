/**
 * Quick Wins Generator
 *
 * Generates AI-powered resume improvement suggestions with before/after text
 * using OpenAI GPT-4, with graceful fallback to template-based suggestions.
 */

import { getOpenAI } from '@/lib/openai';
import type { QuickWinSuggestion, JobExtraction, SubScores } from '../types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { buildQuickWinsPrompt } from './prompt';
import { getCacheKey, getCachedQuickWins, cacheQuickWins } from './cache';

interface GenerateQuickWinsParams {
  resume_text: string;
  resume_json: OptimizedResume;
  job_data: JobExtraction;
  subscores: SubScores;
  current_ats_score: number;
}

/**
 * Generate 3 AI-powered quick win suggestions
 */
export async function generateQuickWins(params: GenerateQuickWinsParams): Promise<QuickWinSuggestion[]> {
  const startTime = Date.now();

  // Check cache first
  const cacheKey = getCacheKey({
    resume_text: params.resume_text,
    job_data: params.job_data,
  });

  const cached = getCachedQuickWins(cacheKey);
  if (cached) {
    console.log('✅ Quick wins cache hit');
    return cached;
  }

  try {
    const prompt = buildQuickWinsPrompt(params);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini', // Cost-efficient model
      messages: [
        {
          role: 'system',
          content: 'You are an expert ATS optimization specialist. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7, // Balance creativity and consistency
      max_tokens: 2000,
    });

    const result = completion.choices[0].message.content;
    if (!result) {
      throw new Error('OpenAI returned empty response');
    }

    const parsed = JSON.parse(result);
    const quickWins = parsed.quick_wins || [];

    // Validate and sanitize
    const validatedQuickWins = quickWins
      .slice(0, 3) // Ensure max 3
      .map((qw: any, index: number) => validateQuickWin(qw, index))
      .filter(Boolean) as QuickWinSuggestion[];

    // If we got fewer than 3, pad with fallback suggestions
    if (validatedQuickWins.length < 3) {
      console.warn(`Only got ${validatedQuickWins.length} valid quick wins from OpenAI, adding fallback suggestions`);
      const fallbackSuggestions = generateFallbackQuickWins(params);
      const needed = 3 - validatedQuickWins.length;
      validatedQuickWins.push(...fallbackSuggestions.slice(0, needed));
    }

    const duration = Date.now() - startTime;
    console.log(`✨ Generated ${validatedQuickWins.length} quick wins in ${duration}ms`);

    // Cache result
    cacheQuickWins(cacheKey, validatedQuickWins);

    return validatedQuickWins;

  } catch (error) {
    console.error('Quick wins generation failed:', error);

    // Fallback: Return template-based suggestions
    const fallbackSuggestions = generateFallbackQuickWins(params);
    console.log(`📋 Using ${fallbackSuggestions.length} fallback quick wins`);
    return fallbackSuggestions;
  }
}

/**
 * Validate and sanitize a quick win from OpenAI
 */
function validateQuickWin(qw: any, index: number): QuickWinSuggestion | null {
  try {
    // Validation
    if (!qw.original_text || !qw.optimized_text) {
      console.warn('Quick win missing required text fields');
      return null;
    }

    if (qw.original_text.length > 500 || qw.optimized_text.length > 500) {
      console.warn('Quick win text too long');
      return null;
    }

    const validTypes = ['keyword_optimization', 'quantified_achievement', 'action_verb', 'relevance_enhancement'];
    if (!validTypes.includes(qw.improvement_type)) {
      qw.improvement_type = 'keyword_optimization'; // default
    }

    const validSections = ['summary', 'experience', 'skills', 'education'];
    const section = validSections.includes(qw.location?.section) ? qw.location.section : 'experience';

    return {
      id: `qw_${Date.now()}_${index}`,
      original_text: String(qw.original_text).trim(),
      optimized_text: String(qw.optimized_text).trim(),
      improvement_type: qw.improvement_type,
      estimated_impact: Math.min(15, Math.max(1, Number(qw.estimated_impact) || 5)),
      location: {
        section,
        subsection: qw.location?.subsection,
      },
      rationale: String(qw.rationale || 'Improves ATS keyword matching').trim(),
      keywords_added: Array.isArray(qw.keywords_added)
        ? qw.keywords_added.slice(0, 5).map(String)
        : [],
    };
  } catch (error) {
    console.error('Quick win validation failed:', error);
    return null;
  }
}

/**
 * Fallback: Generate quick wins from existing suggestions
 */
function generateFallbackQuickWins(params: GenerateQuickWinsParams): QuickWinSuggestion[] {
  // Extract sentences from experience section
  const experienceBullets = extractExperienceBullets(params.resume_json);
  const missingKeywords = params.job_data.must_have.slice(0, 5);

  const quickWins: QuickWinSuggestion[] = [];

  // Quick win 1: Add keywords to bullet
  if (experienceBullets.length > 0 && missingKeywords.length > 0) {
    const original = experienceBullets[0];
    const keywordsToAdd = missingKeywords.slice(0, 2);
    const optimized = `${original} utilizing ${keywordsToAdd.join(' and ')}`;

    quickWins.push({
      id: `qw_fallback_1`,
      original_text: original,
      optimized_text: optimized,
      improvement_type: 'keyword_optimization',
      estimated_impact: 6,
      location: { section: 'experience' },
      rationale: 'Added relevant keywords from job description to improve keyword matching score',
      keywords_added: keywordsToAdd,
    });
  }

  // Quick win 2: Quantify achievement
  if (experienceBullets.length > 1) {
    const original = experienceBullets[1];
    const optimized = `${original}, resulting in 25% improvement in efficiency`;

    quickWins.push({
      id: `qw_fallback_2`,
      original_text: original,
      optimized_text: optimized,
      improvement_type: 'quantified_achievement',
      estimated_impact: 7,
      location: { section: 'experience' },
      rationale: 'Added quantifiable metric to demonstrate measurable impact and improve metrics presence score',
      keywords_added: [],
    });
  }

  // Quick win 3: Stronger action verb
  if (experienceBullets.length > 2) {
    const original = experienceBullets[2];
    const weakVerbs = /^(Worked on|Helped with|Did|Assisted|Participated in|Involved in)/i;
    const optimized = original.replace(weakVerbs, 'Led');

    quickWins.push({
      id: `qw_fallback_3`,
      original_text: original,
      optimized_text: optimized,
      improvement_type: 'action_verb',
      estimated_impact: 4,
      location: { section: 'experience' },
      rationale: 'Replaced weak verb with strong action verb to better demonstrate leadership and initiative',
      keywords_added: [],
    });
  }

  return quickWins.slice(0, 3);
}

/**
 * Extract experience bullets from resume JSON
 */
function extractExperienceBullets(resume: OptimizedResume): string[] {
  const bullets: string[] = [];

  if (resume.experience && Array.isArray(resume.experience)) {
    for (const exp of resume.experience) {
      if (exp.responsibilities && Array.isArray(exp.responsibilities)) {
        bullets.push(...exp.responsibilities);
      }
    }
  }

  return bullets.slice(0, 5);
}
