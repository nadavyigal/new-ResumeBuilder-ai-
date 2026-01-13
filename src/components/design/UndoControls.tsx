/**
 * UndoControls Component
 * Undo/revert UI controls for design customizations
 *
 * Reference: specs/003-i-want-to/quickstart.md Steps 6, 9
 * Task: T038
 */

'use client';

import React, { useState } from 'react';
import { Undo, RotateCcw, Loader2 } from '@/lib/icons';
import { useTranslations } from 'next-intl';

interface UndoControlsProps {
  optimizationId: string;
  canUndo: boolean;
  hasCustomizations: boolean;
  onUndo: () => void;
  onRevert: () => void;
}

export function UndoControls({
  optimizationId,
  canUndo,
  hasCustomizations,
  onUndo,
  onRevert
}: UndoControlsProps) {
  const t = useTranslations('dashboard.design.undo');
  const [isUndoing, setIsUndoing] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  const handleUndo = async () => {
    if (!canUndo || isUndoing) return;

    setIsUndoing(true);
    try {
      const response = await fetch(`/api/v1/design/${optimizationId}/undo`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.undo'));
      }

      // Notify parent component
      onUndo();
    } catch (error) {
      console.error('Undo failed:', error);
      alert(error instanceof Error ? error.message : t('errors.undo'));
    } finally {
      setIsUndoing(false);
    }
  };

  const handleRevert = async () => {
    if (!hasCustomizations || isReverting) return;

    setShowRevertConfirm(false);
    setIsReverting(true);

    try {
      const response = await fetch(`/api/v1/design/${optimizationId}/revert`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.revert'));
      }

      // Notify parent component
      onRevert();
    } catch (error) {
      console.error('Revert failed:', error);
      alert(error instanceof Error ? error.message : t('errors.revert'));
    } finally {
      setIsReverting(false);
    }
  };

  // Don't show controls if there are no customizations
  if (!canUndo && !hasCustomizations) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Undo Button */}
        <button
          onClick={handleUndo}
          disabled={!canUndo || isUndoing || isReverting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={canUndo ? t('undoTitle') : t('undoDisabledTitle')}
        >
          {isUndoing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Undo className="w-4 h-4" />
          )}
          {t('undo')}
        </button>

        {/* Revert Button */}
        <button
          onClick={() => setShowRevertConfirm(true)}
          disabled={!hasCustomizations || isUndoing || isReverting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={hasCustomizations ? t('revertTitle') : t('revertDisabledTitle')}
        >
          {isReverting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          {t('revert')}
        </button>
      </div>

      {/* Revert Confirmation Modal */}
      {showRevertConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6">
            <div className="mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
                {t('modal.title')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {t('modal.description')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRevertConfirm(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                {t('modal.cancel')}
              </button>
              <button
                onClick={handleRevert}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {t('modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
