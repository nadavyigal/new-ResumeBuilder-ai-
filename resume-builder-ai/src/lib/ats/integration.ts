/**
 * ATS v2 Integration Helper
 *
 * Prepares data and calls the ATS scoring engine from the optimization workflow
 */

import { scoreResume } from './index';
import type { ATSScoreInput, JobExtraction, FormatReport, ATSScoreOutput } from './types';
import type { OptimizedResume } from '@/lib/ai-optimizer';

/**
 * Extract keywords and requirements from job description text
 * This is a simple extraction - can be enhanced with AI/NLP later
 */
export function extractJobRequirements(jobDescriptionText: string, title: string = 'Position'): JobExtraction {
  const jdLower = jobDescriptionText.toLowerCase();

  // Common technical keywords that might appear in job descriptions
  const technicalKeywords = [
    'javascript', 'typescript', 'python', 'java', 'react', 'node.js', 'nodejs',
    'angular', 'vue', 'sql', 'nosql', 'mongodb', 'postgresql', 'aws', 'azure',
    'docker', 'kubernetes', 'git', 'ci/cd', 'agile', 'scrum', 'rest api',
    'graphql', 'html', 'css', 'tailwind', 'next.js', 'express', 'django',
    'flask', 'spring', 'microservices', 'cloud', 'devops', 'terraform',
  ];

  // Find keywords mentioned in the JD
  const foundKeywords = technicalKeywords.filter(keyword =>
    jdLower.includes(keyword)
  );

  // Split into must-have (mentioned multiple times or in requirements section)
  // and nice-to-have (mentioned once)
  const keywordCounts = foundKeywords.reduce((acc, keyword) => {
    const regex = new RegExp(keyword, 'gi');
    const matches = jobDescriptionText.match(regex);
    acc[keyword] = matches ? matches.length : 0;
    return acc;
  }, {} as Record<string, number>);

  const must_have = foundKeywords.filter(k => keywordCounts[k] >= 2);
  const nice_to_have = foundKeywords.filter(k => keywordCounts[k] === 1);

  // Extract responsibilities (simple approach: look for bullet points or "will" statements)
  const responsibilities: string[] = [];
  const lines = jobDescriptionText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) ||
      trimmed.toLowerCase().includes('you will') ||
      trimmed.toLowerCase().includes('responsible for')
    ) {
      responsibilities.push(trimmed.replace(/^[•\-*]\s*/, ''));
    }
  }

  return {
    title,
    must_have,
    nice_to_have,
    responsibilities: responsibilities.slice(0, 10), // Top 10
  };
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
