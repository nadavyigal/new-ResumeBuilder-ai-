/**
 * ATS Suggestions Banner Component
 *
 * Displays ATS improvement suggestions in the chat sidebar
 */

import React, { useState } from 'react';
import type { Suggestion } from '@/lib/ats/types';
import { ChevronDown, ChevronUp, Lightbulb, Zap, TrendingUp } from '@/lib/icons';

interface ATSSuggestionsBannerProps {
  suggestions: Suggestion[];
}

// Type for suggestions with added sequential numbering
type NumberedSuggestion = Suggestion & { number: number };

export function ATSSuggestionsBanner({ suggestions }: ATSSuggestionsBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed to match target UI

  if (suggestions.length === 0) {
    return null;
  }

  // Add sequential numbering to all suggestions
  const numberedSuggestions: NumberedSuggestion[] = suggestions.map((s, index) => ({ ...s, number: index + 1 }));

  const quickWins = numberedSuggestions.filter(s => s.quick_win).slice(0, 3);
  const highImpact = numberedSuggestions.filter(s => !s.quick_win && s.estimated_gain >= 8).slice(0, 2);
  const displaySuggestions: NumberedSuggestion[] = [...quickWins, ...highImpact];

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            ATS Improvement Tips
          </span>
          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
            {suggestions.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {/* Suggestions List */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {displaySuggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className="bg-white/50 dark:bg-gray-800/50 rounded p-2 border border-blue-100 dark:border-blue-900"
            >
              <div className="flex items-start gap-2">
                {suggestion.quick_win ? (
                  <Zap className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 dark:text-gray-100">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Tip #{suggestion.number}:</span> {suggestion.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded font-medium">
                      +{suggestion.estimated_gain} pts
                    </span>
                    {suggestion.quick_win && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded">
                        Quick Win
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {suggestions.length > displaySuggestions.length && (
            <p className="text-xs text-center text-blue-600 dark:text-blue-400 mt-2">
              +{suggestions.length - displaySuggestions.length} more suggestions (click "Details" in ATS score card)
            </p>
          )}

          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
            💬 Ask me to implement suggestions by number (e.g., "implement tip 1, 2, and 4")
          </p>
        </div>
      )}

      {/* Collapsed preview */}
      {!isExpanded && quickWins.length > 0 && (
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1.5">
          {quickWins.length} quick wins available • Click to expand
        </p>
      )}
    </div>
  );
}
