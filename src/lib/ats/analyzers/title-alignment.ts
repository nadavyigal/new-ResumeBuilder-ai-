/**
 * Title Alignment Analyzer
 *
 * Analyzes alignment between resume job titles and target job title.
 * Checks seniority level matching.
 * Weight: 0.10
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { extractJobTitles } from '../extractors/resume-text-extractor';
import { editSimilarity } from '../utils/text-utils';

export class TitleAlignmentAnalyzer extends BaseAnalyzer {
  constructor() {
    super('title_alignment');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      const targetTitle = input.job_data.title;
      const targetSeniority = input.job_data.seniority || 'mid';

      if (!targetTitle) {
        return this.createResult(50, { error: 'No target title available' }, 0.5);
      }

      // Extract titles from resume
      const resumeTitles = input.resume_json
        ? extractJobTitles(input.resume_json)
        : this.extractTitlesFromText(input.resume_text);

      if (resumeTitles.length === 0) {
        return this.createResult(20, { error: 'No job titles found in resume' }, 0.6);
      }

      // Find best matching title
      const titleMatches = resumeTitles.map(title => ({
        title,
        similarity: this.calculateTitleSimilarity(title, targetTitle),
        seniorityMatch: this.checkSeniorityMatch(title, targetSeniority),
      }));

      titleMatches.sort((a, b) => b.similarity - a.similarity);
      const bestMatch = titleMatches[0];

      // Calculate score
      let score = bestMatch.similarity * 100;

      // Boost if in latest role (most recent experience)
      const latestTitle = resumeTitles[0];
      if (latestTitle === bestMatch.title) {
        score = Math.min(100, score + 10);
      }

      // Penalty if seniority mismatch
      if (!bestMatch.seniorityMatch) {
        score = Math.max(0, score - 15);
      }

      const confidence = this.calculateConfidence({
        hasRequiredData: true,
        dataCompleteness: resumeTitles.length >= 2 ? 1.0 : 0.8,
        parsingErrors: 0,
      });

      return this.createResult(
        score,
        {
          targetTitle,
          targetSeniority,
          bestMatch: {
            title: bestMatch.title,
            similarity: Math.round(bestMatch.similarity * 100),
            seniorityMatch: bestMatch.seniorityMatch,
          },
          allTitles: resumeTitles,
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(`Title analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Calculate similarity between two job titles
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    // Normalize titles
    const norm1 = this.normalizeTitle(title1);
    const norm2 = this.normalizeTitle(title2);

    // Exact match
    if (norm1 === norm2) return 1.0;

    // Edit similarity
    const editSim = editSimilarity(norm1, norm2);

    // Token overlap
    const tokens1 = new Set(norm1.split(' '));
    const tokens2 = new Set(norm2.split(' '));
    const tokenOverlap = this.jaccardSimilarity(tokens1, tokens2);

    // Weighted average
    return editSim * 0.5 + tokenOverlap * 0.5;
  }

  /**
   * Normalize job title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\b(jr|sr|senior|junior|lead|staff|principal)\b/g, '') // Remove seniority markers
      .replace(/\b(i|ii|iii|iv|v|1|2|3|4|5)\b/g, '') // Remove level numbers
      // Unicode-aware. \w is ASCII-only, so [^\w\s] deleted every Hebrew
      // character and normalised every Hebrew title to the empty string —
      // which then compared EQUAL to every other Hebrew title and returned a
      // perfect 1.0 similarity for completely unrelated roles (WP-45).
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if seniority levels match
   */
  private checkSeniorityMatch(resumeTitle: string, targetSeniority: string): boolean {
    const resumeSeniority = this.detectSeniority(resumeTitle);

    // Map seniority to levels
    const seniorityLevels: Record<string, number> = {
      entry: 1,
      junior: 1,
      mid: 2,
      senior: 3,
      lead: 4,
      staff: 4,
      principal: 5,
      executive: 6,
    };

    const resumeLevel = seniorityLevels[resumeSeniority] || 2;
    const targetLevel = seniorityLevels[targetSeniority] || 2;

    // Allow +/- 1 level difference
    return Math.abs(resumeLevel - targetLevel) <= 1;
  }

  /**
   * Detect seniority from title
   */
  private detectSeniority(title: string): string {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('principal') || titleLower.includes('director')) return 'principal';
    if (titleLower.includes('staff')) return 'staff';
    if (titleLower.includes('lead') || titleLower.includes('senior') || titleLower.includes('sr')) return 'senior';
    if (titleLower.includes('junior') || titleLower.includes('jr') || titleLower.includes('entry')) return 'entry';

    return 'mid';
  }

  /**
   * Extract titles from plain text (fallback)
   */
  private extractTitlesFromText(text: string): string[] {
    const titles: string[] = [];

    // Common title patterns.
    //
    // The first pattern relies on capitalisation to tell a job title from
    // ordinary prose. Hebrew has no case, so it matched nothing and the
    // analyzer fell through to its "no job titles found" floor of 20 for every
    // Hebrew resume — including ones whose title was an exact match for the
    // role. The third pattern covers caseless scripts by anchoring on the same
    // "<title> at <company>" shape instead of on capitalisation (WP-45).
    const patterns = [
      /(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\s*(?:at|@|\||,)/gm,
      /(?:position|role|title):\s*([^\n]+)/gi,
      // Caseless scripts, currently Hebrew. Add further ranges here rather
      // than loosening the Latin pattern, which would start matching prose.
      // Space and tab only, never \n: a plain \s here lets the lazy quantifier
      // run across lines and swallow the section heading above the role
      // ("ניסיון תעסוקתי\n\nמהנדס תוכנה" came back as a single title).
      /(?:^|\n)([\u0590-\u05FF][\u0590-\u05FF \t'"-]{1,58}?)[ \t]*(?:at|@|\|)/gmu,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          titles.push(match[1].trim());
        }
      }
    }

    return titles.slice(0, 10); // Limit to 10 titles
  }
}
