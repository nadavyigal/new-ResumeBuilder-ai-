/**
 * Unit Tests for ATS Score Cache
 * Phase 5, Task T036
 */

import { ATSScoreCache } from '../../../src/lib/ats/score-cache';

describe('ATSScoreCache', () => {
  let cache: ATSScoreCache;

  const mockResume = {
    name: 'John Doe',
    skills: { technical: ['JavaScript', 'TypeScript'] },
    experience: [{ company: 'Tech Corp', title: 'Developer' }],
  };

  const mockJobDescription = 'Looking for JavaScript developer with TypeScript experience';

  beforeEach(() => {
    cache = new ATSScoreCache({ maxSize: 10, ttlMinutes: 1 });
  });

  describe('set() and get()', () => {
    it('caches and retrieves scores', () => {
      cache.set(mockResume, mockJobDescription, 85, {
        keyword_exact: 90,
        semantic: 80,
      });

      const cached = cache.get(mockResume, mockJobDescription);

      expect(cached).toBeDefined();
      expect(cached?.score).toBe(85);
      expect(cached?.subscores).toEqual({
        keyword_exact: 90,
        semantic: 80,
      });
    });

    it('returns null for cache miss', () => {
      const cached = cache.get(mockResume, mockJobDescription);

      expect(cached).toBeNull();
    });

    it('uses content hash for cache key', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      // Same content should hit cache
      const cached1 = cache.get(mockResume, mockJobDescription);
      expect(cached1?.score).toBe(85);

      // Different order of keys should still hit cache (normalized)
      const reorderedResume = {
        experience: mockResume.experience,
        skills: mockResume.skills,
        name: mockResume.name,
      };
      const cached2 = cache.get(reorderedResume, mockJobDescription);
      expect(cached2?.score).toBe(85);
    });

    it('distinguishes different content', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      const differentResume = { ...mockResume, name: 'Jane Smith' };
      const cached = cache.get(differentResume, mockJobDescription);

      expect(cached).toBeNull();
    });
  });

  describe('has()', () => {
    it('returns true for cached entries', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      expect(cache.has(mockResume, mockJobDescription)).toBe(true);
    });

    it('returns false for missing entries', () => {
      expect(cache.has(mockResume, mockJobDescription)).toBe(false);
    });

    it('returns false for expired entries', (done) => {
      const shortCache = new ATSScoreCache({ ttlMinutes: 0.01 }); // 0.6 seconds
      shortCache.set(mockResume, mockJobDescription, 85, {});

      expect(shortCache.has(mockResume, mockJobDescription)).toBe(true);

      setTimeout(() => {
        expect(shortCache.has(mockResume, mockJobDescription)).toBe(false);
        done();
      }, 700);
    });
  });

  describe('delete()', () => {
    it('removes cached entries', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      expect(cache.has(mockResume, mockJobDescription)).toBe(true);

      cache.delete(mockResume, mockJobDescription);

      expect(cache.has(mockResume, mockJobDescription)).toBe(false);
    });

    it('returns true when entry existed', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      const deleted = cache.delete(mockResume, mockJobDescription);

      expect(deleted).toBe(true);
    });

    it('returns false when entry did not exist', () => {
      const deleted = cache.delete(mockResume, mockJobDescription);

      expect(deleted).toBe(false);
    });
  });

  describe('clear()', () => {
    it('removes all entries', () => {
      cache.set(mockResume, mockJobDescription, 85, {});
      cache.set({ ...mockResume, name: 'Jane' }, mockJobDescription, 90, {});

      expect(cache.getStats().size).toBe(2);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
    });

    it('resets statistics', () => {
      cache.set(mockResume, mockJobDescription, 85, {});
      cache.get(mockResume, mockJobDescription); // Hit
      cache.get({ name: 'Different' }, mockJobDescription); // Miss

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getStats()', () => {
    it('tracks cache hits and misses', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      // 2 hits
      cache.get(mockResume, mockJobDescription);
      cache.get(mockResume, mockJobDescription);

      // 1 miss
      cache.get({ name: 'Different' }, mockJobDescription);

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 0);
    });

    it('returns 0 hit rate when no requests', () => {
      const stats = cache.getStats();

      expect(stats.hitRate).toBe(0);
    });

    it('reports cache size', () => {
      cache.set(mockResume, mockJobDescription, 85, {});
      cache.set({ name: 'Jane' }, mockJobDescription, 90, {});

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('evicts least recently used entry when cache is full', () => {
      // Fill cache to max size (10)
      for (let i = 0; i < 10; i++) {
        cache.set({ name: `User${i}` }, mockJobDescription, 80 + i, {});
      }

      expect(cache.getStats().size).toBe(10);

      // Access User5 to make it recently used
      cache.get({ name: 'User5' }, mockJobDescription);

      // Add new entry, should evict User0 (oldest)
      cache.set({ name: 'User10' }, mockJobDescription, 90, {});

      expect(cache.getStats().size).toBe(10);
      expect(cache.has({ name: 'User0' }, mockJobDescription)).toBe(false);
      expect(cache.has({ name: 'User5' }, mockJobDescription)).toBe(true);
      expect(cache.has({ name: 'User10' }, mockJobDescription)).toBe(true);
    });
  });

  describe('getMostAccessed()', () => {
    it('returns entries sorted by access count', () => {
      cache.set({ name: 'User1' }, mockJobDescription, 80, {});
      cache.set({ name: 'User2' }, mockJobDescription, 85, {});
      cache.set({ name: 'User3' }, mockJobDescription, 90, {});

      // Access User2 three times
      cache.get({ name: 'User2' }, mockJobDescription);
      cache.get({ name: 'User2' }, mockJobDescription);
      cache.get({ name: 'User2' }, mockJobDescription);

      // Access User3 once
      cache.get({ name: 'User3' }, mockJobDescription);

      const mostAccessed = cache.getMostAccessed(2);

      expect(mostAccessed[0].score).toBe(85); // User2
      expect(mostAccessed[0].accessCount).toBe(3);
      expect(mostAccessed[1].score).toBe(90); // User3
      expect(mostAccessed[1].accessCount).toBe(1);
    });

    it('limits results to specified count', () => {
      for (let i = 0; i < 5; i++) {
        cache.set({ name: `User${i}` }, mockJobDescription, 80, {});
      }

      const top3 = cache.getMostAccessed(3);

      expect(top3.length).toBe(3);
    });
  });

  describe('cleanup()', () => {
    it('removes expired entries', (done) => {
      const shortCache = new ATSScoreCache({ ttlMinutes: 0.01 }); // 0.6 seconds

      shortCache.set({ name: 'User1' }, mockJobDescription, 80, {});
      shortCache.set({ name: 'User2' }, mockJobDescription, 85, {});

      expect(shortCache.getStats().size).toBe(2);

      setTimeout(() => {
        const removed = shortCache.cleanup();

        expect(removed).toBe(2);
        expect(shortCache.getStats().size).toBe(0);
        done();
      }, 700);
    });

    it('keeps valid entries', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      const removed = cache.cleanup();

      expect(removed).toBe(0);
      expect(cache.getStats().size).toBe(1);
    });

    it('returns count of removed entries', (done) => {
      const shortCache = new ATSScoreCache({ ttlMinutes: 0.01 });

      shortCache.set({ name: 'User1' }, mockJobDescription, 80, {});
      shortCache.set({ name: 'User2' }, mockJobDescription, 85, {});

      // Add a fresh entry
      setTimeout(() => {
        shortCache.set({ name: 'User3' }, mockJobDescription, 90, {});
      }, 300);

      setTimeout(() => {
        const removed = shortCache.cleanup();

        expect(removed).toBe(2); // Only first 2 expired
        expect(shortCache.getStats().size).toBe(1);
        done();
      }, 800);
    });
  });

  describe('getSizeBytes()', () => {
    it('estimates cache size in bytes', () => {
      cache.set(mockResume, mockJobDescription, 85, {
        keyword_exact: 90,
        semantic: 80,
      });

      const size = cache.getSizeBytes();

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('increases with more entries', () => {
      const size1 = cache.getSizeBytes();

      cache.set(mockResume, mockJobDescription, 85, {});
      const size2 = cache.getSizeBytes();

      cache.set({ ...mockResume, name: 'Jane' }, mockJobDescription, 90, {});
      const size3 = cache.getSizeBytes();

      expect(size2).toBeGreaterThan(size1);
      expect(size3).toBeGreaterThan(size2);
    });
  });

  describe('TTL expiration', () => {
    it('returns null for expired entries', (done) => {
      const shortCache = new ATSScoreCache({ ttlMinutes: 0.01 }); // 0.6 seconds

      shortCache.set(mockResume, mockJobDescription, 85, {});

      // Should be cached immediately
      expect(shortCache.get(mockResume, mockJobDescription)).not.toBeNull();

      // Should expire after TTL
      setTimeout(() => {
        expect(shortCache.get(mockResume, mockJobDescription)).toBeNull();
        done();
      }, 700);
    });

    it('automatically removes expired entries on get', (done) => {
      const shortCache = new ATSScoreCache({ ttlMinutes: 0.01 });

      shortCache.set(mockResume, mockJobDescription, 85, {});

      expect(shortCache.getStats().size).toBe(1);

      setTimeout(() => {
        shortCache.get(mockResume, mockJobDescription); // Should remove expired entry

        expect(shortCache.getStats().size).toBe(0);
        done();
      }, 700);
    });
  });

  describe('access tracking', () => {
    it('increments access count on get', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      cache.get(mockResume, mockJobDescription);
      cache.get(mockResume, mockJobDescription);
      cache.get(mockResume, mockJobDescription);

      const mostAccessed = cache.getMostAccessed(1);

      expect(mostAccessed[0].accessCount).toBe(3);
    });

    it('updates last accessed timestamp', () => {
      cache.set(mockResume, mockJobDescription, 85, {});

      const firstAccess = new Date();

      setTimeout(() => {
        cache.get(mockResume, mockJobDescription);

        const mostAccessed = cache.getMostAccessed(1);
        expect(mostAccessed[0].accessCount).toBe(1);
      }, 50);
    });
  });
});
