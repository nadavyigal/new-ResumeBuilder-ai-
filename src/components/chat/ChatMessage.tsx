'use client';

/**
 * ChatMessage Component
 *
 * Renders individual chat messages with sender differentiation (user vs AI).
 * Displays message content, timestamp, and metadata.
 */

import React from 'react';
import type { ChatMessageProps } from '@/types/chat';
import { useLocale, useTranslations } from 'next-intl';

export function ChatMessage({ message, isLatest = false }: ChatMessageProps) {
  const t = useTranslations('dashboard.chat.message');
  const locale = useLocale();
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const isUser = message.sender === 'user';

  // Format timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString(dateLocale, {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString(dateLocale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`
          max-w-[80%] rounded-lg px-4 py-2
          ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}
          ${isLatest ? 'animate-fade-in' : ''}
        `}
      >
        {/* Sender Badge */}
        <div className="flex items-center mb-1">
          <span
            className={`
              text-xs font-semibold
              ${isUser ? 'text-blue-100' : 'text-gray-600'}
            `}
          >
            {isUser ? t('you') : t('assistant')}
          </span>
          {message.metadata?.ai_model_version && (
            <span className="ml-2 text-xs text-gray-500">
              ({message.metadata.ai_model_version})
            </span>
          )}
        </div>

        {/* Message Content */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* Timestamp */}
        <div
          className={`
            mt-1 text-xs
            ${isUser ? 'text-blue-100' : 'text-gray-500'}
          `}
        >
          {formatTimestamp(message.created_at)}
        </div>

        {/* Metadata Badges */}
        {message.metadata && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.metadata.amendment_type && (
              <span
                className={`
                  px-2 py-1 text-xs rounded
                  ${isUser ? 'bg-blue-500' : 'bg-gray-200 text-gray-700'}
                `}
              >
                {message.metadata.amendment_type}
              </span>
            )}
            {message.metadata.section_affected && (
              <span
                className={`
                  px-2 py-1 text-xs rounded
                  ${isUser ? 'bg-blue-500' : 'bg-gray-200 text-gray-700'}
                `}
              >
                {message.metadata.section_affected}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
