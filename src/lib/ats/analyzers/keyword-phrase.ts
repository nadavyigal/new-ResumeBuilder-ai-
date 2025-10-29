/**
 * Keyword Phrase Analyzer
 *
 * Analyzes phrase-level matches using n-grams (3-6 words).
 * Captures context beyond single keywords.
 * Weight: 0.12
 */

import { BaseAnalyzer } from './base';
import type { AnalyzerInput, AnalyzerResult } from '../types';
import { KEYWORD_THRESHOLDS } from '../config/thresholds';

export class KeywordPhraseAnalyzer extends BaseAnalyzer {
  constructor() {
    super('keyword_phrase');
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    try {
      // Extract phrases from job responsibilities and requirements
      const jdPhrases = this.extractPhrases(input.job_text);
      const jdResponsibilityPhrases = input.job_data.responsibilities
        .flatMap(resp => this.extractPhrases(resp));

      const allJdPhrases = new Set([...jdPhrases, ...jdResponsibilityPhrases]);

      // Extract phrases from resume
      const resumePhrases = new Set(this.extractPhrases(input.resume_text));

      // Find matches
      const matched: string[] = [];
      const missing: string[] = [];

      for (const phrase of allJdPhrases) {
        if (resumePhrases.has(phrase) || this.hasSimilarPhrase(phrase, resumePhrases)) {
          matched.push(phrase);
        } else {
          missing.push(phrase);
        }
      }

      // Calculate score based on coverage
      const score = allJdPhrases.size > 0
        ? (matched.length / allJdPhrases.size) * 100
        : 50; // Neutral score if no phrases extracted

      const confidence = this.calculateConfidence({
        hasRequiredData: allJdPhrases.size > 0,
        dataCompleteness: allJdPhrases.size > 3 ? 1.0 : 0.7,
        parsingErrors: 0,
      });

      return this.createResult(
        score,
        {
          matched,
          missing: missing.slice(0, 10), // Top 10 missing phrases
          totalJdPhrases: allJdPhrases.size,
          matchedCount: matched.length,
        },
        confidence
      );
    } catch (error) {
      return this.createFailedResult(`Phrase analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract meaningful phrases from text using n-grams
   */
  private extractPhrases(text: string): string[] {
    const phrases = new Set<string>();

    // Extract n-grams of various sizes
    for (const n of KEYWORD_THRESHOLDS.ngram_sizes) {
      const ngrams = this.extractNgrams(text, n);

      // Filter for meaningful phrases (contains at least one noun/verb)
      for (const ngram of ngrams) {
        if (this.isMeaningfulPhrase(ngram)) {
          phrases.add(ngram);
        }
      }
    }

    return Array.from(phrases);
  }

  /**
   * Check if phrase is meaningful (not just common words)
   */
  private isMeaningfulPhrase(phrase: string): boolean {
    const commonWords = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will',
      'are', 'been', 'has', 'had', 'was', 'were', 'can', 'may', 'could',
      'would', 'should', 'must', 'being', 'about', 'into', 'through', 'during'
    ]);

    const words = phrase.split(' ');

    // At least one word should not be a common word
    return words.some(word => !commonWords.has(word));
  }

  /**
   * Check if a similar phrase exists in the set (fuzzy matching)
   */
  private hasSimilarPhrase(targetPhrase: string, phraseSet: Set<string>): boolean {
    // Check for partial matches or word order variations
    const targetWords = new Set(targetPhrase.split(' '));

    for (const phrase of phraseSet) {
      const phraseWords = new Set(phrase.split(' '));

      // Calculate word overlap
      const overlap = this.jaccardSimilarity(targetWords, phraseWords);

      // If >70% word overlap, consider it a match
      if (overlap > 0.7) {
        return true;
      }
    }

    return false;
  }
}
