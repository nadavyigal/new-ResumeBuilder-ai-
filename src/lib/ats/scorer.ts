/**
 * ATS Scorer - Convenience wrapper for approve-change route
 *
 * This file provides a simplified interface for rescoring resumes
 * after ATS tip implementation.
 */

import { scoreResume as scoreResumeMain, rescoreOptimization } from './index';
import { extractResumeText } from './extractors/resume-text-extractor';
import { extractJobData } from './extractors/jd-extractor';
import { analyzeFormatWithTemplate } from './extractors/format-analyzer';
import type { ATSScoreOutput } from './types';
import type { OptimizedResume } from '@/lib/ai-optimizer';

/**
 * Score a resume against a job description
 *
 * This is a simplified wrapper that takes resume and JD data objects
 * and returns the ATS score. Used by the approve-change route.
 *
 * @param resumeOptimizedData - Optimized resume JSON data
 * @param resumeOriginalData - Original resume JSON data (optional)
 * @param jobDescriptionData - Job description structured data
 * @param jobEmbeddings - Job description embeddings (optional)
 * @returns ATS score output with original and optimized scores
 */
export async function scoreResume(
  resumeOptimizedData: Record<string, unknown>,
  resumeOriginalData: Record<string, unknown>,
  jobDescriptionData: any,
  jobEmbeddings?: number[] | null
): Promise<ATSScoreOutput> {
  void jobEmbeddings;

  // Extract text from resume JSON
  const resumeOptimized = resumeOptimizedData as unknown as OptimizedResume;
  const resumeOriginal = resumeOriginalData as unknown as OptimizedResume;

  const resumeOptimizedText = extractResumeText(resumeOptimized);
  const resumeOriginalText = resumeOriginalData
    ? extractResumeText(resumeOriginal)
    : resumeOptimizedText;

  // Extract job description text
  const jobText = jobDescriptionData.raw_text || jobDescriptionData.clean_text || '';

  // Use existing job data extraction or create from text
  const jobExtraction = jobDescriptionData.title
    ? jobDescriptionData
    : extractJobData(jobText);

  // Generate format report
  const formatReport = analyzeFormatWithTemplate(resumeOptimized, null);

  // Call main scorer
  return scoreResumeMain({
    resume_original_text: resumeOriginalText,
    resume_optimized_text: resumeOptimizedText,
    job_clean_text: jobText,
    job_extracted_json: jobExtraction,
    format_report: formatReport,
    resume_original_json: resumeOriginalData ? resumeOriginal : undefined,
    resume_optimized_json: resumeOptimized,
  });
}

// Re-export for convenience
export { rescoreOptimization };
