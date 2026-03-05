/**
 * useSectionHeaders Hook
 *
 * Automatically detects the language of resume content and returns
 * the appropriate section header translations.
 */

import { useMemo } from 'react';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { getSectionHeaders, type SectionHeaderTranslations } from '@/lib/i18n/section-headers';

/**
 * Detect if text contains Hebrew characters
 */
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Detect language from resume data
 */
function detectResumeLanguage(resumeData: OptimizedResume | any): 'he' | 'en' {
  // Check multiple fields for Hebrew content
  const fieldsToCheck = [
    resumeData?.contact?.name || '',
    resumeData?.summary || '',
    resumeData?.skills?.technical?.join(' ') || '',
    resumeData?.skills?.soft?.join(' ') || '',
    resumeData?.experience?.[0]?.title || '',
    resumeData?.experience?.[0]?.company || '',
  ];

  // If any field contains Hebrew, consider it a Hebrew resume
  const isHebrew = fieldsToCheck.some(field => containsHebrew(field));
  return isHebrew ? 'he' : 'en';
}

/**
 * Hook to get section headers based on resume language
 *
 * @param resumeData - The resume data object
 * @param languagePreference - Optional language override ('auto', 'hebrew', 'english')
 * @returns Section header translations in the detected language
 */
export function useSectionHeaders(
  resumeData: OptimizedResume | any,
  languagePreference?: 'auto' | 'hebrew' | 'english'
): SectionHeaderTranslations {
  return useMemo(() => {
    // Handle language preference override
    if (languagePreference === 'hebrew') {
      return getSectionHeaders('he');
    }
    if (languagePreference === 'english') {
      return getSectionHeaders('en');
    }

    // Auto-detect from content
    const detectedLanguage = detectResumeLanguage(resumeData);
    return getSectionHeaders(detectedLanguage);
  }, [resumeData, languagePreference]);
}
