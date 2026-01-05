/**
 * Format Parseability Analyzer
 *
 * Analyzes resume format for ATS compatibility.
 * Wraps the format analyzer from extractors.
 * Weight: 0.14
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { analyzeFormatWithTemplate } from '../extractors/format-analyzer';

export class FormatAnalyzer extends BaseAnalyzer {
  constructor() {
    super('format_parseability');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      // Use provided format report if available, otherwise analyze
      let formatReport = input.format_report;

      if (!formatReport && input.resume_json) {
        formatReport = analyzeFormatWithTemplate(
          input.resume_json,
          null // No template key available in this context
        );
      }

      if (!formatReport) {
        return this.createResult(70, { error: 'No format data available' }, 0.6);
      }

      // Format safety score is already 0-100
      const score = formatReport.format_safety_score;

      // Collect detailed evidence
      const evidence: any = {
        score: formatReport.format_safety_score,
        issues: formatReport.issues,
        hasTables: formatReport.has_tables,
        hasImages: formatReport.has_images,
        hasMultiColumn: formatReport.has_multi_column,
        hasHeadersFooters: formatReport.has_headers_footers,
        hasNonstandardFonts: formatReport.has_nonstandard_fonts,
        hasOddGlyphs: formatReport.has_odd_glyphs,
      };

      // Warnings for major issues
      const warnings: string[] = [];
      if (formatReport.has_tables) warnings.push('Tables detected - ATS may not parse correctly');
      if (formatReport.has_images) warnings.push('Images detected - will be ignored by ATS');
      if (formatReport.has_multi_column) warnings.push('Multi-column layout may cause parsing issues');

      const confidence = this.calculateConfidence({
        hasRequiredData: true,
        dataCompleteness: 1.0,
        parsingErrors: 0,
      });

      return this.createResult(score, evidence, confidence, warnings);
    } catch (error) {
      return this.createFailedResult(`Format analysis failed: ${(error as Error).message}`);
    }
  }
}
