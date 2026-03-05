/**
 * Section Completeness Analyzer
 *
 * Checks for presence and quality of required resume sections.
 * Weight: 0.08
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { hasRequiredSections } from '../extractors/resume-text-extractor';

export class SectionCompletenessAnalyzer extends BaseAnalyzer {
  constructor() {
    super('section_completeness');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      if (!input.resume_json) {
        // Fallback: check text for section headers
        return this.analyzeTextSections(input.resume_text);
      }

      const sectionCheck = hasRequiredSections(input.resume_json);

      // Calculate score based on present sections
      const requiredSections = ['summary', 'skills', 'experience', 'education'];
      const score = (sectionCheck.present.length / requiredSections.length) * 100;

      // Check section quality (not just presence)
      const qualityBonus = this.assessSectionQuality(input.resume_json);
      const finalScore = Math.min(100, score + qualityBonus);

      const confidence = this.calculateConfidence({
        hasRequiredData: true,
        dataCompleteness: 1.0,
        parsingErrors: 0,
      });

      return this.createResult(
        finalScore,
        {
          present: sectionCheck.present,
          missing: sectionCheck.missing,
          qualityBonus,
          hasAll: sectionCheck.hasAll,
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(`Section analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze sections in plain text (fallback)
   */
  private analyzeTextSections(text: string): AnalyzerResult {
    const sectionHeaders = [
      'summary', 'profile', 'objective',
      'skills', 'technical skills', 'competencies',
      'experience', 'work experience', 'employment',
      'education', 'academic background',
    ];

    const foundSections: string[] = [];

    for (const header of sectionHeaders) {
      const pattern = new RegExp(`\\b${header}\\b`, 'i');
      if (pattern.test(text)) {
        foundSections.push(header);
      }
    }

    const score = (foundSections.length / 4) * 100; // Expect at least 4 sections

    return this.createResult(
      Math.min(100, score),
      {
        foundHeaders: foundSections,
        sectionsDetected: foundSections.length,
      },
      0.7 // Lower confidence for text-based detection
    );
  }

  /**
   * Assess quality of sections beyond just presence
   */
  private assessSectionQuality(resume: any): number {
    let bonus = 0;

    // Summary should be substantial (50-150 words)
    if (resume.summary) {
      const wordCount = resume.summary.split(/\s+/).length;
      if (wordCount >= 50 && wordCount <= 150) {
        bonus += 5;
      }
    }

    // Skills should have multiple items
    if (resume.skills) {
      const totalSkills = (resume.skills.technical?.length || 0) + (resume.skills.soft?.length || 0);
      if (totalSkills >= 5) {
        bonus += 5;
      }
    }

    // Experience should have achievements
    if (resume.experience && resume.experience.length > 0) {
      const hasAchievements = resume.experience.every((exp: any) =>
        exp.achievements && exp.achievements.length > 0
      );
      if (hasAchievements) {
        bonus += 5;
      }
    }

    // Education should have degree details
    if (resume.education && resume.education.length > 0) {
      const hasCompleteInfo = resume.education.every((edu: any) =>
        edu.degree && edu.institution
      );
      if (hasCompleteInfo) {
        bonus += 5;
      }
    }

    return bonus;
  }
}
