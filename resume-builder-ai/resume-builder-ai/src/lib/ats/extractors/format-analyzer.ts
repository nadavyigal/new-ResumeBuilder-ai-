/**
 * Format analyzer for ATS safety checks
 *
 * Analyzes resume format for ATS compatibility risks
 * (tables, multi-column, images, non-standard fonts, etc.)
 */

import type { FormatReport, OptimizedResume } from '../types';
import { FORMAT_THRESHOLDS, PENALTY_THRESHOLDS } from '../config/thresholds';

/**
 * Analyze resume format for ATS safety
 *
 * Note: This is a basic implementation that checks known patterns.
 * For a production system, you'd want more sophisticated format detection,
 * potentially analyzing the original PDF/DOCX file structure.
 */
export function analyzeResumeFormat(resume: OptimizedResume, templateKey?: string | null): FormatReport {
  const issues: string[] = [];
  let formatScore: number = FORMAT_THRESHOLDS.base_format_score;

  // Check if template is known ATS-safe
  const isATSSafeTemplate = templateKey && (
    templateKey.includes('ats') ||
    templateKey.includes('minimal') ||
    templateKey.includes('simple')
  );

  // If using a known ATS-safe template, give benefit of doubt
  if (isATSSafeTemplate) {
    return {
      has_tables: false,
      has_images: false,
      has_headers_footers: false,
      has_nonstandard_fonts: false,
      has_odd_glyphs: false,
      has_multi_column: false,
      format_safety_score: 100,
      issues: [],
    };
  }

  // Check for multi-column indicators (limited detection from JSON)
  // In a real system, this would analyze the original document
  const hasMultiColumn = false;  // Can't reliably detect from JSON
  if (hasMultiColumn) {
    formatScore -= FORMAT_THRESHOLDS.multi_column_penalty;
    issues.push('Multi-column layout detected - may cause parsing issues');
  }

  // Check for tables (limited detection)
  const hasTables = false;  // Can't reliably detect from JSON
  if (hasTables) {
    formatScore -= FORMAT_THRESHOLDS.tables_penalty;
    issues.push('Tables detected - ATS may not parse correctly');
  }

  // Check for images (limited detection)
  const hasImages = false;  // Can't reliably detect from JSON
  if (hasImages) {
    formatScore -= FORMAT_THRESHOLDS.images_penalty;
    issues.push('Images detected - will be ignored by ATS');
  }

  // Check for headers/footers (limited detection)
  const hasHeadersFooters = false;  // Can't reliably detect from JSON
  if (hasHeadersFooters) {
    formatScore -= FORMAT_THRESHOLDS.headers_footers_penalty;
    issues.push('Headers/footers detected - content may be lost');
  }

  // Check for non-standard fonts (can't detect from JSON)
  const hasNonstandardFonts = false;
  if (hasNonstandardFonts) {
    formatScore -= FORMAT_THRESHOLDS.nonstandard_fonts_penalty;
    issues.push('Non-standard fonts detected - may not render correctly');
  }

  // Check for unusual characters/glyphs in content
  const hasOddGlyphs = detectOddGlyphs(resume);
  if (hasOddGlyphs) {
    formatScore -= 5;
    issues.push('Unusual characters detected - may cause encoding issues');
  }

  // Ensure score stays in valid range
  formatScore = Math.max(0, Math.min(100, formatScore));

  return {
    has_tables: hasTables,
    has_images: hasImages,
    has_headers_footers: hasHeadersFooters,
    has_nonstandard_fonts: hasNonstandardFonts,
    has_odd_glyphs: hasOddGlyphs,
    has_multi_column: hasMultiColumn,
    format_safety_score: formatScore,
    issues,
  };
}

/**
 * Detect unusual characters that might cause ATS parsing issues
 */
function detectOddGlyphs(resume: OptimizedResume): boolean {
  // Collect all text from resume
  const allText = [
    resume.summary || '',
    resume.contact?.name || '',
    resume.contact?.email || '',
    ...(resume.skills?.technical || []),
    ...(resume.skills?.soft || []),
    ...(resume.experience || []).flatMap(exp => [
      exp.title || '',
      exp.company || '',
      ...(exp.achievements || []),
    ]),
    ...(resume.education || []).flatMap(edu => [
      edu.degree || '',
      edu.institution || '',
    ]),
    ...(resume.certifications || []),
    ...(resume.projects || []).flatMap(proj => [
      proj.name || '',
      proj.description || '',
    ]),
  ].join(' ');

  // Pattern for unusual characters (extended ASCII, emoji, special symbols)
  const oddGlyphsPattern = /[^\x00-\x7F\u00A0-\u00FF\u0100-\u017F\u0180-\u024F]/;

  return oddGlyphsPattern.test(allText);
}

/**
 * Get format recommendations based on analysis
 */
export function getFormatRecommendations(report: FormatReport): string[] {
  const recommendations: string[] = [];

  if (report.format_safety_score < 70) {
    recommendations.push('Consider switching to an ATS-safe template (single column, no graphics)');
  }

  if (report.has_tables) {
    recommendations.push('Remove tables and use simple lists or text formatting instead');
  }

  if (report.has_images) {
    recommendations.push('Remove images, logos, and graphics - they won\'t be read by ATS');
  }

  if (report.has_headers_footers) {
    recommendations.push('Remove headers and footers - move all content to main body');
  }

  if (report.has_multi_column) {
    recommendations.push('Use single-column layout for better ATS parsing');
  }

  if (report.has_nonstandard_fonts) {
    recommendations.push('Use standard fonts (Arial, Calibri, Times New Roman)');
  }

  if (report.has_odd_glyphs) {
    recommendations.push('Replace special characters and emojis with standard ASCII text');
  }

  if (recommendations.length === 0) {
    recommendations.push('Format looks ATS-safe - no major issues detected');
  }

  return recommendations;
}

/**
 * Determine if format is high-risk for ATS
 */
export function isHighRiskFormat(report: FormatReport): boolean {
  return report.format_safety_score < PENALTY_THRESHOLDS.format_risk_threshold;
}

/**
 * Calculate format improvement score potential
 */
export function calculateFormatImprovementPotential(report: FormatReport): number {
  // Maximum score is 100, current is format_safety_score
  return 100 - report.format_safety_score;
}

/**
 * Enhanced format analysis with template metadata
 *
 * This version uses template information to make better judgments
 */
export function analyzeFormatWithTemplate(
  resume: OptimizedResume,
  templateKey: string | null,
  templateMetadata?: {
    family?: string;
    is_ats_safe?: boolean;
    has_columns?: boolean;
    has_graphics?: boolean;
  }
): FormatReport {
  // If template metadata indicates ATS-safe, trust it
  if (templateMetadata?.is_ats_safe) {
    return {
      has_tables: false,
      has_images: false,
      has_headers_footers: false,
      has_nonstandard_fonts: false,
      has_odd_glyphs: detectOddGlyphs(resume),
      has_multi_column: false,
      format_safety_score: 95,  // Very high, but not perfect in case of odd glyphs
      issues: detectOddGlyphs(resume) ? ['Unusual characters detected in content'] : [],
    };
  }

  // Use metadata to inform analysis
  const report = analyzeResumeFormat(resume, templateKey);

  // Adjust based on template metadata
  if (templateMetadata) {
    if (templateMetadata.has_columns) {
      report.has_multi_column = true;
      report.format_safety_score -= FORMAT_THRESHOLDS.multi_column_penalty;
      report.issues.push('Template uses multi-column layout');
    }

    if (templateMetadata.has_graphics) {
      report.has_images = true;
      report.format_safety_score -= FORMAT_THRESHOLDS.images_penalty;
      report.issues.push('Template includes decorative graphics');
    }

    // Clamp score
    report.format_safety_score = Math.max(0, Math.min(100, report.format_safety_score));
  }

  return report;
}
