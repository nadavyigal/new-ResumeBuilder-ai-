'use client';

/**
 * PendingChangeApproval Component
 *
 * Displays pending ATS tip changes with individual approve/reject buttons.
 * Shows tip number, description, and affected sections.
 */

import React from 'react';
import type { PendingChange } from '@/types/chat';
import { Check, X, AlertCircle } from '@/lib/icons';
import { useTranslations } from 'next-intl';

interface PendingChangeApprovalProps {
  changes: PendingChange[];
  onApprove: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
  processingIds?: Set<string>;
}

export function PendingChangeApproval({
  changes,
  onApprove,
  onReject,
  processingIds = new Set(),
}: PendingChangeApprovalProps) {
  const t = useTranslations('dashboard.chat.pendingChanges');
  if (changes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-3">
      <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
        <AlertCircle className="w-4 h-4" />
        <span>{t('title')}</span>
      </div>

      {changes.map((change) => (
        <div
          key={change.suggestionId}
          className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-3"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-600 rounded-full">
                  {change.suggestionNumber}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t('tipLabel', { number: change.suggestionNumber })}
                </span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {change.suggestionText}
              </p>
            </div>
          </div>

          {/* Description */}
          {change.description && change.description !== change.suggestionText && (
            <div className="mb-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded text-xs text-gray-600 dark:text-gray-400">
              <strong className="text-gray-700 dark:text-gray-300">{t('changesLabel')}</strong> {change.description}
            </div>
          )}

          {/* Affected Sections Preview */}
          {change.affectedFields && change.affectedFields.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                <strong>{t('affectsLabel')}</strong> {t('affectsCount', { count: change.affectedFields.length })}
              </p>
              <div className="space-y-1">
                {change.affectedFields.slice(0, 2).map((field, idx) => (
                  <div
                    key={idx}
                    className="text-xs px-2 py-1 bg-white/70 dark:bg-gray-800/70 rounded"
                  >
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {field.sectionId}
                    </span>
                    {field.field && (
                      <span className="text-gray-500 dark:text-gray-400"> {t("fieldSeparator")} {field.field}</span>
                    )}
                  </div>
                ))}
                {change.affectedFields.length > 2 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-2">
                    {t("moreSections", { count: change.affectedFields.length - 2 })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {(() => {
              const isProcessing = processingIds.has(change.suggestionId);
              return (
                <>
                  <button
                    onClick={() => onApprove(change.suggestionId)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
                    aria-label={t('approveAria', { number: change.suggestionNumber })}
                  >
                    {isProcessing ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{t('applying')}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('approve')}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onReject(change.suggestionId)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded transition-colors"
                    aria-label={t('rejectAria', { number: change.suggestionNumber })}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{t('reject')}</span>
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      ))}

      {/* Instructions */}
      <p className="text-xs text-gray-500 dark:text-gray-400 italic px-1">
        {t("instructions")}
      </p>
    </div>
  );
}
