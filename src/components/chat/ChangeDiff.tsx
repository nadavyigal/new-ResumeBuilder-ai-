'use client';

/**
 * ChangeDiff Component
 *
 * Visualizes resume changes using diff highlighting.
 * Shows additions (green), deletions (red), and modifications (yellow).
 *
 * Note: This is a simplified implementation. Phase 3.5 will integrate
 * react-diff-viewer library for production-quality diff visualization.
 */

import React from 'react';
import type { ChangeDiffProps } from '@/types/chat';
import { useTranslations } from 'next-intl';

export function ChangeDiff({
  original,
  modified,
  showLineNumbers = true,
  splitView = false,
}: ChangeDiffProps) {
  const t = useTranslations('dashboard.chat.changeDiff');
  // Simple line-by-line diff
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  const diffLines = [];

  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || '';
    const modifiedLine = modifiedLines[i] || '';

    let status: 'unchanged' | 'added' | 'removed' | 'modified' = 'unchanged';

    if (originalLine && !modifiedLine) {
      status = 'removed';
    } else if (!originalLine && modifiedLine) {
      status = 'added';
    } else if (originalLine !== modifiedLine) {
      status = 'modified';
    }

    diffLines.push({
      lineNumber: i + 1,
      original: originalLine,
      modified: modifiedLine,
      status,
    });
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'bg-green-50 border-l-4 border-green-500';
      case 'removed':
        return 'bg-red-50 border-l-4 border-red-500';
      case 'modified':
        return 'bg-yellow-50 border-l-4 border-yellow-500';
      default:
        return 'bg-white border-l-4 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      case 'modified':
        return '~';
      default:
        return ' ';
    }
  };

  if (splitView) {
    // Side-by-side comparison
    return (
      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
        {/* Original Column */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-700">
            {t('original')}
          </div>
          <div className="divide-y divide-gray-200">
            {diffLines.map((line, index) => (
              <div
                key={`original-${index}`}
                className={`px-3 py-1 ${
                  line.status === 'removed' || line.status === 'modified'
                    ? 'bg-red-50'
                    : 'bg-white'
                }`}
              >
                {showLineNumbers && (
                  <span className="inline-block w-8 text-gray-400 mr-2">
                    {line.lineNumber}
                  </span>
                )}
                <span className="whitespace-pre-wrap break-all">
                  {line.original || '\u00A0'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Modified Column */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-700">
            {t('modified')}
          </div>
          <div className="divide-y divide-gray-200">
            {diffLines.map((line, index) => (
              <div
                key={`modified-${index}`}
                className={`px-3 py-1 ${
                  line.status === 'added' || line.status === 'modified'
                    ? 'bg-green-50'
                    : 'bg-white'
                }`}
              >
                {showLineNumbers && (
                  <span className="inline-block w-8 text-gray-400 mr-2">
                    {line.lineNumber}
                  </span>
                )}
                <span className="whitespace-pre-wrap break-all">
                  {line.modified || '\u00A0'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Unified view (default)
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden font-mono text-sm">
      <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-700 flex items-center justify-between">
        <span>{t('changes')}</span>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded"></span> {t('added')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded"></span> {t('removed')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-500 rounded"></span> {t('modified')}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {diffLines.map((line, index) => {
          if (line.status === 'unchanged') {
            return (
              <div key={index} className="px-3 py-1 bg-white">
                {showLineNumbers && (
                  <span className="inline-block w-8 text-gray-400 mr-2">
                    {line.lineNumber}
                  </span>
                )}
                <span className="inline-block w-4 text-gray-400 mr-2">
                  {getStatusIcon(line.status)}
                </span>
                <span className="whitespace-pre-wrap break-all">
                  {line.modified}
                </span>
              </div>
            );
          }

          // Show both removed and added for modified lines
          if (line.status === 'modified') {
            return (
              <React.Fragment key={index}>
                <div className={`px-3 py-1 ${getStatusColor('removed')}`}>
                  {showLineNumbers && (
                    <span className="inline-block w-8 text-gray-400 mr-2">
                      {line.lineNumber}
                    </span>
                  )}
                  <span className="inline-block w-4 text-red-600 mr-2 font-semibold">
                    -
                  </span>
                  <span className="whitespace-pre-wrap break-all text-red-900">
                    {line.original}
                  </span>
                </div>
                <div className={`px-3 py-1 ${getStatusColor('added')}`}>
                  {showLineNumbers && (
                    <span className="inline-block w-8 text-gray-400 mr-2">
                      {line.lineNumber}
                    </span>
                  )}
                  <span className="inline-block w-4 text-green-600 mr-2 font-semibold">
                    +
                  </span>
                  <span className="whitespace-pre-wrap break-all text-green-900">
                    {line.modified}
                  </span>
                </div>
              </React.Fragment>
            );
          }

          // Removed or added lines
          return (
            <div key={index} className={`px-3 py-1 ${getStatusColor(line.status)}`}>
              {showLineNumbers && (
                <span className="inline-block w-8 text-gray-400 mr-2">
                  {line.lineNumber}
                </span>
              )}
              <span
                className={`inline-block w-4 mr-2 font-semibold ${
                  line.status === 'added' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {getStatusIcon(line.status)}
              </span>
              <span
                className={`whitespace-pre-wrap break-all ${
                  line.status === 'added' ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {line.status === 'added' ? line.modified : line.original}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChangeDiff;
