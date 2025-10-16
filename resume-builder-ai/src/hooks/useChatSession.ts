"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useChatSession Hook
 *
 * React hook for managing chat sessions and messages for resume content editing.
 * Integrates with Feature 002 (Chat) existing API infrastructure.
 *
 * @component
 * @example
 * ```tsx
 * const { session, messages, sendMessage, isLoading, error } = useChatSession({
 *   optimizationId: "uuid-123",
 * });
 * ```
 *
 * Features:
 * - Fetch or create chat session automatically
 * - Send messages and receive AI responses
 * - Handle amendments and clarifications
 * - Loading and error state management
 * - Automatic session resumption
 * - Request cancellation on unmount
 *
 * API Integration:
 * - POST /api/v1/chat - Send messages
 * - GET /api/v1/chat/sessions/:id - Fetch message history (future enhancement)
 */

export interface ChatSession {
  id: string;
  optimization_id: string;
  status: "active" | "closed";
  created_at: string;
  last_activity_at: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  content: string;
  created_at: string;
  metadata?: {
    amendment_type?: string;
    section_affected?: string;
    processing_time_ms?: number;
    requires_clarification?: boolean;
  };
}

export interface AmendmentRequest {
  id: string;
  type: "add" | "modify" | "remove" | "clarify";
  target_section: string | null;
  status: "pending" | "applied" | "rejected" | "needs_clarification";
}

export interface SendMessageRequest {
  optimization_id: string;
  message: string;
  session_id?: string;
}

export interface SendMessageResponse {
  session_id: string;
  message_id: string;
  ai_response: string;
  amendments?: AmendmentRequest[];
  requires_clarification?: boolean;
}

export interface UseChatSessionOptions {
  /** The optimization ID to chat about */
  optimizationId: string;
  /** Whether to fetch data immediately on mount (default: true) */
  enabled?: boolean;
  /** Callback when message is sent successfully */
  onSuccess?: (data: SendMessageResponse) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export function useChatSession(options: UseChatSessionOptions) {
  const { optimizationId, enabled = true, onSuccess, onError } = options;

  // State management
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);

  // Ref to track the abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Send a message to the chat API
   */
  const sendMessage = useCallback(
    async (message: string): Promise<SendMessageResponse | null> => {
      if (!message.trim()) {
        throw new Error("Message cannot be empty");
      }

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setIsSending(true);
      setError(null);

      try {
        const requestBody: SendMessageRequest = {
          optimization_id: optimizationId,
          message: message.trim(),
          ...(session?.id && { session_id: session.id }),
        };

        const response = await fetch("/api/v1/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP error ${response.status}`
          );
        }

        const data: SendMessageResponse = await response.json();

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          // Update or create session
          if (!session || session.id !== data.session_id) {
            setSession({
              id: data.session_id,
              optimization_id: optimizationId,
              status: "active",
              created_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
            });
          }

          // Add user message
          const userMessage: ChatMessage = {
            id: data.message_id,
            sender: "user",
            content: message.trim(),
            created_at: new Date().toISOString(),
          };

          // Add AI response message
          const aiMessage: ChatMessage = {
            id: `ai-${data.message_id}`,
            sender: "ai",
            content: data.ai_response,
            created_at: new Date().toISOString(),
            metadata: {
              requires_clarification: data.requires_clarification,
            },
          };

          setMessages((prev) => [...prev, userMessage, aiMessage]);
          setIsSending(false);

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
          err instanceof Error ? err : new Error("Failed to send message");

        if (isMountedRef.current) {
          setError(error);
          setIsSending(false);

          // Call error callback if provided
          onError?.(error);
        }

        throw error;
      }
    },
    [optimizationId, session, onSuccess, onError]
  );

  /**
   * Clear chat history (client-side only)
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * Reset session and start fresh
   */
  const resetSession = useCallback(() => {
    setSession(null);
    setMessages([]);
    setError(null);
  }, []);

  // Initialize hook (could load existing session in future enhancement)
  useEffect(() => {
    if (!enabled) return;

    // Mark as mounted
    isMountedRef.current = true;

    // TODO: Future enhancement - Fetch existing session and messages
    // For now, we'll create sessions on first message send
    setIsLoading(false);

    // Cleanup: abort pending requests and mark as unmounted
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [optimizationId, enabled]);

  return {
    /** Current chat session (null if not created yet) */
    session,

    /** Array of chat messages (user and AI) */
    messages,

    /** Send a message and get AI response */
    sendMessage,

    /** Loading state for initial data fetch */
    isLoading,

    /** Sending state (true while message is being sent) */
    isSending,

    /** Error object if operation failed */
    error,

    /** Clear all messages (client-side only) */
    clearMessages,

    /** Reset session and start fresh */
    resetSession,

    /** Whether data has been loaded successfully */
    isSuccess: !isLoading && !error,

    /** Whether currently in error state */
    isError: error !== null,
  };
}

/**
 * Hook return type
 */
export interface UseChatSessionReturn {
  session: ChatSession | null;
  messages: ChatMessage[];
  sendMessage: (message: string) => Promise<SendMessageResponse | null>;
  isLoading: boolean;
  isSending: boolean;
  error: Error | null;
  clearMessages: () => void;
  resetSession: () => void;
  isSuccess: boolean;
  isError: boolean;
}
