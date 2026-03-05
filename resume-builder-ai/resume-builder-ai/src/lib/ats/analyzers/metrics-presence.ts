/**
 * Metrics Presence Analyzer
 *
 * Detects quantified achievements in resume (%, $, #, timeframes).
 * Demonstrates measurable impact.
 * Weight: 0.10
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { METRICS_THRESHOLDS } from '../config/thresholds';
import { countPatternMatches, extractPatternMatches } from '../utils/text-utils';

export class MetricsAnalyzer extends BaseAnalyzer {
  constructor() {
    super('metrics_presence');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      // Count metrics in resume
      const metricsFound = this.findMetrics(input.resume_text);
      const totalMetrics = metricsFound.length;

      // Count metrics per experience role
      const metricsPerRole = input.resume_json
        ? this.countMetricsPerRole(input.resume_json)
        : [];

      // Calculate score based on total metrics and distribution
      const idealTotal = input.resume_json
        ? input.resume_json.experience.length * METRICS_THRESHOLDS.ideal_metrics_per_role
        : METRICS_THRESHOLDS.min_total_metrics;

      const coverageScore = this.lerp(
        totalMetrics,
        0,
        Math.max(idealTotal, METRICS_THRESHOLDS.min_total_metrics)
      );

      // Bonus if metrics well-distributed across roles
      const distributionBonus = this.calculateDistributionBonus(metricsPerRole);

      let score = Math.min(100, coverageScore + distributionBonus);

      // Penalty if no metrics at all
      if (totalMetrics === 0) {
        score = 0;
      }

      const confidence = this.calculateConfidence({
        hasRequiredData: true,
        dataCompleteness: 1.0,
        parsingErrors: 0,
      });

      return this.createResult(
        score,
        {
          totalMetrics,
          examples: metricsFound.slice(0, 10),
          metricsPerRole,
          idealMetrics: idealTotal,
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(`Metrics analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Find all metrics in text
   */
  private findMetrics(text: string): string[] {
    const allMetrics: string[] = [];

    for (const pattern of METRICS_THRESHOLDS.metric_patterns) {
      const matches = extractPatternMatches(text, pattern);
      allMetrics.push(...matches);
    }

    return allMetrics;
  }

  /**
   * Count metrics per experience role
   */
  private countMetricsPerRole(resume: any): Array<{ role: string; count: number }> {
    if (!resume.experience || resume.experience.length === 0) {
      return [];
    }

    return resume.experience.map((exp: any) => {
      const roleText = [
        exp.title,
        exp.company,
        ...(exp.achievements || [])
      ].join(' ');

      const metricsCount = countPatternMatches(roleText, METRICS_THRESHOLDS.metric_patterns);

      return {
        role: `${exp.title} at ${exp.company}`,
        count: metricsCount,
      };
    });
  }

  /**
   * Calculate bonus for even distribution of metrics
   */
  private calculateDistributionBonus(metricsPerRole: Array<{ role: string; count: number }>): number {
    if (metricsPerRole.length === 0) return 0;

    // Check how many roles have at least one metric
    const rolesWithMetrics = metricsPerRole.filter(r => r.count > 0).length;
    const distributionRatio = rolesWithMetrics / metricsPerRole.length;

    // Bonus up to 20 points for good distribution
    return distributionRatio * 20;
  }
}
