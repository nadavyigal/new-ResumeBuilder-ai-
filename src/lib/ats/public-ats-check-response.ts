import type { JobExtraction } from '@/lib/ats/types';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';
import { scoreSkillCoverage } from '@/lib/ats/skill-match';
import { assessExtractionQuality } from '@/lib/ats/extraction-quality';

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

  // A verdict is only worth as much as the requirements behind it. When the
  // extraction was thin or mostly page furniture, say so and withhold the
  // verdict rather than presenting a confident-looking "Skip" built out of
  // headings like "About us" (WP-45 S4).
  const extraction = fitSource
    ? assessExtractionQuality({
        requirements: [
          ...(fitSource.jobData?.must_have ?? []),
          ...(fitSource.jobData?.nice_to_have ?? []),
        ],
        jobText: fitSource.jobDescription,
        title: fitSource.jobData?.title ?? null,
      })
    : null;

  const fitAvailable = extraction ? extraction.available : true;

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
      available: fitAvailable,
      extractionQuality: extraction?.quality ?? 'medium',
      requirementCount: extraction?.credibleRequirements.length ?? missingKeywords.length,
      // Keys stay constant whether or not a verdict could be produced. A union
      // shape would force every consumer — including the iOS decoder — to
      // narrow before reading anything, which is how a field silently stops
      // being read.
      verdict: fitAvailable ? getFitVerdict(score.ats_score) : null,
      recoveryReason: fitAvailable ? null : extraction?.reason ?? null,
      scoreNote: FIT_SCORE_NOTE,
      // Only ever surface requirements that survived the credibility gate, so
      // "about" and "role objective" cannot reappear as things the user is
      // missing from their resume.
      topGaps: (extraction?.available ? missingKeywords : []).slice(0, 3),
      missingKeywords: extraction?.available ? missingKeywords : [],
    },
  };
}
