/**
 * ATS v2 Integration Helper
 *
 * Prepares data and calls the ATS scoring engine from the optimization workflow
 */

import { scoreResume } from './index';
import type { ATSScoreInput, JobExtraction, FormatReport, ATSScoreOutput } from './types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { extractJobData } from './extractors/jd-extractor';

/**
 * Extract keywords and requirements from job description text
 * @deprecated Use extractJobData from jd-extractor instead
 */
export function extractJobRequirements(jobDescriptionText: string, title: string = 'Position'): JobExtraction {
  // Use the enhanced extractor instead of the simple one
  return extractJobData(jobDescriptionText, { title });
}

/**
 * Generate a basic format report for a resume
 * Since we're working with text/JSON, we'll create safe defaults
 */
export function generateFormatReport(resumeText: string): FormatReport {
  // Simple heuristics for format analysis
  const hasMultipleTabs = (resumeText.match(/\t/g) || []).length > 10;
  const hasTableMarkers = /\|.*\|.*\|/.test(resumeText);

  return {
    has_tables: hasTableMarkers,
    has_images: false, // We're working with text
    has_headers_footers: false,
    has_nonstandard_fonts: false,
    has_odd_glyphs: /[^\x00-\x7F]/.test(resumeText), // Non-ASCII chars
    has_multi_column: hasMultipleTabs,
    format_safety_score: 85, // Default: reasonably safe
    issues: hasTableMarkers ? ['Tables detected'] : [],
  };
}

/**
 * Convert OptimizedResume JSON to plain text for ATS analysis
 */
export function resumeJsonToText(resume: OptimizedResume): string {
  const sections: string[] = [];

  // Add contact info
  if (resume.contact) {
    sections.push(resume.contact.name);
    sections.push(`${resume.contact.email} | ${resume.contact.phone} | ${resume.contact.location}`);
    if (resume.contact.linkedin) sections.push(`LinkedIn: ${resume.contact.linkedin}`);
    if (resume.contact.portfolio) sections.push(`Portfolio: ${resume.contact.portfolio}`);
    sections.push('');
  }

  // Add summary
  if (resume.summary) {
    sections.push('SUMMARY');
    sections.push(resume.summary);
    sections.push('');
  }

  // Add skills
  if (resume.skills) {
    sections.push('SKILLS');
    if (resume.skills.technical && resume.skills.technical.length > 0) {
      sections.push('Technical: ' + resume.skills.technical.join(', '));
    }
    if (resume.skills.soft && resume.skills.soft.length > 0) {
      sections.push('Soft Skills: ' + resume.skills.soft.join(', '));
    }
    sections.push('');
  }

  // Add experience
  if (resume.experience && resume.experience.length > 0) {
    sections.push('EXPERIENCE');
    for (const exp of resume.experience) {
      sections.push(`${exp.title} at ${exp.company}`);
      sections.push(`${exp.location} | ${exp.startDate} - ${exp.endDate}`);
      if (exp.achievements && exp.achievements.length > 0) {
        for (const achievement of exp.achievements) {
          sections.push(`• ${achievement}`);
        }
      }
      sections.push('');
    }
  }

  // Add education
  if (resume.education && resume.education.length > 0) {
    sections.push('EDUCATION');
    for (const edu of resume.education) {
      sections.push(`${edu.degree} - ${edu.institution}`);
      sections.push(`${edu.location} | ${edu.graduationDate}`);
      if (edu.gpa) sections.push(`GPA: ${edu.gpa}`);
      sections.push('');
    }
  }

  // Add certifications
  if (resume.certifications && resume.certifications.length > 0) {
    sections.push('CERTIFICATIONS');
    for (const cert of resume.certifications) {
      sections.push(`• ${cert}`);
    }
    sections.push('');
  }

  // Add projects
  if (resume.projects && resume.projects.length > 0) {
    sections.push('PROJECTS');
    for (const project of resume.projects) {
      sections.push(project.name);
      sections.push(project.description);
      sections.push(`Technologies: ${project.technologies.join(', ')}`);
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Main integration function: Score a resume optimization using ATS v2
 */
export async function scoreOptimization(params: {
  resumeOriginalText: string;
  resumeOptimizedJson: OptimizedResume;
  jobDescriptionText: string;
  jobTitle?: string;
}): Promise<ATSScoreOutput> {
  const {
    resumeOriginalText,
    resumeOptimizedJson,
    jobDescriptionText,
    jobTitle = 'Position',
  } = params;

  // Convert optimized resume JSON to text
  const resumeOptimizedText = resumeJsonToText(resumeOptimizedJson);

  // Extract job requirements
  const jobExtraction = extractJobRequirements(jobDescriptionText, jobTitle);

  // Generate format reports
  const formatReport = generateFormatReport(resumeOriginalText);

  // Prepare ATS input
  const atsInput: ATSScoreInput = {
    resume_original_text: resumeOriginalText,
    resume_optimized_text: resumeOptimizedText,
    job_clean_text: jobDescriptionText,
    job_extracted_json: jobExtraction,
    format_report: formatReport,
    resume_original_json: undefined, // Don't have structured original
    resume_optimized_json: resumeOptimizedJson,
  };

  // Call ATS scorer
  const result = await scoreResume(atsInput);

  return result;
}
