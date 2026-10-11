/**
 * Quick Wins Generator
 *
 * Generates AI-powered resume improvement suggestions with before/after text
 * using OpenAI. Every rewrite is checked against the résumé before it is shown
 * (`./grounding.ts`); a rewrite that adds facts is discarded, never padded with
 * a template.
 */

import { getOpenAI } from '@/lib/openai';
import { trackedChatCompletion } from '@/lib/posthog-ai';
import type { QuickWinSuggestion, JobExtraction, SubScores } from '../types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { buildQuickWinsPrompt } from './prompt';
import { getCacheKey, getCachedQuickWins, cacheQuickWins } from './cache';
import {
  checkQuickWinGrounding,
  describeViolations,
  keywordsPresentIn,
  type GroundingContext,
} from './grounding';

interface GenerateQuickWinsParams {
  resume_text: string;
  resume_json: OptimizedResume;
  job_data: JobExtraction;
  subscores: SubScores;
  current_ats_score: number;
  /** Raw job text, used to spot job-post terms copied into a rewrite. */
  job_text?: string;
}

const TARGET_COUNT = 3;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM_MESSAGE =
  'You are an expert ATS optimization specialist. You never add facts the resume does not state. Always respond with valid JSON.';

interface Rejected {
  qw: QuickWinSuggestion;
  reasons: string;
}

/**
 * Generate up to 3 AI-powered quick win suggestions.
 *
 * Fewer than 3 is a valid result. Before 2026-10-11 a shortfall was padded with
 * templates that appended "resulting in 25% improvement in efficiency" or job
 * keywords ("... utilizing X and Y") to real bullets. An empty slot is better
 * than an invented claim.
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

  const ctx: GroundingContext = {
    resumeText: params.resume_text,
    jobText: params.job_text || jobDataText(params.job_data),
    jobTitle: params.job_data.title,
  };

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_MESSAGE },
      { role: 'user', content: buildQuickWinsPrompt(params) },
    ];

    const first = await requestQuickWins(messages, params.current_ats_score);
    const { accepted, rejected } = groundQuickWins(first.candidates, ctx);

    // One repair round when rewrites were discarded. The model is told why, so
    // the second answer is not the same fabrication again.
    if (accepted.length < TARGET_COUNT && rejected.length > 0) {
      messages.push(
        { role: 'assistant', content: first.raw },
        { role: 'user', content: buildRepairMessage(rejected, accepted, TARGET_COUNT - accepted.length) },
      );
      const second = await requestQuickWins(messages, params.current_ats_score);
      const used = new Set(accepted.map((qw) => qw.original_text.toLowerCase()));
      for (const qw of groundQuickWins(second.candidates, ctx).accepted) {
        if (accepted.length >= TARGET_COUNT) break;
        if (used.has(qw.original_text.toLowerCase())) continue;
        used.add(qw.original_text.toLowerCase());
        accepted.push(qw);
      }
    }

    const result = accepted.map((qw, index) => ({ ...qw, id: `qw_${Date.now()}_${index}` }));

    const duration = Date.now() - startTime;
    console.log(`✨ Generated ${result.length} grounded quick wins in ${duration}ms`);

    // Cache result
    cacheQuickWins(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Quick wins generation failed:', error);
    return [];
  }
}

async function requestQuickWins(
  messages: ChatMessage[],
  currentScore: number,
): Promise<{ raw: string; candidates: QuickWinSuggestion[] }> {
  const completion = await trackedChatCompletion(getOpenAI(), {
    model: 'gpt-4o-mini', // Cost-efficient model
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.3, // Rewrites of the user's own facts, not creative writing
    max_tokens: 2000,
  }, {
    traceName: 'ats-check',
    properties: {
      current_ats_score: currentScore,
    },
  });

  const raw = completion.choices[0].message.content;
  if (!raw) {
    throw new Error('OpenAI returned empty response');
  }

  const parsed = JSON.parse(raw);
  const candidates = (Array.isArray(parsed.quick_wins) ? parsed.quick_wins : [])
    .slice(0, TARGET_COUNT)
    .map((qw: any, index: number) => validateQuickWin(qw, index))
    .filter(Boolean) as QuickWinSuggestion[];

  return { raw, candidates };
}

/**
 * Split candidates into rewrites the résumé backs and rewrites it does not.
 * Exported for tests: this is the deterministic half of the honesty fix.
 */
export function groundQuickWins(
  candidates: QuickWinSuggestion[],
  ctx: GroundingContext,
): { accepted: QuickWinSuggestion[]; rejected: Rejected[] } {
  const accepted: QuickWinSuggestion[] = [];
  const rejected: Rejected[] = [];

  for (const qw of candidates) {
    const check = checkQuickWinGrounding(qw, ctx);
    if (check.ok) {
      accepted.push({ ...qw, keywords_added: keywordsPresentIn(qw.keywords_added, qw.optimized_text) });
    } else {
      console.warn('Quick win discarded:', check.violations.join(', '));
      rejected.push({ qw, reasons: describeViolations(check.violations) });
    }
  }

  return { accepted, rejected };
}

function buildRepairMessage(rejected: Rejected[], accepted: QuickWinSuggestion[], needed: number): string {
  const rejectedLines = rejected
    .map((r) => `- "${r.qw.optimized_text}": ${r.reasons}`)
    .join('\n');
  const keepLines = accepted.length
    ? `\nAlready accepted (do not repeat these bullets):\n${accepted.map((qw) => `- "${qw.original_text}"`).join('\n')}\n`
    : '';

  return `These rewrites were discarded because they break the truth rules:
${rejectedLines}
${keepLines}
Return ${needed} replacement quick win(s) in the same JSON format. Use only facts the resume states. If the original bullet has numbers, keep them. Do not use any duty, number or term from the job that the resume does not already contain.`;
}

/** Job text rebuilt from structured data when the raw posting is not passed in. */
function jobDataText(job: JobExtraction): string {
  return [
    job.title,
    ...job.must_have,
    ...job.nice_to_have,
    ...job.responsibilities,
    ...(Array.isArray(job.requirements) ? job.requirements : [job.requirements || '']),
  ].join('\n');
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
