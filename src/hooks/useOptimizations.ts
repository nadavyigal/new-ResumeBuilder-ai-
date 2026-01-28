'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  OptimizationsQueryParams,
  OptimizationsResponse,
  OptimizationHistoryEntry,
  PaginationMeta,
} from '@/types/history';

/**
 * Custom React hook for fetching optimization history
 * Feature: 005-history-view-previous
 *
 * Provides data fetching, loading states, error handling, and cache management
 * for the optimizations history API endpoint.
 *
 * @param params - Query parameters for filtering, sorting, and pagination
 * @param options - Hook configuration options
 * @returns Object containing optimizations data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { optimizations, pagination, isLoading, error, refetch } = useOptimizations({
 *   page: 1,
 *   limit: 20,
 *   sort: 'date',
 *   order: 'desc',
 * });
 * ```
 */
export function useOptimizations(
  params?: Partial<OptimizationsQueryParams>,
  options?: {
    /** Whether to fetch data immediately on mount (default: true) */
    enabled?: boolean;
    /** Callback when data is successfully fetched */
    onSuccess?: (data: OptimizationsResponse) => void;
    /** Callback when an error occurs */
    onError?: (error: Error) => void;
  }
) {
  // State management
  const [optimizations, setOptimizations] = useState<OptimizationHistoryEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);

  // Ref to track the abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Build query string from parameters
   */
  const buildQueryString = useCallback((queryParams: Partial<OptimizationsQueryParams>): string => {
    const searchParams = new URLSearchParams();

    if (queryParams.page) searchParams.set('page', queryParams.page.toString());
    if (queryParams.limit) searchParams.set('limit', queryParams.limit.toString());
    if (queryParams.sort) searchParams.set('sort', queryParams.sort);
    if (queryParams.order) searchParams.set('order', queryParams.order);
    if (queryParams.dateFrom) searchParams.set('dateFrom', queryParams.dateFrom);
    if (queryParams.dateTo) searchParams.set('dateTo', queryParams.dateTo);
    if (queryParams.minScore !== undefined && queryParams.minScore !== null) {
      searchParams.set('minScore', queryParams.minScore.toString());
    }
    if (queryParams.search) searchParams.set('search', queryParams.search);

    return searchParams.toString();
  }, []);

  /**
   * Fetch optimizations from API
   */
  const fetchOptimizations = useCallback(async (
    queryParams: Partial<OptimizationsQueryParams>
  ): Promise<void> => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString(queryParams);
      const url = `/api/optimizations${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data: OptimizationsResponse = await response.json();

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setOptimizations(data.optimizations);
        setPagination(data.pagination);
        setIsLoading(false);

        // Call success callback if provided
        options?.onSuccess?.(data);
      }
    } catch (err: unknown) {
      // Ignore abort errors (when component unmounts or new request starts)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const error = err instanceof Error ? err : new Error('Failed to fetch optimizations');

      if (isMountedRef.current) {
        setError(error);
        setIsLoading(false);

        // Call error callback if provided
        options?.onError?.(error);
      }
    }
  }, [buildQueryString, options]);

  /**
   * Refetch data with current or new parameters
   */
  const refetch = useCallback((newParams?: Partial<OptimizationsQueryParams>) => {
    const queryParams = newParams || params || {};
    return fetchOptimizations(queryParams);
  }, [params, fetchOptimizations]);

  /**
   * Invalidate cache and refetch
   * (Useful after mutations like creating/deleting optimizations)
   */
  const invalidate = useCallback(() => {
    return refetch();
  }, [refetch]);

  // Fetch data on mount and when params change
  useEffect(() => {
    const enabled = options?.enabled !== false;

    if (enabled) {
      fetchOptimizations(params || {});
    }

    // Cleanup: abort pending requests and mark as unmounted
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    params,
    params?.page,
    params?.limit,
    params?.sort,
    params?.order,
    params?.dateFrom,
    params?.dateTo,
    params?.minScore,
    params?.search,
    fetchOptimizations,
    options?.enabled,
  ]);

  return {
    /** Array of optimization entries */
    optimizations,

    /** Pagination metadata */
    pagination,

    /** Loading state (true while fetching) */
    isLoading,

    /** Error object if fetch failed */
    error,

    /** Refetch data with current or new parameters */
    refetch,

    /** Invalidate cache and refetch (for use after mutations) */
    invalidate,

    /** Whether data has been loaded at least once */
    isSuccess: !isLoading && !error && optimizations.length >= 0,

    /** Whether currently in error state */
    isError: error !== null,
  };
}

/**
 * Hook configuration types
 */
export interface UseOptimizationsOptions {
  enabled?: boolean;
  onSuccess?: (data: OptimizationsResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook return type
 */
export interface UseOptimizationsReturn {
  optimizations: OptimizationHistoryEntry[];
  pagination: PaginationMeta;
  isLoading: boolean;
  error: Error | null;
  refetch: (newParams?: Partial<OptimizationsQueryParams>) => Promise<void>;
  invalidate: () => Promise<void>;
  isSuccess: boolean;
  isError: boolean;
}
