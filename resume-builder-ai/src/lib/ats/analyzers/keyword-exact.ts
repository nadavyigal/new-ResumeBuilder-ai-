/**
 * Keyword Exact Analyzer
 *
 * Analyzes exact keyword matches between resume and job description.
 * Must-have keywords weighted 2x, nice-to-have weighted 1x.
 * Weight: 0.22 (highest - most critical for ATS)
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { KEYWORD_THRESHOLDS } from '../config/thresholds';

export class KeywordExactAnalyzer extends BaseAnalyzer {
  constructor() {
    super('keyword_exact');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      // Extract keywords from both resume and JD
      const resumeKeywords = new Set(
        this.tokenize(input.resume_text).filter(
          word => word.length >= KEYWORD_THRESHOLDS.min_keyword_length
        )
      );

      // Must-have keywords (high priority)
      const mustHave = new Set(
        input.job_data.must_have
          .flatMap(skill => this.tokenize(skill))
          .filter(word => word.length >= KEYWORD_THRESHOLDS.min_keyword_length)
      );

      // Nice-to-have keywords (lower priority)
      const niceToHave = new Set(
        input.job_data.nice_to_have
          .flatMap(skill => this.tokenize(skill))
          .filter(word => word.length >= KEYWORD_THRESHOLDS.min_keyword_length)
      );

      // Calculate matches
      const mustHaveMatched = this.findMissing(mustHave, resumeKeywords);
      const mustHaveMatchedCount = mustHave.size - mustHaveMatched.length;

      const niceToHaveMatched = this.findMissing(niceToHave, resumeKeywords);
      const niceToHaveMatchedCount = niceToHave.size - niceToHaveMatched.length;

      // Weighted score calculation
      const mustHaveWeight = KEYWORD_THRESHOLDS.must_have_weight;
      const niceToHaveWeight = KEYWORD_THRESHOLDS.nice_to_have_weight;

      const totalPossiblePoints =
        mustHave.size * mustHaveWeight + niceToHave.size * niceToHaveWeight;

      const earnedPoints =
        mustHaveMatchedCount * mustHaveWeight +
        niceToHaveMatchedCount * niceToHaveWeight;

      const score = this.safeDivide(earnedPoints, totalPossiblePoints) * 100;

      // Confidence based on data quality
      const confidence = this.calculateConfidence({
        hasRequiredData: mustHave.size > 0 || niceToHave.size > 0,
        dataCompleteness: mustHave.size > 0 ? 1.0 : 0.7,
        parsingErrors: 0,
      });

      return this.createResult(
        score,
        {
          matched: [
            ...Array.from(mustHave).filter(kw => resumeKeywords.has(kw)),
            ...Array.from(niceToHave).filter(kw => resumeKeywords.has(kw)),
          ],
          missing: [...mustHaveMatched, ...niceToHaveMatched],
          mustHaveMatched: mustHaveMatchedCount,
          mustHaveTotal: mustHave.size,
          niceToHaveMatched: niceToHaveMatchedCount,
          niceToHaveTotal: niceToHave.size,
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(`Keyword analysis failed: ${(error as Error).message}`);
    }
  }
}
