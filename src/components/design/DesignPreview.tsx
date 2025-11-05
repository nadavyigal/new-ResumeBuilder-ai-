/**
 * DesignPreview Component
 * Full-page template preview with apply button
 *
 * Reference: specs/003-i-want-to/quickstart.md Step 3
 * Task: T036
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useLocalization } from '@/hooks/useLocalization';

interface DesignPreviewProps {
  templateId: string;
  templateName?: string;
  optimizationId: string;
  onApply: () => void;
  onClose: () => void;
  isOpen: boolean;
  previewUrl?: string | null;
}

export function DesignPreview({
  templateId,
  templateName,
  optimizationId,
  onApply,
  onClose,
  isOpen,
  previewUrl,
}: DesignPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { direction } = useLocalization();

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      setRefreshKey((key) => key + 1);
    }
  }, [isOpen, templateId, previewUrl]);

  const previewSrc = useMemo(() => {
    if (previewUrl) {
      const separator = previewUrl.includes('?') ? '&' : '?';
      return `${previewUrl}${separator}v=${refreshKey}`;
    }
    return `/api/v1/design/templates/${templateId}/preview?v=${refreshKey}`;
  }, [previewUrl, templateId, refreshKey]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir={direction}>
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {templateName || 'Template Preview'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Review how your resume will look with this design
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="relative flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
              <div className="text-center max-w-md mx-auto p-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Failed to Load Preview
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          <iframe
            key={previewSrc}
            src={previewSrc}
            className="w-full h-full border-none"
            title={`${templateName || 'Template'} Preview`}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError('Failed to load preview. The template may be unavailable.');
            }}
          />
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Preview is responsive and mobile-friendly</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
