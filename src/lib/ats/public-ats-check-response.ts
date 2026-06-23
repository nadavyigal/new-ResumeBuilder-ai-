import type { JobExtraction } from '@/lib/ats/types';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';
import { scoreSkillCoverage } from '@/lib/ats/skill-match';

type FitVerdict = 'Strong' | 'Stretch' | 'Skip';

export interface FitSource {
  resumeText: string;
  jobData: JobExtraction;
  jobDescription?: string;
}

const FIT_SCORE_NOTE = 'Estimated fit vs this job, not a hiring guarantee.';

function getFitVerdict(overallScore: unknown): FitVerdict {
  const score = Number(overallScore);
  if (Number.isFinite(score) && score >= 75) return 'Strong';
  if (Number.isFinite(score) && score >= 50) return 'Stretch';
  return 'Skip';
}

function getMissingMustHave(source?: FitSource) {
  if (!source) return [];

  const resolvedJobData = buildJobDataFromExtractedJson(source.jobData, source.jobDescription);
  return scoreSkillCoverage(resolvedJobData.must_have, source.resumeText).missing;
}

export function buildPublicAtsCheckResponse(score: any, sessionId: string, remaining: number, fitSource?: FitSource) {
  const suggestions = Array.isArray(score.ats_suggestions) ? score.ats_suggestions : [];
  const topIssues = suggestions.slice(0, 3);
  const quickWins = Array.isArray(score.ats_quick_wins) ? score.ats_quick_wins : [];
  const missingKeywords = getMissingMustHave(fitSource);

  return {
    success: true,
    sessionId,
    score: {
      overall: score.ats_score,
      timestamp: score.created_at,
    },
    preview: {
      topIssues,
      totalIssues: suggestions.length,
      lockedCount: Math.max(0, suggestions.length - 3),
    },
    quickWins,
    checksRemaining: remaining,
    fit: {
      verdict: getFitVerdict(score.ats_score),
      scoreNote: FIT_SCORE_NOTE,
      topGaps: missingKeywords.slice(0, 3),
      missingKeywords,
    },
  };
}
