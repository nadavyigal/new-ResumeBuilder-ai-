/**
 * ATS Score Caching System
 * Phase 5, Task T036
 *
 * Caches ATS scores based on content hashes to avoid redundant re-calculations
 * when resume content hasn't changed
 */

import crypto from 'crypto';

interface CachedScore {
  score: number;
  subscores: Record<string, number>;
  timestamp: Date;
  contentHash: string;
}

interface CacheEntry {
  key: string;
  value: CachedScore;
  accessCount: number;
  lastAccessed: Date;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class ATSScoreCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(options?: { maxSize?: number; ttlMinutes?: number }) {
    this.maxSize = options?.maxSize || 1000;
    this.ttlMs = (options?.ttlMinutes || 60) * 60 * 1000; // Default 60 minutes
  }

  /**
   * Generate content hash for cache key
   */
  private generateHash(content: any): string {
    const normalized = JSON.stringify(content, Object.keys(content).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Generate cache key from resume and job description content
   */
  private generateCacheKey(
    resumeContent: any,
    jobDescriptionContent: string
  ): string {
    const resumeHash = this.generateHash(resumeContent);
    const jdHash = this.generateHash(jobDescriptionContent);
    return `${resumeHash}:${jdHash}`;
  }

  /**
   * Get cached score if available and not expired
   */
  get(
    resumeContent: any,
    jobDescriptionContent: string
  ): CachedScore | null {
    const key = this.generateCacheKey(resumeContent, jobDescriptionContent);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if cache entry has expired
    const age = Date.now() - entry.value.timestamp.getTime();
    if (age > this.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Store score in cache
   */
  set(
    resumeContent: any,
    jobDescriptionContent: string,
    score: number,
    subscores: Record<string, number>
  ): void {
    const key = this.generateCacheKey(resumeContent, jobDescriptionContent);
    const contentHash = this.generateHash({
      resume: resumeContent,
      jd: jobDescriptionContent,
    });

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const cachedScore: CachedScore = {
      score,
      subscores,
      timestamp: new Date(),
      contentHash,
    };

    this.cache.set(key, {
      key,
      value: cachedScore,
      accessCount: 0,
      lastAccessed: new Date(),
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestEntry: CacheEntry | null = null;
    let oldestTime = Infinity;

    for (const entry of this.cache.values()) {
      const accessTime = entry.lastAccessed.getTime();
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestEntry = entry;
      }
    }

    if (oldestEntry) {
      this.cache.delete(oldestEntry.key);
    }
  }

  /**
   * Check if score is cached for given content
   */
  has(resumeContent: any, jobDescriptionContent: string): boolean {
    const key = this.generateCacheKey(resumeContent, jobDescriptionContent);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    const age = Date.now() - entry.value.timestamp.getTime();
    return age <= this.ttlMs;
  }

  /**
   * Clear specific cache entry
   */
  delete(resumeContent: any, jobDescriptionContent: string): boolean {
    const key = this.generateCacheKey(resumeContent, jobDescriptionContent);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
    };
  }

  /**
   * Get cache entries sorted by access count
   */
  getMostAccessed(count: number = 10): Array<{
    contentHash: string;
    score: number;
    accessCount: number;
  }> {
    const entries = Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, count);

    return entries.map((entry) => ({
      contentHash: entry.value.contentHash.substring(0, 8),
      score: entry.value.score,
      accessCount: entry.accessCount,
    }));
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.value.timestamp.getTime();
      if (age > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache size in bytes (approximate)
   */
  getSizeBytes(): number {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      // Approximate size: JSON stringify the entry
      const entryJson = JSON.stringify(entry);
      totalSize += entryJson.length * 2; // UTF-16 encoding (2 bytes per char)
    }

    return totalSize;
  }
}

// Singleton instance for global use
export const atsScoreCache = new ATSScoreCache({
  maxSize: 1000,
  ttlMinutes: 60,
});

// Export types
export type { CachedScore, CacheStats };
