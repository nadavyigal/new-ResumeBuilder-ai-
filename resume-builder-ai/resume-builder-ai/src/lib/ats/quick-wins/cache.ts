/**
 * Quick Wins Caching Layer
 *
 * Simple in-memory cache for quick wins to prevent regenerating
 * on page refresh or repeated requests with the same inputs.
 */

import type { QuickWinSuggestion, JobExtraction } from '../types';

interface CacheEntry {
  quickWins: QuickWinSuggestion[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Generate cache key from inputs
 */
export function getCacheKey(params: {
  resume_text: string;
  job_data: JobExtraction;
}): string {
  const resumeHash = simpleHash(params.resume_text);
  const jobHash = simpleHash(params.job_data.title + params.job_data.must_have.join(','));
  return `qw_${resumeHash}_${jobHash}`;
}

/**
 * Get cached quick wins
 */
export function getCachedQuickWins(key: string): QuickWinSuggestion[] | null {
  const entry = cache.get(key);
  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.quickWins;
}

/**
 * Cache quick wins
 */
export function cacheQuickWins(key: string, quickWins: QuickWinSuggestion[]): void {
  cache.set(key, {
    quickWins,
    timestamp: Date.now(),
  });

  // Cleanup old entries if cache gets too large
  if (cache.size > 100) {
    const oldestKey = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    cache.delete(oldestKey);
  }
}

/**
 * Simple hash function for creating cache keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
