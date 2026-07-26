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

      // `recency_json` carries work history recovered from a plain-text resume
      // when no structured JSON exists, so the original and optimized sides of
      // a comparison are both scored on real dates instead of one of them
      // falling back to the constant below (WP-45 D4).
      const resume = input.resume_json ?? input.recency_json;

      if (!resume || !resume.experience || resume.experience.length === 0) {
        return this.createResult(50, { error: 'No experience data available' }, 0.6);
      }

      // Analyze latest role
      const latestRole = getLatestRole(resume);
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
        resume.experience,
        currentDate
      );

      // How recent the experience is. This is what the subscore is named after
      // and it is the base of the score, not a multiplier on something else.
      const avgDecay = experienceDecay.reduce((sum, d) => sum + d.decayFactor, 0) / experienceDecay.length;

      // Relevance of the newest role MODULATES recency within a bounded band —
      // it never zeroes it.
      //
      // This was `latestRoleBonus * avgDecay`, which multiplied recency by the
      // share of the job's must-have keywords appearing in the newest role.
      // A candidate in a current role whose title and bullets happened not to
      // echo the job's keywords scored 0 on *recency*, and the real 2026-07-26
      // run did exactly that: 0, while the same resume scored the 50 fallback
      // through the free check because no structured JSON was available there.
      // Having MORE information about a resume made it score LOWER — a 5-point
      // drop between two endpoints for one unchanged document (WP-45 D7).
      //
      // Keyword overlap is already measured by keyword_exact at 0.25 weight,
      // nearly 3x this one, so multiplying it in here also double-counted it.
      const relevanceModifier =
        RECENCY_THRESHOLDS.relevance_floor +
        (1 - RECENCY_THRESHOLDS.relevance_floor) * (latestRoleBonus / 100);

      // Floor of relevance_floor and decay floor of (1 - max_decay_rate) put
      // the real range at 35..100, entirely at or above the 50 no-data
      // fallback for any current role. Learning more about a resume can now
      // only raise its score, never drop it.
      const score = Math.min(100, 100 * avgDecay * relevanceModifier);

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
