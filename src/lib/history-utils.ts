/**
 * Utility functions for History View feature
 * Feature: 005-history-view-previous (User Story 3 - T024)
 *
 * Provides filter/search utilities, URL param handling, and data transformations
 */

import type {
  OptimizationHistoryEntry,
  HistoryFilters,
  SortConfig,
  OptimizationsQueryParams,
  DateRangePreset,
  ScoreFilterPreset,
} from '@/types/history';
import { SCORE_FILTER_VALUES, DATE_RANGE_DAYS } from '@/types/history';

// ============================================================================
// Search & Filter Functions
// ============================================================================

/**
 * Apply client-side search filter to optimization list
 * Performs case-insensitive partial matching on job title and company name
 *
 * @param optimizations - List of optimizations to filter
 * @param searchText - Search query string
 * @returns Filtered list of optimizations
 */
export function applySearchFilter(
  optimizations: OptimizationHistoryEntry[],
  searchText: string
): OptimizationHistoryEntry[] {
  if (!searchText || searchText.trim() === '') {
    return optimizations;
  }

  // Sanitize search query to prevent XSS
  const sanitized = sanitizeSearchQuery(searchText);
  const lowerSearch = sanitized.toLowerCase();

  return optimizations.filter((opt) => {
    const jobTitle = (opt.jobTitle || '').toLowerCase();
    const company = (opt.company || '').toLowerCase();

    return jobTitle.includes(lowerSearch) || company.includes(lowerSearch);
  });
}

/**
 * Sanitize search query to prevent XSS vulnerabilities
 * Removes special characters and HTML tags
 *
 * @param query - Raw search query
 * @returns Sanitized query string
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove HTML tags
  let sanitized = query.replace(/<[^>]*>/g, '');

  // Remove special regex characters that could cause issues
  sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '');

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 100);

  return sanitized;
}

/**
 * Build query parameters object for API request
 * Converts filter state to API-compatible query params
 *
 * @param filters - Current filter state
 * @param sort - Sort configuration
 * @param pagination - Page and limit
 * @returns Query parameters object
 */
export function buildQueryParams(
  filters: HistoryFilters,
  sort: SortConfig,
  pagination: { page: number; limit: number }
): OptimizationsQueryParams {
  const params: OptimizationsQueryParams = {
    page: pagination.page,
    limit: pagination.limit,
    sort: sort.column,
    order: sort.direction,
  };

  // Add search query if present
  if (filters.search && filters.search.trim() !== '') {
    params.search = sanitizeSearchQuery(filters.search);
  }

  // Add date range if present
  if (filters.dateRange) {
    params.dateFrom = filters.dateRange.from.toISOString();
    params.dateTo = filters.dateRange.to.toISOString();
  }

  // Add minimum score if present
  if (filters.minScore !== null && filters.minScore !== undefined) {
    // Convert percentage (0-100) to decimal (0-1)
    params.minScore = filters.minScore / 100;
  }

  return params;
}

/**
 * Parse query parameters from URL SearchParams
 * Extracts filter, sort, and pagination state from URL
 *
 * @param searchParams - URLSearchParams object
 * @returns Parsed state object
 */
export function parseQueryParams(searchParams: URLSearchParams): {
  filters: HistoryFilters;
  sort: SortConfig;
  pagination: { page: number; limit: number };
} {
  // Parse filters
  const filters: HistoryFilters = {
    search: searchParams.get('search') || '',
    dateRange: null,
    minScore: null,
  };

  // Parse date range
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  if (dateFrom && dateTo) {
    try {
      filters.dateRange = {
        from: new Date(dateFrom),
        to: new Date(dateTo),
      };
    } catch {
      // Invalid dates - ignore
    }
  }

  // Parse min score (convert from decimal to percentage)
  const minScoreParam = searchParams.get('minScore');
  if (minScoreParam) {
    const score = parseFloat(minScoreParam);
    if (!isNaN(score) && score >= 0 && score <= 1) {
      filters.minScore = score * 100;
    }
  }

  // Parse sort
  const sort: SortConfig = {
    column: (searchParams.get('sort') as 'date' | 'score' | 'company') || 'date',
    direction: (searchParams.get('order') as 'asc' | 'desc') || 'desc',
  };

  // Validate sort column
  if (!['date', 'score', 'company'].includes(sort.column)) {
    sort.column = 'date';
  }

  // Parse pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  return {
    filters,
    sort,
    pagination: {
      page: isNaN(page) || page < 1 ? 1 : page,
      limit: isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100),
    },
  };
}

/**
 * Build URL search params string from state
 * Converts filter, sort, and pagination state to URL query string
 *
 * @param filters - Current filter state
 * @param sort - Sort configuration
 * @param pagination - Page and limit
 * @returns URL search params string (without leading ?)
 */
export function buildURLSearchParams(
  filters: HistoryFilters,
  sort: SortConfig,
  pagination: { page: number; limit: number }
): string {
  const params = new URLSearchParams();

  // Add pagination
  if (pagination.page !== 1) {
    params.set('page', pagination.page.toString());
  }
  if (pagination.limit !== 20) {
    params.set('limit', pagination.limit.toString());
  }

  // Add sort (only if not default)
  if (sort.column !== 'date' || sort.direction !== 'desc') {
    params.set('sort', sort.column);
    params.set('order', sort.direction);
  }

  // Add filters
  if (filters.search && filters.search.trim() !== '') {
    params.set('search', filters.search);
  }

  if (filters.dateRange) {
    params.set('dateFrom', filters.dateRange.from.toISOString());
    params.set('dateTo', filters.dateRange.to.toISOString());
  }

  if (filters.minScore !== null) {
    params.set('minScore', (filters.minScore / 100).toString());
  }

  return params.toString();
}

// ============================================================================
// Date Range Utilities
// ============================================================================

/**
 * Calculate date range from preset
 * Converts preset (e.g., "last-7-days") to actual date range
 *
 * @param preset - Date range preset
 * @returns Date range object or null for custom
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset
): { from: Date; to: Date } | null {
  if (preset === 'custom') {
    return null;
  }

  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = new Date(to);

  const days = DATE_RANGE_DAYS[preset];
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  return { from, to };
}

/**
 * Detect which preset matches a date range (if any)
 *
 * @param dateRange - Date range to check
 * @returns Matching preset or 'custom'
 */
export function detectDateRangePreset(
  dateRange: { from: Date; to: Date } | null
): DateRangePreset {
  if (!dateRange) {
    return 'custom';
  }

  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check if matches a preset (with 1 day tolerance)
  if (Math.abs(daysDiff - 7) <= 1) return 'last-7-days';
  if (Math.abs(daysDiff - 30) <= 1) return 'last-30-days';
  if (Math.abs(daysDiff - 90) <= 1) return 'last-90-days';

  return 'custom';
}

// ============================================================================
// Score Filter Utilities
// ============================================================================

/**
 * Convert score filter preset to minimum score value
 *
 * @param preset - Score filter preset
 * @returns Minimum score as percentage (0-100) or null for 'all'
 */
export function getMinScoreFromPreset(preset: ScoreFilterPreset): number | null {
  const value = SCORE_FILTER_VALUES[preset];
  return value !== null ? value * 100 : null;
}

/**
 * Detect which score preset matches a minimum score (if any)
 *
 * @param minScore - Minimum score percentage (0-100)
 * @returns Matching preset or 'all'
 */
export function detectScorePreset(minScore: number | null): ScoreFilterPreset {
  if (minScore === null) return 'all';

  const decimal = minScore / 100;

  // Check exact matches
  if (Math.abs(decimal - 0.9) < 0.01) return '90-plus';
  if (Math.abs(decimal - 0.8) < 0.01) return '80-plus';
  if (Math.abs(decimal - 0.7) < 0.01) return '70-plus';

  return 'all';
}

// ============================================================================
// Filter State Utilities
// ============================================================================

/**
 * Check if any filters are active
 *
 * @param filters - Filter state
 * @returns True if any filter is active
 */
export function hasActiveFilters(filters: HistoryFilters): boolean {
  return !!(
    filters.search ||
    filters.dateRange ||
    (filters.minScore !== null && filters.minScore > 0)
  );
}

/**
 * Count number of active filters
 *
 * @param filters - Filter state
 * @returns Number of active filters
 */
export function countActiveFilters(filters: HistoryFilters): number {
  let count = 0;

  if (filters.search && filters.search.trim() !== '') count++;
  if (filters.dateRange) count++;
  if (filters.minScore !== null && filters.minScore > 0) count++;

  return count;
}

/**
 * Create default filter state
 *
 * @returns Default HistoryFilters object
 */
export function createDefaultFilters(): HistoryFilters {
  return {
    search: '',
    dateRange: null,
    minScore: null,
  };
}

/**
 * Create default sort configuration
 *
 * @returns Default SortConfig object
 */
export function createDefaultSort(): SortConfig {
  return {
    column: 'date',
    direction: 'desc',
  };
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format date for display
 *
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format match score as percentage
 *
 * @param score - Match score (0-1 decimal)
 * @returns Formatted percentage string
 */
export function formatMatchScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Get color class for match score
 *
 * @param score - Match score (0-1 decimal)
 * @returns Tailwind color class
 */
export function getScoreColorClass(score: number): string {
  if (score >= 0.9) return 'text-green-600 dark:text-green-500';
  if (score >= 0.8) return 'text-blue-600 dark:text-blue-500';
  if (score >= 0.7) return 'text-yellow-600 dark:text-yellow-500';
  return 'text-red-600 dark:text-red-500';
}

/**
 * Format relative time (e.g., "3 days ago")
 *
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
