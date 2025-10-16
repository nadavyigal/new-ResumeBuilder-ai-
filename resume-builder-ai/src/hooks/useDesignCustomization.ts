"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useDesignCustomization Hook
 *
 * React hook for managing resume design customization via AI-powered natural language.
 * Integrates with Feature 003 (Design) existing API infrastructure.
 *
 * @component
 * @example
 * ```tsx
 * const { currentDesign, applyCustomization, isLoading, error } = useDesignCustomization({
 *   optimizationId: "uuid-123",
 * });
 * ```
 *
 * Features:
 * - Fetch current design assignment
 * - Apply customizations via natural language
 * - Handle ATS compatibility warnings
 * - Loading and error state management
 * - Request cancellation on unmount
 *
 * API Integration:
 * - GET /api/v1/design/:optimizationId - Fetch current design
 * - POST /api/v1/design/:optimizationId/customize - Apply customization
 */

export interface DesignTemplate {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  thumbnail_url?: string;
  is_premium: boolean;
  config?: {
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
    fonts?: {
      heading?: string;
      body?: string;
      accent?: string;
    };
    layout?: {
      columns?: number;
      margins?: string;
      spacing?: string;
    };
  };
}

export interface DesignCustomization {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
    accent?: string;
  };
  layout?: {
    columns?: number;
    margins?: string;
    spacing?: string;
  };
}

export interface CurrentDesign {
  template_key: string;
  customization_id: string | null;
  customization?: DesignCustomization;
  template?: DesignTemplate;
}

export interface CustomizeRequest {
  message: string;
}

export interface CustomizeResponse {
  customization_id: string;
  applied_changes: DesignCustomization;
  message: string;
  ats_warning?: string;
}

export interface UseDesignCustomizationOptions {
  /** The optimization ID to customize design for */
  optimizationId: string;
  /** Whether to fetch data immediately on mount (default: true) */
  enabled?: boolean;
  /** Callback when customization is applied successfully */
  onSuccess?: (data: CustomizeResponse) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export function useDesignCustomization(
  options: UseDesignCustomizationOptions
) {
  const { optimizationId, enabled = true, onSuccess, onError } = options;

  // State management
  const [currentDesign, setCurrentDesign] = useState<CurrentDesign | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);

  // Ref to track the abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch current design assignment
   */
  const fetchDesign = useCallback(async (): Promise<void> => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/design/${optimizationId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data: CurrentDesign = await response.json();

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setCurrentDesign(data);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      // Ignore abort errors (when component unmounts or new request starts)
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const error =
        err instanceof Error
          ? err
          : new Error("Failed to fetch current design");

      if (isMountedRef.current) {
        setError(error);
        setIsLoading(false);

        // Call error callback if provided
        onError?.(error);
      }
    }
  }, [optimizationId, onError]);

  /**
   * Apply design customization via natural language
   */
  const applyCustomization = useCallback(
    async (message: string): Promise<CustomizeResponse | null> => {
      if (!message.trim()) {
        throw new Error("Customization message cannot be empty");
      }

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setIsCustomizing(true);
      setError(null);

      try {
        const requestBody: CustomizeRequest = {
          message: message.trim(),
        };

        const response = await fetch(
          `/api/v1/design/${optimizationId}/customize`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              `HTTP error ${response.status}`
          );
        }

        const data: CustomizeResponse = await response.json();

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          // Update current design with new customization
          setCurrentDesign((prev) =>
            prev
              ? {
                  ...prev,
                  customization_id: data.customization_id,
                  customization: {
                    ...(prev.customization || {}),
                    ...data.applied_changes,
                  },
                }
              : null
          );
          setIsCustomizing(false);

          // Call success callback if provided
          onSuccess?.(data);

          return data;
        }

        return null;
      } catch (err: unknown) {
        // Ignore abort errors (when component unmounts or new request starts)
        if (err instanceof Error && err.name === "AbortError") {
          return null;
        }

        const error =
          err instanceof Error
            ? err
            : new Error("Failed to apply customization");

        if (isMountedRef.current) {
          setError(error);
          setIsCustomizing(false);

          // Call error callback if provided
          onError?.(error);
        }

        throw error;
      }
    },
    [optimizationId, onSuccess, onError]
  );

  /**
   * Refetch current design
   */
  const refetch = useCallback(() => {
    return fetchDesign();
  }, [fetchDesign]);

  /**
   * Invalidate cache and refetch
   */
  const invalidate = useCallback(() => {
    return refetch();
  }, [refetch]);

  // Fetch design on mount and when optimizationId changes
  useEffect(() => {
    if (!enabled) return;

    // Mark as mounted
    isMountedRef.current = true;

    // Fetch current design
    fetchDesign();

    // Cleanup: abort pending requests and mark as unmounted
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [optimizationId, enabled, fetchDesign]);

  return {
    /** Current design assignment with template and customizations */
    currentDesign,

    /** Apply customization via natural language */
    applyCustomization,

    /** Loading state for initial data fetch */
    isLoading,

    /** Customizing state (true while applying customization) */
    isCustomizing,

    /** Error object if operation failed */
    error,

    /** Refetch current design */
    refetch,

    /** Invalidate cache and refetch */
    invalidate,

    /** Whether data has been loaded successfully */
    isSuccess: !isLoading && !error && currentDesign !== null,

    /** Whether currently in error state */
    isError: error !== null,
  };
}

/**
 * Hook return type
 */
export interface UseDesignCustomizationReturn {
  currentDesign: CurrentDesign | null;
  applyCustomization: (
    message: string
  ) => Promise<CustomizeResponse | null>;
  isLoading: boolean;
  isCustomizing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
  isSuccess: boolean;
  isError: boolean;
}
