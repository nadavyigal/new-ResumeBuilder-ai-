/**
 * DesignCustomizer Component
 * AI chat interface for design customization
 *
 * Reference: specs/003-i-want-to/quickstart.md Steps 4-8
 * Task: T037
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Send, Loader2, AlertCircle, CheckCircle, X } from '@/lib/icons';
import { useTranslations } from 'next-intl';

interface CustomizationMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
  preview?: string;
  reasoning?: string;
  error?: string;
  clarificationNeeded?: string;
}

interface DesignCustomizerProps {
  optimizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onCustomizationApplied: () => void;
}

export function DesignCustomizer({
  optimizationId,
  isOpen,
  onClose,
  onCustomizationApplied
}: DesignCustomizerProps) {
  const t = useTranslations('dashboard.design.customizer');
  const [messages, setMessages] = useState<CustomizationMessage[]>(() => [
    {
      role: 'assistant',
      content: t('welcome'),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sanitizedPreview = useMemo(() => {
    if (!currentPreview) return null;
    return DOMPurify.sanitize(currentPreview, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style'],
    });
  }, [currentPreview]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isProcessing) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsProcessing(true);

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch(`/api/v1/design/${optimizationId}/customize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeRequest: userMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error responses
        if (data.error === 'ats_violation') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'error',
              content: t('errors.atsViolation', {
                message: data.message || t('errors.atsViolationDetail'),
              }),
              error: data.error,
              clarificationNeeded: data.clarificationNeeded,
            },
          ]);
        } else if (data.error === 'unclear_request') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: t('errors.needsDetails', {
                message: data.clarificationNeeded || t('errors.needsDetailsDetail'),
              }),
              clarificationNeeded: data.clarificationNeeded,
            },
          ]);
        } else if (data.error === 'fabrication') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'error',
              content: t('errors.invalidRequest', {
                message: data.clarificationNeeded || t('errors.invalidRequestDetail'),
              }),
              error: data.error,
            },
          ]);
        } else {
          throw new Error(data.message || t('errors.applyCustomization'));
        }
      } else {
        // Success - update preview and add assistant response
        setCurrentPreview(data.preview);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: t('success.applied', { message: data.reasoning || t('success.appliedDefault') }),
            preview: data.preview,
            reasoning: data.reasoning
          }
        ]);

        // Notify parent that customization was applied
        onCustomizationApplied();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: t('errors.generic', { message: error instanceof Error ? error.message : t('errors.genericDetail') }),
          error: 'internal_error'
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('header.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('header.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label={t('header.close')}
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.role === 'error'
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {message.clarificationNeeded && message.role === 'assistant' && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('messages.tip')}
                    </p>
                  </div>
                )}

                {message.preview && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setCurrentPreview(message.preview!)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >{t('messages.viewPreview')}</button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('processing')}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('input.placeholder')}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t('input.send')}
            </button>
          </form>

          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {t('footer.atsSafe')}
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('footer.contentLocked')}
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {currentPreview && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setCurrentPreview(null)}
          >
            <div
              className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('preview.title')}
                </h3>
                <button
                  onClick={() => setCurrentPreview(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="h-[calc(90vh-80px)] overflow-auto">
                <div
                  className="p-4"
                  dangerouslySetInnerHTML={{ __html: sanitizedPreview || '' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
