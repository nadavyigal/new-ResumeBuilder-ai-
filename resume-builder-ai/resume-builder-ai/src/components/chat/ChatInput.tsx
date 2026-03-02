'use client';

/**
 * ChatInput Component
 *
 * Message input field with send button and loading states.
 * Includes character counter and validation.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ChatInputProps } from '@/types/chat';
import { useTranslations } from 'next-intl';

export function ChatInput({
  sessionId,
  onSend,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const t = useTranslations('dashboard.chat.input');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resolvedPlaceholder = placeholder || t('placeholder');

  const maxLength = 5000;
  const charactersRemaining = maxLength - message.length;
  const isValid = message.trim().length > 0 && message.length <= maxLength;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || isSubmitting || disabled) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSend(message);
      setMessage('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card px-4 pt-4 pb-8 md:pb-4">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          disabled={disabled || isSubmitting}
          aria-label={t('placeholder')}
          aria-describedby="chat-help-text"
          className="w-full resize-none rounded-lg border border-input px-4 py-3 pe-12 focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:cursor-not-allowed min-h-[48px] max-h-[200px]"
          rows={1}
        />

        <button
          type="submit"
          disabled={!isValid || isSubmitting || disabled}
          className={`absolute end-2 bottom-3 flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            isValid && !isSubmitting && !disabled
              ? 'bg-mobile-cta hover:bg-mobile-cta-hover text-white'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
          aria-label={t('send')}
        >
          {isSubmitting ? (
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
          ) : (
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Character Counter */}
      <div
        className={`mt-2 text-xs text-end ${charactersRemaining < 100 ? 'text-error' : 'text-muted-foreground'}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {t('charactersRemaining', { count: charactersRemaining })}
      </div>

      {/* Help Text */}
      <div id="chat-help-text" className="mt-1 text-xs text-muted-foreground">
        {t('helpText')}
      </div>
    </form>
  );
}

export default ChatInput;
