/**
 * Text processing utilities for ATS scoring
 *
 * Provides common text manipulation functions used across analyzers
 */

import type { NormalizedText } from '../types';
import { KEYWORD_THRESHOLDS } from '../config/thresholds';

/**
 * Normalize text for comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
}

/**
 * Tokenize text into words (filtered by minimum length)
 */
export function tokenize(text: string, minLength: number = KEYWORD_THRESHOLDS.min_keyword_length): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(word => word.length >= minLength);
}

/**
 * Extract n-grams from text
 */
export function extractNgrams(text: string, sizes: readonly number[] = KEYWORD_THRESHOLDS.ngram_sizes): string[] {
  const tokens = tokenize(text);
  const ngrams: string[] = [];

  for (const n of sizes) {
    if (tokens.length < n) continue;

    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
  }

  return ngrams;
}

/**
 * Fully normalize text with tokens and n-grams
 */
export function fullyNormalizeText(text: string): NormalizedText {
  return {
    original: text,
    normalized: normalizeText(text),
    tokens: tokenize(text),
    ngrams: extractNgrams(text),
  };
}

/**
 * Calculate Jaccard similarity between two sets of strings
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate overlap percentage (items in set1 that are also in set2)
 */
export function overlapPercentage(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  return (intersection.size / set1.size) * 100;
}

/**
 * Find items in set1 that are missing from set2
 */
export function findMissing<T>(set1: Set<T>, set2: Set<T>): T[] {
  return [...set1].filter(x => !set2.has(x));
}

/**
 * Count occurrences of patterns in text
 */
export function countPatternMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((count, pattern) => {
    const matches = text.match(new RegExp(pattern.source, 'g'));
    return count + (matches ? matches.length : 0);
  }, 0);
}

/**
 * Extract all matches of a pattern from text
 */
export function extractPatternMatches(text: string, pattern: RegExp): string[] {
  const matches = text.match(new RegExp(pattern.source, 'g'));
  return matches || [];
}

/**
 * Check if text contains any of the given phrases (case-insensitive, normalized)
 */
export function containsAnyPhrase(text: string, phrases: string[]): boolean {
  const normalized = normalizeText(text);
  return phrases.some(phrase => {
    const normalizedPhrase = normalizeText(phrase);
    return normalized.includes(normalizedPhrase);
  });
}

/**
 * Count how many phrases from the list appear in text
 */
export function countPhraseMatches(text: string, phrases: string[]): number {
  const normalized = normalizeText(text);
  return phrases.filter(phrase => {
    const normalizedPhrase = normalizeText(phrase);
    return normalized.includes(normalizedPhrase);
  }).length;
}

/**
 * Extract keywords from text (capitalized words, acronyms, technical terms, etc.)
 */
export function extractKeywords(text: string, maxKeywords: number = KEYWORD_THRESHOLDS.max_keywords): string[] {
  const keywords: string[] = [];

  // Extract capitalized terms (likely proper nouns, technologies)
  const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const capitalized = text.match(capitalizedPattern) || [];

  // Extract acronyms and technical terms (2+ uppercase letters)
  const acronymPattern = /\b[A-Z]{2,}\b/g;
  const acronyms = text.match(acronymPattern) || [];

  // Extract common technical terms and skills (lowercase or mixed case)
  const technicalTerms = [
    // Programming languages
    'javascript', 'typescript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'php', 'swift', 'kotlin', 'go', 'rust', 'scala',
    // Frontend
    'react', 'vue', 'angular', 'next\\.js', 'svelte', 'html', 'css', 'sass', 'tailwind', 'bootstrap',
    // Backend
    'node\\.js', 'express', 'django', 'flask', 'spring', 'laravel', '\\.net', 'asp\\.net',
    // Databases
    'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'dynamodb', 'cassandra',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'gitlab', 'github',
    // API & Architecture
    'rest api', 'graphql', 'grpc', 'microservices', 'serverless', 'api', 'websocket',
    // Methodologies
    'agile', 'scrum', 'kanban', 'devops', 'tdd', 'test-driven',
    // Soft skills
    'leadership', 'communication', 'problem-solving', 'teamwork', 'analytical', 'strategic',
  ];

  // Find all technical terms that appear in the text (case-insensitive)
  for (const term of technicalTerms) {
    const regex = new RegExp(term, 'gi');
    const matches = text.match(regex);
    if (matches) {
      // Preserve original casing from text
      keywords.push(...matches);
    }
  }

  // Combine capitalized words, acronyms, and technical terms
  keywords.push(...capitalized, ...acronyms);

  // Deduplicate (case-insensitive) and limit
  const uniqueKeywords = new Map<string, string>();
  for (const keyword of keywords) {
    const key = keyword.toLowerCase();
    if (!uniqueKeywords.has(key)) {
      uniqueKeywords.set(key, keyword);
    }
  }

  return Array.from(uniqueKeywords.values()).slice(0, maxKeywords);
}

/**
 * Calculate cosine similarity between two text strings using simple term frequency
 * (Fallback for when embeddings aren't available)
 */
export function simpleCosineimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  // Build term frequency vectors
  const allTerms = new Set([...tokens1, ...tokens2]);
  const freq1: Record<string, number> = {};
  const freq2: Record<string, number> = {};

  tokens1.forEach(token => {
    freq1[token] = (freq1[token] || 0) + 1;
  });

  tokens2.forEach(token => {
    freq2[token] = (freq2[token] || 0) + 1;
  });

  // Calculate cosine similarity
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const term of allTerms) {
    const f1 = freq1[term] || 0;
    const f2 = freq2[term] || 0;

    dotProduct += f1 * f2;
    mag1 += f1 * f1;
    mag2 += f2 * f2;
  }

  if (mag1 === 0 || mag2 === 0) return 0;

  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Calculate edit distance (Levenshtein) between two strings
 */
export function editDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio based on edit distance (0-1 scale)
 */
export function editSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;

  const distance = editDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Safe division (returns 0 if denominator is 0)
 */
export function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Linear interpolation for scoring
 */
export function lerp(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return 100;
  return ((value - min) / (max - min)) * 100;
}

/**
 * Clamp value to range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert percentage string to number (e.g., "25%" -> 25)
 */
export function parsePercentage(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Check if two phrases are semantically similar (fuzzy match)
 */
export function areSimilarPhrases(phrase1: string, phrase2: string, threshold: number = 0.8): boolean {
  const norm1 = normalizeText(phrase1);
  const norm2 = normalizeText(phrase2);

  // Exact match
  if (norm1 === norm2) return true;

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check edit similarity
  return editSimilarity(norm1, norm2) >= threshold;
}
