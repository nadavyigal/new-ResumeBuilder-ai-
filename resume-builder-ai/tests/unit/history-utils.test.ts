/**
 * Unit tests for history-utils.ts
 * Feature: 005-history-view-previous (User Story 3 - T031)
 *
 * Tests filter/search utilities, URL param handling, and data transformations
 */

import { describe, it, expect } from '@jest/globals';
import {
  applySearchFilter,
  sanitizeSearchQuery,
  buildQueryParams,
  parseQueryParams,
  buildURLSearchParams,
  getDateRangeFromPreset,
  detectDateRangePreset,
  getMinScoreFromPreset,
  detectScorePreset,
  hasActiveFilters,
  countActiveFilters,
  createDefaultFilters,
  createDefaultSort,
  formatDate,
  formatMatchScore,
  getScoreColorClass,
  formatRelativeTime,
} from '@/lib/history-utils';
import type { OptimizationHistoryEntry, HistoryFilters, SortConfig } from '@/types/history';

describe('history-utils - Search & Filter Functions', () => {
  const mockOptimizations: OptimizationHistoryEntry[] = [
    {
      id: 1,
      createdAt: '2025-01-01T00:00:00Z',
      jobTitle: 'Software Engineer',
      company: 'Google',
      matchScore: 0.95,
      status: 'completed',
      jobUrl: 'https://jobs.google.com/123',
      templateKey: 'ats-safe',
      hasApplication: false,
    },
    {
      id: 2,
      createdAt: '2025-01-02T00:00:00Z',
      jobTitle: 'Senior Developer',
      company: 'Microsoft',
      matchScore: 0.88,
      status: 'completed',
      jobUrl: 'https://careers.microsoft.com/456',
      templateKey: 'minimal-ssr',
      hasApplication: true,
    },
    {
      id: 3,
      createdAt: '2025-01-03T00:00:00Z',
      jobTitle: 'Frontend Engineer',
      company: null,
      matchScore: 0.72,
      status: 'completed',
      jobUrl: null,
      templateKey: 'ats-safe',
      hasApplication: false,
    },
  ];

  describe('applySearchFilter', () => {
    it('should return all optimizations when search text is empty', () => {
      const result = applySearchFilter(mockOptimizations, '');
      expect(result).toEqual(mockOptimizations);
    });

    it('should filter by job title (case-insensitive)', () => {
      const result = applySearchFilter(mockOptimizations, 'software');
      expect(result).toHaveLength(1);
      expect(result[0].jobTitle).toBe('Software Engineer');
    });

    it('should filter by company name (case-insensitive)', () => {
      const result = applySearchFilter(mockOptimizations, 'GOOGLE');
      expect(result).toHaveLength(1);
      expect(result[0].company).toBe('Google');
    });

    it('should filter by partial match', () => {
      const result = applySearchFilter(mockOptimizations, 'dev');
      expect(result).toHaveLength(1);
      expect(result[0].jobTitle).toBe('Senior Developer');
    });

    it('should handle null company gracefully', () => {
      const result = applySearchFilter(mockOptimizations, 'frontend');
      expect(result).toHaveLength(1);
      expect(result[0].company).toBeNull();
    });

    it('should return empty array when no matches', () => {
      const result = applySearchFilter(mockOptimizations, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should remove HTML tags', () => {
      const result = sanitizeSearchQuery('<script>alert("xss")</script>');
      expect(result).toBe('scriptalert("xss")/script');
    });

    it('should remove special regex characters', () => {
      const result = sanitizeSearchQuery('test.*+?^${}()|[]\\');
      expect(result).toBe('test');
    });

    it('should trim whitespace', () => {
      const result = sanitizeSearchQuery('  test  ');
      expect(result).toBe('test');
    });

    it('should limit length to 100 characters', () => {
      const longString = 'a'.repeat(150);
      const result = sanitizeSearchQuery(longString);
      expect(result).toHaveLength(100);
    });
  });

  describe('buildQueryParams', () => {
    const defaultFilters: HistoryFilters = {
      search: '',
      dateRange: null,
      minScore: null,
    };

    const defaultSort: SortConfig = {
      column: 'date',
      direction: 'desc',
    };

    it('should build basic query params', () => {
      const params = buildQueryParams(defaultFilters, defaultSort, { page: 1, limit: 20 });
      expect(params).toEqual({
        page: 1,
        limit: 20,
        sort: 'date',
        order: 'desc',
      });
    });

    it('should include search query when present', () => {
      const filters = { ...defaultFilters, search: 'software engineer' };
      const params = buildQueryParams(filters, defaultSort, { page: 1, limit: 20 });
      expect(params.search).toBe('software engineer');
    });

    it('should include date range when present', () => {
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');
      const filters = { ...defaultFilters, dateRange: { from, to } };
      const params = buildQueryParams(filters, defaultSort, { page: 1, limit: 20 });
      expect(params.dateFrom).toBe(from.toISOString());
      expect(params.dateTo).toBe(to.toISOString());
    });

    it('should convert minScore from percentage to decimal', () => {
      const filters = { ...defaultFilters, minScore: 80 };
      const params = buildQueryParams(filters, defaultSort, { page: 1, limit: 20 });
      expect(params.minScore).toBe(0.8);
    });

    it('should sanitize search query', () => {
      const filters = { ...defaultFilters, search: '<script>alert("xss")</script>' };
      const params = buildQueryParams(filters, defaultSort, { page: 1, limit: 20 });
      expect(params.search).not.toContain('<script>');
    });
  });

  describe('parseQueryParams', () => {
    it('should parse empty search params to defaults', () => {
      const searchParams = new URLSearchParams();
      const result = parseQueryParams(searchParams);

      expect(result.filters).toEqual({
        search: '',
        dateRange: null,
        minScore: null,
      });
      expect(result.sort).toEqual({
        column: 'date',
        direction: 'desc',
      });
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
      });
    });

    it('should parse search query', () => {
      const searchParams = new URLSearchParams('search=engineer');
      const result = parseQueryParams(searchParams);
      expect(result.filters.search).toBe('engineer');
    });

    it('should parse pagination params', () => {
      const searchParams = new URLSearchParams('page=3&limit=50');
      const result = parseQueryParams(searchParams);
      expect(result.pagination).toEqual({ page: 3, limit: 50 });
    });

    it('should parse sort params', () => {
      const searchParams = new URLSearchParams('sort=score&order=asc');
      const result = parseQueryParams(searchParams);
      expect(result.sort).toEqual({ column: 'score', direction: 'asc' });
    });

    it('should convert minScore from decimal to percentage', () => {
      const searchParams = new URLSearchParams('minScore=0.9');
      const result = parseQueryParams(searchParams);
      expect(result.filters.minScore).toBe(90);
    });

    it('should handle invalid params gracefully', () => {
      const searchParams = new URLSearchParams('page=invalid&limit=-5&minScore=2');
      const result = parseQueryParams(searchParams);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.filters.minScore).toBeNull();
    });
  });
});

describe('history-utils - Date Range Functions', () => {
  describe('getDateRangeFromPreset', () => {
    it('should return null for custom preset', () => {
      const result = getDateRangeFromPreset('custom');
      expect(result).toBeNull();
    });

    it('should calculate last-7-days range', () => {
      const result = getDateRangeFromPreset('last-7-days');
      expect(result).not.toBeNull();
      if (result) {
        const diffDays = Math.floor(
          (result.to.getTime() - result.from.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(diffDays).toBe(7);
      }
    });

    it('should calculate last-30-days range', () => {
      const result = getDateRangeFromPreset('last-30-days');
      expect(result).not.toBeNull();
      if (result) {
        const diffDays = Math.floor(
          (result.to.getTime() - result.from.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(diffDays).toBe(30);
      }
    });
  });

  describe('detectDateRangePreset', () => {
    it('should return custom for null range', () => {
      const result = detectDateRangePreset(null);
      expect(result).toBe('custom');
    });

    it('should detect last-7-days preset', () => {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - 7);

      const result = detectDateRangePreset({ from, to });
      expect(result).toBe('last-7-days');
    });

    it('should return custom for non-standard ranges', () => {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - 15);

      const result = detectDateRangePreset({ from, to });
      expect(result).toBe('custom');
    });
  });
});

describe('history-utils - Score Filter Functions', () => {
  describe('getMinScoreFromPreset', () => {
    it('should return null for "all" preset', () => {
      const result = getMinScoreFromPreset('all');
      expect(result).toBeNull();
    });

    it('should return 90 for "90-plus" preset', () => {
      const result = getMinScoreFromPreset('90-plus');
      expect(result).toBe(90);
    });

    it('should return 80 for "80-plus" preset', () => {
      const result = getMinScoreFromPreset('80-plus');
      expect(result).toBe(80);
    });
  });

  describe('detectScorePreset', () => {
    it('should detect "all" for null score', () => {
      const result = detectScorePreset(null);
      expect(result).toBe('all');
    });

    it('should detect "90-plus" for 90', () => {
      const result = detectScorePreset(90);
      expect(result).toBe('90-plus');
    });

    it('should return "all" for non-preset values', () => {
      const result = detectScorePreset(75);
      expect(result).toBe('all');
    });
  });
});

describe('history-utils - Filter State Functions', () => {
  describe('hasActiveFilters', () => {
    it('should return false for default filters', () => {
      const filters = createDefaultFilters();
      expect(hasActiveFilters(filters)).toBe(false);
    });

    it('should return true when search is present', () => {
      const filters = { ...createDefaultFilters(), search: 'test' };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when date range is present', () => {
      const filters = {
        ...createDefaultFilters(),
        dateRange: { from: new Date(), to: new Date() },
      };
      expect(hasActiveFilters(filters)).toBe(true);
    });

    it('should return true when min score is present', () => {
      const filters = { ...createDefaultFilters(), minScore: 80 };
      expect(hasActiveFilters(filters)).toBe(true);
    });
  });

  describe('countActiveFilters', () => {
    it('should return 0 for default filters', () => {
      const filters = createDefaultFilters();
      expect(countActiveFilters(filters)).toBe(0);
    });

    it('should count search filter', () => {
      const filters = { ...createDefaultFilters(), search: 'test' };
      expect(countActiveFilters(filters)).toBe(1);
    });

    it('should count multiple filters', () => {
      const filters = {
        search: 'test',
        dateRange: { from: new Date(), to: new Date() },
        minScore: 80,
      };
      expect(countActiveFilters(filters)).toBe(3);
    });
  });
});

describe('history-utils - Formatting Functions', () => {
  describe('formatDate', () => {
    it('should format ISO date string', () => {
      const result = formatDate('2025-01-15T00:00:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should format Date object', () => {
      const date = new Date('2025-01-15');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('should handle invalid date', () => {
      const result = formatDate('invalid');
      expect(result).toBe('Invalid date');
    });
  });

  describe('formatMatchScore', () => {
    it('should format decimal score as percentage', () => {
      expect(formatMatchScore(0.95)).toBe('95%');
      expect(formatMatchScore(0.8)).toBe('80%');
      expect(formatMatchScore(0.75)).toBe('75%');
    });

    it('should round to nearest integer', () => {
      expect(formatMatchScore(0.856)).toBe('86%');
    });
  });

  describe('getScoreColorClass', () => {
    it('should return green for scores >= 90%', () => {
      const result = getScoreColorClass(0.95);
      expect(result).toContain('green');
    });

    it('should return blue for scores >= 80%', () => {
      const result = getScoreColorClass(0.85);
      expect(result).toContain('blue');
    });

    it('should return yellow for scores >= 70%', () => {
      const result = getScoreColorClass(0.75);
      expect(result).toContain('yellow');
    });

    it('should return red for scores < 70%', () => {
      const result = getScoreColorClass(0.65);
      expect(result).toContain('red');
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "Today" for today', () => {
      const today = new Date();
      const result = formatRelativeTime(today);
      expect(result).toBe('Today');
    });

    it('should return "Yesterday" for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatRelativeTime(yesterday);
      expect(result).toBe('Yesterday');
    });

    it('should return days ago for recent dates', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const result = formatRelativeTime(threeDaysAgo);
      expect(result).toBe('3 days ago');
    });

    it('should return weeks ago for dates within a month', () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const result = formatRelativeTime(twoWeeksAgo);
      expect(result).toBe('2 weeks ago');
    });
  });
});

describe('history-utils - URL Synchronization', () => {
  describe('buildURLSearchParams', () => {
    it('should return empty string for default state', () => {
      const filters = createDefaultFilters();
      const sort = createDefaultSort();
      const pagination = { page: 1, limit: 20 };

      const result = buildURLSearchParams(filters, sort, pagination);
      expect(result).toBe('');
    });

    it('should include non-default params', () => {
      const filters = { ...createDefaultFilters(), search: 'test' };
      const sort = { column: 'score' as const, direction: 'asc' as const };
      const pagination = { page: 2, limit: 50 };

      const result = buildURLSearchParams(filters, sort, pagination);
      expect(result).toContain('page=2');
      expect(result).toContain('limit=50');
      expect(result).toContain('sort=score');
      expect(result).toContain('order=asc');
      expect(result).toContain('search=test');
    });

    it('should convert percentage to decimal for minScore', () => {
      const filters = { ...createDefaultFilters(), minScore: 80 };
      const sort = createDefaultSort();
      const pagination = { page: 1, limit: 20 };

      const result = buildURLSearchParams(filters, sort, pagination);
      expect(result).toContain('minScore=0.8');
    });
  });
});
