'use client';

/**
 * ChatSidebar Component
 *
 * Inline chat interface with message list and input field.
 * Displays conversation history and handles message sending.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ATSSuggestionsBanner } from './ATSSuggestionsBanner';
import { PendingChangeApproval } from './PendingChangeApproval';
import type { ChatSidebarProps, ChatMessage as ChatMessageType, ChatSendMessageResponse, PendingChange } from '@/types/chat';
import type { Suggestion } from '@/lib/ats/types';
import { useSectionSelection } from '@/hooks/useSectionSelection';
import { refineSection, applyRefinement } from '@/lib/api/refine-section';
import type { RefineSectionRequest } from '@/types/refine';
import { logger } from '@/lib/agent/utils/logger';
import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { CHAT_EVENTS } from '@/lib/analytics/events';

/**
 * Validate and deduplicate pending changes
 *
 * Ensures:
 * 1. No duplicate suggestion IDs
 * 2. Changes have required fields
 * 3. No conflicts with existing pending changes
 */
function validateAndDeduplicatePendingChanges(
  newChanges: PendingChange[],
  existingChanges: PendingChange[]
): PendingChange[] {
  const seen = new Set<string>();
  const validated: PendingChange[] = [];

  // Track existing suggestion IDs to avoid duplicates
  existingChanges.forEach(change => {
    seen.add(change.suggestionId);
  });

  for (const change of newChanges) {
    // Validate required fields
    if (!change.suggestionId || !change.suggestionText || !change.suggestionNumber) {
      logger.warn('Skipping invalid pending change (missing required fields)', { change });
      continue;
    }

    // Skip duplicates
    if (seen.has(change.suggestionId)) {
      logger.warn('Skipping duplicate pending change', { suggestionId: change.suggestionId });
      continue;
    }

    // Validate status
    if (change.status !== 'pending' && change.status !== 'approved' && change.status !== 'rejected') {
      logger.warn('Invalid status for pending change, defaulting to pending', { status: change.status, suggestionId: change.suggestionId });
      change.status = 'pending';
    }

    seen.add(change.suggestionId);
    validated.push(change);
  }

  // Merge with existing changes (existing ones first)
  return [...existingChanges, ...validated];
}

export function ChatSidebar({
  optimizationId,
  onMessageSent,
  onDesignPreview,
  atsSuggestions,
  onPendingChanges,
}: Omit<ChatSidebarProps, 'initialOpen' | 'onClose'> & {
  atsSuggestions?: Suggestion[];
  onPendingChanges?: (changes: PendingChange[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineResult, setRefineResult] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const { selection, clearSelection } = useSectionSelection();
  const t = useTranslations('dashboard.chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load existing session on mount
  useEffect(() => {
    if (!sessionId) {
      loadSession();
    }
  }, [optimizationId]);

  // Load session and messages
  const loadSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to get existing active session
      const response = await fetch(`/api/v1/chat/sessions?status=active`);

      if (!response.ok) {
        throw new Error(t('errors.loadSessions'));
      }

      const data = await response.json();

      // Find session for this optimization
      const existingSession = data.sessions?.find(
        (s: any) => s.optimization_id === optimizationId && s.status === 'active'
      );

      if (existingSession) {
        setSessionId(existingSession.id);
        await loadMessages(existingSession.id);
      }
    } catch (err) {
      logger.error('Error loading chat session', { optimizationId }, err);
      setError(err instanceof Error ? err.message : t('errors.loadChatSession'));
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for a session
  const loadMessages = async (sid: string) => {
    try {
      const response = await fetch(`/api/v1/chat/sessions/${sid}`);

      if (!response.ok) {
        throw new Error(t('errors.loadMessages'));
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      logger.error('Error loading chat messages', { sessionId: sid, optimizationId }, err);
      setError(err instanceof Error ? err.message : t('errors.loadMessages'));
    }
  };

  // Send message
  const handleSendMessage = async (message: string) => {
    try {
      setError(null);

      // If a section selection exists, send to refine-section endpoint instead of chat
      if (selection) {
        const lower = message.trim().toLowerCase();
        // If user types an apply intent while a suggestion exists, apply it
        if (refineResult && (lower === 'apply' || lower === 'apply suggestion' || lower.startsWith('apply ') || lower.startsWith('amend') || lower.startsWith('update'))) {
          setIsLoading(true);
          const res = await applyRefinement({
            optimizationId,
            selection,
            suggestion: refineResult,
          });
          setIsLoading(false);
          if (!res.ok) {
            throw new Error(res.reason || t('errors.applyRefinement'));
          }
          setRefineResult(null);
          // Trigger refresh
          if (onMessageSent) onMessageSent();
          return;
        }

        setIsLoading(true);
        setRefineResult(null);
        const payload: RefineSectionRequest = {
          resumeId: optimizationId,
          selection,
          instruction: message,
        };
        const result = await refineSection(payload);
        setRefineResult(result.suggestion);
        setIsLoading(false);
        return;
      }

      // Add user message optimistically
      const tempUserMessage: ChatMessageType = {
        id: `temp-${Date.now()}`,
        session_id: sessionId || '',
        sender: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMessage]);

      posthog.capture(CHAT_EVENTS.MESSAGE_SENT, {
        optimization_id: optimizationId,
        message_count_in_session: messages.length + 1,
        is_ats_suggestion: false,
      });

      // Send message to API
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          optimization_id: optimizationId,
          message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('errors.sendMessage'));
      }

      const data: ChatSendMessageResponse = await response.json();

      if (process.env.NODE_ENV === 'development') {
        logger.debug('Chat send response payload', {
          responseKeys: Object.keys(data),
          hasTipsApplied: !!data.tips_applied,
          hasDesignCustomization: !!data.design_customization,
          onMessageSentDefined: !!onMessageSent,
          rawResponse: data,
        });
      }

      // Handle pending changes for ATS tip implementation
      if (data.pending_changes) {
        const pendingChangesData = data.pending_changes;

        // Validate and deduplicate pending changes
        const validatedChanges = validateAndDeduplicatePendingChanges(
          pendingChangesData,
          pendingChanges
        );

        setPendingChanges(validatedChanges);
        logger.info('Received pending changes for ATS tips', {
          optimizationId,
          validatedChangesCount: validatedChanges.length,
        });

        // Emit to parent for resume highlighting
        if (onPendingChanges) {
          onPendingChanges(validatedChanges);
        }
      }

      // Handle tip implementation - trigger refresh to show applied changes
      if (data.tips_applied) {
        logger.info('Tips applied in chat response', {
          optimizationId,
          tipsApplied: data.tips_applied,
          hasOnMessageSent: !!onMessageSent,
        });

        if (onMessageSent) {
          if (process.env.NODE_ENV === 'development') {
            logger.debug('Calling onMessageSent after tips applied', { optimizationId });
          }
          try {
            await onMessageSent();
            if (process.env.NODE_ENV === 'development') {
              logger.debug('onMessageSent completed after tips applied', { optimizationId });
            }
          } catch (err) {
            logger.error('Failed to invoke onMessageSent after tips applied', { optimizationId }, err);
          }
        } else {
          logger.error('onMessageSent callback missing when tips applied', {
            optimizationId,
            onDesignPreviewProvided: !!onDesignPreview,
            atsSuggestionsProvided: !!atsSuggestions,
          });
        }
      }

      // Emit ephemeral design preview if provided
      if (data.design_customization) {
        logger.info('Design customization provided', {
          optimizationId,
          hasOnDesignPreview: !!onDesignPreview,
          designCustomization: data.design_customization,
        });

        if (onDesignPreview) {
          try {
            if (process.env.NODE_ENV === 'development') {
              logger.debug('Calling onDesignPreview callback', { optimizationId });
            }
            onDesignPreview(data.design_customization);
            if (process.env.NODE_ENV === 'development') {
              logger.debug('onDesignPreview callback completed', { optimizationId });
            }
          } catch (err) {
            logger.error('Error while executing onDesignPreview callback', { optimizationId }, err);
          }
        } else {
          logger.warn('onDesignPreview callback not provided', { optimizationId });
        }

        // Also trigger refresh to commit design changes from database
        if (onMessageSent) {
          if (process.env.NODE_ENV === 'development') {
            logger.debug('Calling onMessageSent after design customization', { optimizationId });
          }
          onMessageSent();
          if (process.env.NODE_ENV === 'development') {
            logger.debug('onMessageSent completed after design customization', { optimizationId });
          }
        } else {
          logger.error('onMessageSent callback missing while processing design customization', { optimizationId });
        }
      }

      // Update session ID if this was first message
      if (!sessionId) {
        setSessionId(data.session_id);
      }

      // Remove temp message and reload messages from server
      if (data.session_id) {
        await loadMessages(data.session_id);

        // Always trigger resume refresh after messages that change data
        if (onMessageSent) {
          onMessageSent();
        }
      }
    } catch (err) {
      logger.error('Error sending chat message', { optimizationId }, err);
      setError(err instanceof Error ? err.message : t('errors.sendMessage'));

      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    }
  };

  // Close session
  const handleCloseSession = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/v1/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(t('errors.closeSession'));
      }

      // Reset state
      setSessionId(null);
      setMessages([]);
    } catch (err) {
      logger.error('Error closing chat session', { sessionId, optimizationId }, err);
      setError(err instanceof Error ? err.message : t('errors.closeSession'));
    }
  };

  // Handle approving a pending change
  const handleApproveChange = async (suggestionId: string) => {
    // Prevent duplicate requests
    if (processingRequests.has(suggestionId)) {
      logger.info('Approve request already in progress', { optimizationId, suggestionId });
      return;
    }

    try {
      setError(null);

      // Mark this request as processing
      setProcessingRequests(prev => new Set(prev).add(suggestionId));

      // Find the pending change
      const change = pendingChanges.find(c => c.suggestionId === suggestionId);
      if (!change) {
        setProcessingRequests(prev => {
          const next = new Set(prev);
          next.delete(suggestionId);
          return next;
        });
        return;
      }

      // Apply the changes to the database
      const requestBody = {
        optimization_id: optimizationId,
        suggestion_id: suggestionId,
        affected_fields: change.affectedFields,
      };

      logger.info('Sending approve change request', {
        optimizationId,
        suggestionId,
        affectedFieldsCount: change.affectedFields?.length || 0,
      });

      const response = await fetch('/api/v1/chat/approve-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (process.env.NODE_ENV === 'development') {
        logger.debug('Approve request response metadata', {
          optimizationId,
          suggestionId,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Approve change request failed', { optimizationId, suggestionId, errorData });
        throw new Error(errorData.error || t('errors.applyChanges'));
      }

      const responseData = await response.json();
      logger.info('Approve change request succeeded', { optimizationId, suggestionId, responseData });

      // Remove from pending changes
      const updatedChanges = pendingChanges.filter(c => c.suggestionId !== suggestionId);
      setPendingChanges(updatedChanges);

      // Notify parent about pending changes update
      if (onPendingChanges) {
        onPendingChanges(updatedChanges);
      }

      // Trigger resume refresh
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (err) {
      logger.error('Error approving pending change', { optimizationId, suggestionId }, err);
      setError(err instanceof Error ? err.message : t('errors.approveChanges'));
    } finally {
      // Always remove from processing set
      setProcessingRequests(prev => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  // Handle rejecting a pending change
  const handleRejectChange = (suggestionId: string) => {
    // Simply remove from pending changes without saving
    const updatedChanges = pendingChanges.filter(c => c.suggestionId !== suggestionId);
    setPendingChanges(updatedChanges);

    // Notify parent about pending changes update
    if (onPendingChanges) {
      onPendingChanges(updatedChanges);
    }
  };

  // Update parent when pending changes change
  // Using useEffect with onPendingChanges in dependency array is intentional here
  // The parent should provide a stable callback (useCallback) to avoid infinite loops
  useEffect(() => {
    if (onPendingChanges) {
      onPendingChanges(pendingChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChanges]);

  return (
    <div className="h-full flex flex-col bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white flex-shrink-0 border-b border-blue-700">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {t('header.title')}
          </h2>
          <p className="text-xs text-blue-100 mt-0.5">
            {t('header.subtitle')}
          </p>
        </div>
        {sessionId && (
          <button
            onClick={handleCloseSession}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            title={t('header.endSession')}
            aria-label={t('header.endSession')}
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex-shrink-0">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-600 hover:text-red-800 underline mt-1"
              >
                {t('error.dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 min-h-0">
        {/* ATS Suggestions Banner */}
        {atsSuggestions && atsSuggestions.length > 0 && (
          <ATSSuggestionsBanner suggestions={atsSuggestions} />
        )}

        {/* Pending Changes Approval UI */}
        {pendingChanges.length > 0 && (
          <PendingChangeApproval
            changes={pendingChanges}
            onApprove={handleApproveChange}
            onReject={handleRejectChange}
            processingIds={processingRequests}
          />
        )}

        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg
                className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm text-gray-600">{t('loading')}</p>
            </div>
          </div>
        ) : refineResult ? (
          <div className="space-y-2">
            {selection && (
              <div className="text-xs text-gray-600">
                {t.rich('refine.suggestionFor', {
                  field: () => <span className="font-medium">{selection.field}</span>,
                  section: () => <span className="font-mono">{selection.sectionId}</span>,
                })}
              </div>
            )}
            <div className="p-3 bg-white border rounded text-sm whitespace-pre-wrap">{refineResult}</div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded bg-black text-white text-xs"
                onClick={() => navigator.clipboard.writeText(refineResult)}
              >{t('refine.copy')}</button>
              <button
                className="px-3 py-1 rounded border text-xs"
                onClick={() => { setRefineResult(null); clearSelection(); }}
              >{t('refine.clear')}</button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xs">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-sm text-gray-600 mb-1">
                {t('empty.title')}
              </p>
              <p className="text-xs text-gray-500">
                {t('empty.description')}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isLatest={index === messages.length - 1}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0">
        <ChatInput
          sessionId={sessionId || ''}
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder={selection ? t('input.selectionPlaceholder') : t('input.defaultPlaceholder')}
        />
        {selection && (
          <div className="px-4 py-2 text-xs text-gray-600 border-t bg-white">
            {t.rich('refine.selectionHint', {
              section: () => <span className="font-mono">{selection.sectionId}</span>,
              field: () => <span className="font-medium">{selection.field}</span>,
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatSidebar;
