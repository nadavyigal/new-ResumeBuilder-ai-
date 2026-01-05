/**
 * Base Analyzer abstract class
 *
 * All ATS sub-score analyzers extend this class and implement the analyze() method.
 * This provides a consistent interface and shared utility methods.
 */

import type {
  Analyzer,
  AnalyzerInput,
  AnalyzerResult,
  AnalyzerEvidence,
  SubScoreKey,
} from '../types';
import { SUB_SCORE_WEIGHTS } from '../config/weights';

/**
 * Abstract base class for all ATS analyzers
 */
export abstract class BaseAnalyzer implements Analyzer {
  /** Unique name for this analyzer */
  public readonly name: SubScoreKey;

  /** Weight of this analyzer in final score */
  public readonly weight: number;

  constructor(name: SubScoreKey) {
    this.name = name;
    this.weight = SUB_SCORE_WEIGHTS[name];
  }

  /**
   * Main analysis method - must be implemented by subclasses
   */
  abstract analyze(input: AnalyzerInput): Promise<AnalyzerResult>;

  /**
   * Helper: Normalize score to 0-100 range
   */
  protected normalizeScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Helper: Create a successful analyzer result
   */
  protected createResult(
    score: number,
    evidence: AnalyzerEvidence,
    confidence: number = 1.0,
    warnings: string[] = []
  ): AnalyzerResult {
    return {
      score: this.normalizeScore(score),
      evidence,
      confidence: Math.max(0, Math.min(1, confidence)),
      warnings,
    };
  }

  /**
   * Helper: Create a failed analyzer result (with low confidence)
   */
  protected createFailedResult(
    error: string,
    partialScore: number = 0
  ): AnalyzerResult {
    return {
      score: this.normalizeScore(partialScore),
      evidence: { error },
      confidence: 0.0,
      warnings: [error],
    };
  }

  /**
   * Helper: Normalize text for comparison
   */
  protected normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')       // Collapse multiple spaces
      .trim();
  }

  /**
   * Helper: Tokenize text into words
   */
  protected tokenize(text: string): string[] {
    return this.normalizeText(text)
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Helper: Extract n-grams from text
   */
  protected extractNgrams(text: string, n: number): string[] {
    const tokens = this.tokenize(text);
    if (tokens.length < n) return [];

    const ngrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  /**
   * Helper: Calculate Jaccard similarity between two sets
   */
  protected jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Helper: Calculate overlap percentage (set1 ∩ set2 / set1)
   */
  protected overlapPercentage(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return (intersection.size / set1.size) * 100;
  }

  /**
   * Helper: Find missing elements from set1 not in set2
   */
  protected findMissing(set1: Set<string>, set2: Set<string>): string[] {
    return [...set1].filter(x => !set2.has(x));
  }

  /**
   * Helper: Check if text contains any of the given phrases
   */
  protected containsAny(text: string, phrases: string[]): boolean {
    const normalized = this.normalizeText(text);
    return phrases.some(phrase => {
      const normalizedPhrase = this.normalizeText(phrase);
      return normalized.includes(normalizedPhrase);
    });
  }

  /**
   * Helper: Count matches of patterns in text
   */
  protected countMatches(text: string, patterns: RegExp[]): number {
    return patterns.reduce((count, pattern) => {
      const matches = text.match(new RegExp(pattern.source, 'g'));
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Helper: Extract all matches of a pattern from text
   */
  protected extractMatches(text: string, pattern: RegExp): string[] {
    const matches = text.match(new RegExp(pattern.source, 'g'));
    return matches || [];
  }

  /**
   * Helper: Calculate confidence based on data quality
   */
  protected calculateConfidence(params: {
    hasRequiredData: boolean;
    dataCompleteness: number;  // 0-1
    parsingErrors: number;
  }): number {
    const { hasRequiredData, dataCompleteness, parsingErrors } = params;

    if (!hasRequiredData) return 0.0;

    let confidence = dataCompleteness;

    // Reduce confidence for parsing errors
    if (parsingErrors > 0) {
      confidence *= Math.max(0.3, 1 - (parsingErrors * 0.1));
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Helper: Safe division (returns 0 if denominator is 0)
   */
  protected safeDivide(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Helper: Linear interpolation for scoring
   */
  protected lerp(value: number, min: number, max: number): number {
    if (value <= min) return 0;
    if (value >= max) return 100;
    return ((value - min) / (max - min)) * 100;
  }

  /**
   * Helper: Log analyzer execution for debugging
   */
  protected log(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_ATS) {
      console.log(`[${this.name}] ${message}`, data || '');
    }
  }
}
