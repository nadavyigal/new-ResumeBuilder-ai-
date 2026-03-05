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

export const SECTION_HEADERS: Record<"en" | "he", SectionHeaderTranslations> = {
  en: {
    professionalSummary: "Professional Summary",
    skills: "Skills",
    technicalSkills: "Technical Skills",
    professionalSkills: "Professional Skills",
    softSkills: "Soft Skills",
    experience: "Experience",
    education: "Education",
    certifications: "Certifications",
    projects: "Projects",
    technical: "Technical",
    professional: "Professional",
  },
  he: {
    professionalSummary: "\u05EA\u05E7\u05E6\u05D9\u05E8 \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9",
    skills: "\u05DB\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD",
    technicalSkills: "\u05DB\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05D8\u05DB\u05E0\u05D9\u05D9\u05DD",
    professionalSkills: "\u05DB\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9\u05D9\u05DD",
    softSkills: "\u05DB\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05E8\u05DB\u05D9\u05DD",
    experience: "\u05E0\u05D9\u05E1\u05D9\u05D5\u05DF",
    education: "\u05D4\u05E9\u05DB\u05DC\u05D4",
    certifications: "\u05D4\u05E1\u05DE\u05DB\u05D5\u05EA",
    projects: "\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8\u05D9\u05DD",
    technical: "\u05D8\u05DB\u05E0\u05D9",
    professional: "\u05DE\u05E7\u05E6\u05D5\u05E2\u05D9",
  },
} as const;

/**
 * Get section headers for a specific language
 */
export function getSectionHeaders(languageCode: "en" | "he" | string): SectionHeaderTranslations {
  return SECTION_HEADERS[languageCode === "he" ? "he" : "en"];
}
