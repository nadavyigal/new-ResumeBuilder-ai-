/**
 * Section Header Translations
 *
 * Provides translations for resume section headers in multiple languages.
 * Used by templates to display headers in the appropriate language based on resume content.
 */

export interface SectionHeaderTranslations {
  professionalSummary: string;
  skills: string;
  technicalSkills: string;
  professionalSkills: string;
  softSkills: string;
  experience: string;
  education: string;
  certifications: string;
  projects: string;
  technical: string;
  professional: string;
}

export const SECTION_HEADERS: Record<'en' | 'he', SectionHeaderTranslations> = {
  en: {
    professionalSummary: 'Professional Summary',
    skills: 'Skills',
    technicalSkills: 'Technical Skills',
    professionalSkills: 'Professional Skills',
    softSkills: 'Soft Skills',
    experience: 'Experience',
    education: 'Education',
    certifications: 'Certifications',
    projects: 'Projects',
    technical: 'Technical',
    professional: 'Professional',
  },
  he: {
    professionalSummary: 'סיכום מקצועי',
    skills: 'כישורים',
    technicalSkills: 'כישורים טכניים',
    professionalSkills: 'כישורים מקצועיים',
    softSkills: 'כישורים רכים',
    experience: 'ניסיון תעסוקתי',
    education: 'השכלה',
    certifications: 'הסמכות',
    projects: 'פרויקטים',
    technical: 'טכני',
    professional: 'מקצועי',
  },
} as const;

/**
 * Get section headers for a specific language
 */
export function getSectionHeaders(languageCode: 'en' | 'he' | string): SectionHeaderTranslations {
  return SECTION_HEADERS[languageCode === 'he' ? 'he' : 'en'];
}
