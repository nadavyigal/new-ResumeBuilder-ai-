/**
 * Error Recovery Utility - OpenAI Assistant Error Handling
 *
 * Handles errors from OpenAI API and provides recovery strategies:
 * - Thread not found → Create new thread
 * - Rate limit exceeded → Retry with exponential backoff
 * - Invalid API key → Surface error to user
 * - Network errors → Retry with timeout
 *
 * @module lib/ai-assistant/error-recovery
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureThread } from './thread-manager';

/**
 * Categorizes errors for appropriate recovery strategy
 */
export enum ErrorCategory {
  THREAD_NOT_FOUND = 'thread_not_found',
  RATE_LIMIT = 'rate_limit',
  AUTH_ERROR = 'auth_error',
  NETWORK_ERROR = 'network_error',
  INVALID_REQUEST = 'invalid_request',
  UNKNOWN = 'unknown',
}

/**
 * Recoverable error with recovery strategy
 */
export interface RecoverableError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  canRetry: boolean;
  suggestedAction?: string;
}

/**
 * Classifies an error into a category for recovery
 *
 * @param error - Error from OpenAI API or other source
 * @returns ErrorCategory classification
 */
export function classifyError(error: unknown): ErrorCategory {
  if (!(error instanceof Error)) {
    return ErrorCategory.UNKNOWN;
  }

  const message = error.message.toLowerCase();

  // Thread-related errors
  if (
    message.includes('thread') &&
    (message.includes('not found') || message.includes('does not exist') || message.includes('undefined'))
  ) {
    return ErrorCategory.THREAD_NOT_FOUND;
  }

  // Rate limiting
  if (message.includes('rate limit') || message.includes('429')) {
    return ErrorCategory.RATE_LIMIT;
  }

  // Authentication/Authorization
  if (
    message.includes('unauthorized') ||
    message.includes('api key') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return ErrorCategory.AUTH_ERROR;
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('fetch failed')
  ) {
    return ErrorCategory.NETWORK_ERROR;
  }

  // Invalid request
  if (message.includes('invalid') || message.includes('400')) {
    return ErrorCategory.INVALID_REQUEST;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Converts error to user-friendly RecoverableError object
 *
 * @param error - Raw error object
 * @returns RecoverableError with user-friendly message and recovery options
 */
export function toRecoverableError(error: unknown): RecoverableError {
  const category = classifyError(error);
  const originalMessage = error instanceof Error ? error.message : 'Unknown error';

  switch (category) {
    case ErrorCategory.THREAD_NOT_FOUND:
      return {
        category,
        message: originalMessage,
        userMessage: 'The conversation thread was not found. Starting a new thread...',
        canRetry: true,
        suggestedAction: 'create_new_thread',
      };

    case ErrorCategory.RATE_LIMIT:
      return {
        category,
        message: originalMessage,
        userMessage: 'Too many requests. Please wait a moment and try again.',
        canRetry: true,
        suggestedAction: 'retry_with_backoff',
      };

    case ErrorCategory.AUTH_ERROR:
      return {
        category,
        message: originalMessage,
        userMessage: 'Authentication error. Please contact support.',
        canRetry: false,
        suggestedAction: 'contact_support',
      };

    case ErrorCategory.NETWORK_ERROR:
      return {
        category,
        message: originalMessage,
        userMessage: 'Network error. Please check your connection and try again.',
        canRetry: true,
        suggestedAction: 'retry',
      };

    case ErrorCategory.INVALID_REQUEST:
      return {
        category,
        message: originalMessage,
        userMessage: 'Invalid request. Please try rephrasing your message.',
        canRetry: false,
        suggestedAction: 'rephrase',
      };

    case ErrorCategory.UNKNOWN:
    default:
      return {
        category,
        message: originalMessage,
        userMessage: 'An unexpected error occurred. Please try again.',
        canRetry: true,
        suggestedAction: 'retry',
      };
  }
}

/**
 * Attempts to recover from a thread-related error
 *
 * Recovery strategies:
 * 1. Thread not found → Create new thread
 * 2. Rate limit → Wait and retry
 * 3. Network error → Retry
 * 4. Other → Surface error
 *
 * @param error - Error that occurred
 * @param optimizationId - UUID of the optimization
 * @param userId - UUID of the user
 * @param supabase - Supabase client instance
 * @returns Promise resolving to recovery result with new thread or error
 *
 * @example
 * ```ts
 * try {
 *   await openai.beta.threads.retrieve(threadId);
 * } catch (error) {
 *   const result = await recoverFromThreadError(error, 'opt-123', 'user-456', supabase);
 *   if (result.recovered) {
 *     console.log('Using new thread:', result.thread.openai_thread_id);
 *   } else {
 *     console.error('Recovery failed:', result.error.userMessage);
 *   }
 * }
 * ```
 */
export async function recoverFromThreadError(
  error: unknown,
  optimizationId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{
  recovered: boolean;
  thread?: any;
  error?: RecoverableError;
}> {
  const recoverableError = toRecoverableError(error);

  // Log error for monitoring
  console.error(`[Thread Recovery] ${recoverableError.category}:`, recoverableError.message);

  // Attempt recovery based on category
  switch (recoverableError.category) {
    case ErrorCategory.THREAD_NOT_FOUND:
      try {
        // Create new thread
        const newThread = await ensureThread(optimizationId, userId, supabase);
        console.log(`[Thread Recovery] Created new thread: ${newThread.openai_thread_id}`);
        return {
          recovered: true,
          thread: newThread,
        };
      } catch (recoveryError) {
        console.error('[Thread Recovery] Failed to create new thread:', recoveryError);
        return {
          recovered: false,
          error: toRecoverableError(recoveryError),
        };
      }

    case ErrorCategory.RATE_LIMIT:
      // Don't auto-retry rate limits - let caller handle backoff
      return {
        recovered: false,
        error: recoverableError,
      };

    case ErrorCategory.NETWORK_ERROR:
      // Don't auto-retry network errors - let caller handle retry
      return {
        recovered: false,
        error: recoverableError,
      };

    case ErrorCategory.AUTH_ERROR:
    case ErrorCategory.INVALID_REQUEST:
    case ErrorCategory.UNKNOWN:
    default:
      // Cannot recover from these errors
      return {
        recovered: false,
        error: recoverableError,
      };
  }
}

/**
 * Sanitizes error message before sending to client
 *
 * Removes sensitive information like:
 * - API keys
 * - Internal paths
 * - Stack traces
 * - Database connection strings
 *
 * @param error - Error to sanitize
 * @returns User-safe error message
 */
export function sanitizeErrorForClient(error: unknown): string {
  const recoverableError = toRecoverableError(error);
  return recoverableError.userMessage;
}

/**
 * Retry wrapper with exponential backoff
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Result of successful execution or throws last error
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => openai.beta.threads.create(),
 *   3,
 *   1000
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const category = classifyError(error);

      // Don't retry auth errors or invalid requests
      if (category === ErrorCategory.AUTH_ERROR || category === ErrorCategory.INVALID_REQUEST) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate backoff delay: baseDelay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${delay}ms...`);

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but throw last error just in case
  throw lastError;
}

/**
 * Checks if an error is recoverable
 *
 * @param error - Error to check
 * @returns True if error can be recovered from
 */
export function isRecoverableError(error: unknown): boolean {
  const category = classifyError(error);
  return (
    category === ErrorCategory.THREAD_NOT_FOUND ||
    category === ErrorCategory.RATE_LIMIT ||
    category === ErrorCategory.NETWORK_ERROR ||
    category === ErrorCategory.UNKNOWN
  );
}
