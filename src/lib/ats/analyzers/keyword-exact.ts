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
import { scoreSkillListMatch } from '../skill-match';

export class KeywordExactAnalyzer extends BaseAnalyzer {
  constructor() {
    super('keyword_exact');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      const mustHaveSkills = input.job_data.must_have.filter(Boolean);
      const niceToHaveSkills = input.job_data.nice_to_have.filter(Boolean);

      const mustHaveResult = scoreSkillListMatch(mustHaveSkills, input.resume_text);
      const niceToHaveResult = scoreSkillListMatch(niceToHaveSkills, input.resume_text);

      const mustHaveWeight = KEYWORD_THRESHOLDS.must_have_weight;
      const niceToHaveWeight = KEYWORD_THRESHOLDS.nice_to_have_weight;

      const totalPossiblePoints =
        mustHaveSkills.length * mustHaveWeight + niceToHaveSkills.length * niceToHaveWeight;

      let score: number;
      if (totalPossiblePoints === 0) {
        score = 50;
      } else {
        const earnedPoints =
          mustHaveResult.matched.length * mustHaveWeight +
          niceToHaveResult.matched.length * niceToHaveWeight;
        score = this.safeDivide(earnedPoints, totalPossiblePoints) * 100;
      }

      const confidence = this.calculateConfidence({
        hasRequiredData: mustHaveSkills.length > 0 || niceToHaveSkills.length > 0,
        dataCompleteness: mustHaveSkills.length > 0 ? 1.0 : 0.7,
        parsingErrors: 0,
      });

      return this.createResult(
        score,
        {
          matched: [...mustHaveResult.matched, ...niceToHaveResult.matched],
          missing: [...mustHaveResult.missing, ...niceToHaveResult.missing].slice(0, 20),
          mustHaveMatched: mustHaveResult.matched.length,
          mustHaveTotal: mustHaveSkills.length,
          niceToHaveMatched: niceToHaveResult.matched.length,
          niceToHaveTotal: niceToHaveSkills.length,
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(`Keyword analysis failed: ${(error as Error).message}`);
    }
  }
}
