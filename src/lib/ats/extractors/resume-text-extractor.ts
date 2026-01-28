/**
 * Resume text extractor
 *
 * Converts structured resume JSON to plain text for ATS analysis
 */

import type { OptimizedResume } from '@/lib/ai-optimizer';

/**
 * Extract plain text from resume JSON structure
 */
export function extractResumeText(resume: OptimizedResume): string {
  const sections: string[] = [];

  // Contact information
  if (resume.contact?.name) {
    sections.push(resume.contact.name);
  }

  // Professional Summary
  if (resume.summary) {
    sections.push(resume.summary);
  }

  // Skills - Technical
  if (resume.skills?.technical && resume.skills.technical.length > 0) {
    sections.push(resume.skills.technical.join(', '));
  }

  // Skills - Soft
  if (resume.skills?.soft && resume.skills.soft.length > 0) {
    sections.push(resume.skills.soft.join(', '));
  }

  // Experience
  if (resume.experience && resume.experience.length > 0) {
    resume.experience.forEach(exp => {
      sections.push(exp.title || '');
      sections.push(exp.company || '');
      sections.push(exp.location || '');

      if (exp.achievements && exp.achievements.length > 0) {
        sections.push(...exp.achievements);
      }
    });
  }

  // Education
  if (resume.education && resume.education.length > 0) {
    resume.education.forEach(edu => {
      sections.push(edu.degree || '');
      sections.push(edu.institution || '');
      sections.push(edu.location || '');
    });
  }

  // Certifications
  if (resume.certifications && resume.certifications.length > 0) {
    sections.push(...resume.certifications);
  }

  // Projects
  if (resume.projects && resume.projects.length > 0) {
    resume.projects.forEach(project => {
      sections.push(project.name || '');
      sections.push(project.description || '');

      if (project.technologies && project.technologies.length > 0) {
        sections.push(project.technologies.join(', '));
      }
    });
  }

  // Join all sections with newlines, filter empty strings
  return sections
    .filter(section => section && section.trim().length > 0)
    .join('\n');
}

/**
 * Extract text from specific resume sections
 */
export function extractSectionText(resume: OptimizedResume, sectionName: string): string {
  switch (sectionName.toLowerCase()) {
    case 'summary':
      return resume.summary || '';

    case 'skills':
      return [
        ...(resume.skills?.technical || []),
        ...(resume.skills?.soft || []),
      ].join(', ');

    case 'technical_skills':
      return (resume.skills?.technical || []).join(', ');

    case 'soft_skills':
      return (resume.skills?.soft || []).join(', ');

    case 'experience':
      return (resume.experience || [])
        .flatMap(exp => [
          exp.title,
          exp.company,
          ...(exp.achievements || []),
        ])
        .filter(Boolean)
        .join('\n');

    case 'education':
      return (resume.education || [])
        .flatMap(edu => [edu.degree, edu.institution])
        .filter(Boolean)
        .join('\n');

    case 'certifications':
      return (resume.certifications || []).join('\n');

    case 'projects':
      return (resume.projects || [])
        .flatMap(proj => [proj.name, proj.description])
        .filter(Boolean)
        .join('\n');

    default:
      return '';
  }
}

/**
 * Get most recent experience role (first in array)
 */
export function getLatestRole(resume: OptimizedResume): {
  title: string;
  company: string;
  achievements: string[];
} | null {
  if (!resume.experience || resume.experience.length === 0) {
    return null;
  }

  const latest = resume.experience[0];
  return {
    title: latest.title || '',
    company: latest.company || '',
    achievements: latest.achievements || [],
  };
}

/**
 * Extract all job titles from resume
 */
export function extractJobTitles(resume: OptimizedResume): string[] {
  if (!resume.experience || resume.experience.length === 0) {
    return [];
  }

  return resume.experience
    .map(exp => exp.title)
    .filter(Boolean) as string[];
}

/**
 * Check if resume has required sections
 */
export function hasRequiredSections(resume: OptimizedResume): {
  hasAll: boolean;
  missing: string[];
  present: string[];
} {
  const present: string[] = [];
  const missing: string[] = [];

  if (resume.summary && resume.summary.trim().length > 0) {
    present.push('summary');
  } else {
    missing.push('summary');
  }

  if (resume.skills && (resume.skills.technical?.length || resume.skills.soft?.length)) {
    present.push('skills');
  } else {
    missing.push('skills');
  }

  if (resume.experience && resume.experience.length > 0) {
    present.push('experience');
  } else {
    missing.push('experience');
  }

  if (resume.education && resume.education.length > 0) {
    present.push('education');
  } else {
    missing.push('education');
  }

  return {
    hasAll: missing.length === 0,
    missing,
    present,
  };
}
