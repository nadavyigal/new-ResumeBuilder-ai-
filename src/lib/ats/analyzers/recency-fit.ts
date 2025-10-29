/**
 * Recency Fit Analyzer
 *
 * Analyzes temporal relevance of skills and experience.
 * Rewards recent relevant experience, applies decay for old skills.
 * Weight: 0.08
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { RECENCY_THRESHOLDS } from '../config/thresholds';
import { getLatestRole } from '../extractors/resume-text-extractor';

export class RecencyAnalyzer extends BaseAnalyzer {
  constructor() {
    super('recency_fit');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      const currentDate = input.timestamp || new Date();

      if (!input.resume_json || !input.resume_json.experience || input.resume_json.experience.length === 0) {
        return this.createResult(50, { error: 'No experience data available' }, 0.6);
      }

      // Analyze latest role
      const latestRole = getLatestRole(input.resume_json);
      if (!latestRole) {
        return this.createResult(40, { error: 'Could not extract latest role' }, 0.5);
      }

      // Check if latest role contains most JD keywords
      const latestRoleBonus = this.checkLatestRoleRelevance(
        latestRole,
        input.job_data.must_have
      );

      // Calculate temporal decay for older roles
      const experienceDecay = this.calculateExperienceDecay(
        input.resume_json.experience,
        currentDate
      );

      // Base score from latest role relevance
      let score = latestRoleBonus;

      // Adjust based on overall experience recency
      const avgDecay = experienceDecay.reduce((sum, d) => sum + d.decayFactor, 0) / experienceDecay.length;
      score = score * avgDecay;

      // Cap score
      score = Math.min(100, score);

      const confidence = this.calculateConfidence({
        hasRequiredData: true,
        dataCompleteness: experienceDecay.length >= 2 ? 1.0 : 0.8,
        parsingErrors: 0,
      });

      return this.createResult(
        score,
        {
          latestRole: {
            title: latestRole.title,
            company: latestRole.company,
            keywordMatch: latestRoleBonus > 70,
          },
          experienceDecay: experienceDecay.map(d => ({
            role: d.role,
            yearsAgo: d.yearsAgo,
            decayFactor: Math.round(d.decayFactor * 100) / 100,
          })),
          avgRecency: Math.round(avgDecay * 100),
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(`Recency analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if latest role contains most relevant keywords
   */
  private checkLatestRoleRelevance(
    latestRole: { title: string; company: string; achievements: string[] },
    mustHaveSkills: string[]
  ): number {
    const roleText = [
      latestRole.title,
      latestRole.company,
      ...latestRole.achievements
    ].join(' ').toLowerCase();

    const roleTokens = new Set(this.tokenize(roleText));
    const mustHaveTokens = mustHaveSkills.flatMap(skill => this.tokenize(skill));

    const matchedCount = mustHaveTokens.filter(token => roleTokens.has(token)).length;
    const matchRatio = mustHaveTokens.length > 0 ? matchedCount / mustHaveTokens.length : 0;

    // Base score
    let score = matchRatio * 100;

    // Bonus if ratio exceeds threshold
    if (matchRatio >= RECENCY_THRESHOLDS.latest_role_keyword_ratio) {
      score = Math.min(100, score + RECENCY_THRESHOLDS.latest_role_boost);
    }

    return score;
  }

  /**
   * Calculate temporal decay for each experience role
   */
  private calculateExperienceDecay(
    experience: any[],
    currentDate: Date
  ): Array<{ role: string; yearsAgo: number; decayFactor: number }> {
    return experience.map((exp, index) => {
      const yearsAgo = this.estimateYearsAgo(exp, index, currentDate);
      const decayFactor = this.calculateDecayFactor(yearsAgo);

      return {
        role: `${exp.title} at ${exp.company}`,
        yearsAgo,
        decayFactor,
      };
    });
  }

  /**
   * Estimate years ago for an experience entry
   */
  private estimateYearsAgo(exp: any, index: number, currentDate: Date): number {
    // Try to parse endDate
    if (exp.endDate && exp.endDate.toLowerCase() !== 'present') {
      const endYear = this.extractYear(exp.endDate);
      if (endYear) {
        return currentDate.getFullYear() - endYear;
      }
    }

    // If current role (index 0), assume 0 years ago
    if (index === 0) return 0;

    // Estimate based on position (assume 2 years per role on average)
    return index * 2;
  }

  /**
   * Extract year from date string
   */
  private extractYear(dateStr: string): number | null {
    const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0], 10) : null;
  }

  /**
   * Calculate decay factor based on years ago
   */
  private calculateDecayFactor(yearsAgo: number): number {
    if (yearsAgo <= RECENCY_THRESHOLDS.decay_start_years) {
      return 1.0; // No decay
    }

    const excessYears = yearsAgo - RECENCY_THRESHOLDS.decay_start_years;
    const decay = Math.min(
      RECENCY_THRESHOLDS.max_decay_rate,
      excessYears * 0.1 // 10% decay per year beyond threshold
    );

    return 1.0 - decay;
  }
}
