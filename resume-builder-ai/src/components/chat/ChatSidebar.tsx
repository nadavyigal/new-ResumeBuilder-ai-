'use client';

/**
 * ChatSidebar Component
 *
 * Inline chat interface with message list and input field.
 * Displays conversation history and handles message sending.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ChatSidebarProps, ChatMessage as ChatMessageType, ChatSendMessageResponse } from '@/types/chat';

export function ChatSidebar({
  optimizationId,
  onMessageSent,
}: Omit<ChatSidebarProps, 'initialOpen' | 'onClose'>) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error('Failed to load sessions');
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
      console.error('Error loading session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat session');
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for a session
  const loadMessages = async (sid: string) => {
    try {
      const response = await fetch(`/api/v1/chat/sessions/${sid}`);

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    }
  };

  // Send message
  const handleSendMessage = async (message: string) => {
    try {
      setError(null);

      // Add user message optimistically
      const tempUserMessage: ChatMessageType = {
        id: `temp-${Date.now()}`,
        session_id: sessionId || '',
        sender: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMessage]);

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
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data: ChatSendMessageResponse = await response.json();

      // Update session ID if this was first message
      if (!sessionId) {
        setSessionId(data.session_id);
      }

      // Remove temp message and reload messages from server
      if (data.session_id) {
        await loadMessages(data.session_id);

        // Trigger resume refresh in parent component
        if (onMessageSent) {
          onMessageSent();
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');

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
        throw new Error('Failed to close session');
      }

      // Reset state
      setSessionId(null);
      setMessages([]);
    } catch (err) {
      console.error('Error closing session:', err);
      setError(err instanceof Error ? err.message : 'Failed to close session');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white flex-shrink-0 border-b border-blue-700">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            AI Assistant
          </h2>
          <p className="text-xs text-blue-100 mt-0.5">
            Refine content or customize design
          </p>
        </div>
        {sessionId && (
          <button
            onClick={handleCloseSession}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            title="End session"
            aria-label="End session"
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
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 min-h-0">
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
              <p className="text-sm text-gray-600">Loading chat...</p>
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
                Start a conversation with AI
              </p>
              <p className="text-xs text-gray-500">
                Ask me to refine content, add skills, or change colors and fonts.
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
          placeholder="e.g., 'Add Python to skills' or 'Make headers blue'..."
        />
      </div>
    </div>
  );
}

export default ChatSidebar;
