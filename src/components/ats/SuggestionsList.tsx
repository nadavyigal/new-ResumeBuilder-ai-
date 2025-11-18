/**
 * Suggestions List Component
 *
 * Displays actionable suggestions with estimated score gains
 */

import React from 'react';
import type { Suggestion } from '@/lib/ats/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Zap, TrendingUp } from 'lucide-react';

interface SuggestionsListProps {
  suggestions: Suggestion[];
  onApplySuggestion?: (suggestion: Suggestion) => void;
  maxSuggestions?: number;
  title?: string;
  showNumbers?: boolean;
  appliedSuggestionIds?: string[];
}

export function SuggestionsList({
  suggestions,
  onApplySuggestion,
  maxSuggestions = 10,
  title = 'Improvement Suggestions',
  showNumbers = false,
  appliedSuggestionIds = [],
}: SuggestionsListProps) {
  const displayedSuggestions = suggestions.slice(0, maxSuggestions);

  if (displayedSuggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No suggestions - your resume is well-optimized!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const quickWins = displayedSuggestions.filter(s => s.quick_win);
  const highImpact = displayedSuggestions.filter(s => !s.quick_win && s.estimated_gain >= 8);
  const otherSuggestions = displayedSuggestions.filter(s => !s.quick_win && s.estimated_gain < 8);

  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {displayedSuggestions.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-3">
          {/* Quick Wins */}
          {quickWins.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-gray-200">
                <Zap className="w-3 h-3 text-yellow-500" />
                <h3 className="font-semibold text-xs text-gray-700">Quick Wins</h3>
                <span className="text-[10px] text-gray-500">({quickWins.length})</span>
              </div>
              <div className="space-y-1.5">
                {quickWins.map(suggestion => {
                  const globalIndex = displayedSuggestions.findIndex(s => s.id === suggestion.id);
                  return (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      index={showNumbers ? globalIndex : undefined}
                      isApplied={appliedSuggestionIds.includes(suggestion.id)}
                      onApply={onApplySuggestion}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* High Impact */}
          {highImpact.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-gray-200">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <h3 className="font-semibold text-xs text-gray-700">High Impact</h3>
                <span className="text-[10px] text-gray-500">({highImpact.length})</span>
              </div>
              <div className="space-y-1.5">
                {highImpact.map(suggestion => {
                  const globalIndex = displayedSuggestions.findIndex(s => s.id === suggestion.id);
                  return (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      index={showNumbers ? globalIndex : undefined}
                      isApplied={appliedSuggestionIds.includes(suggestion.id)}
                      onApply={onApplySuggestion}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Other Suggestions */}
          {otherSuggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-gray-200">
                <Lightbulb className="w-3 h-3 text-blue-500" />
                <h3 className="font-semibold text-xs text-gray-700">Other Improvements</h3>
                <span className="text-[10px] text-gray-500">({otherSuggestions.length})</span>
              </div>
              <div className="space-y-1.5">
                {otherSuggestions.map(suggestion => {
                  const globalIndex = displayedSuggestions.findIndex(s => s.id === suggestion.id);
                  return (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      index={showNumbers ? globalIndex : undefined}
                      isApplied={appliedSuggestionIds.includes(suggestion.id)}
                      onApply={onApplySuggestion}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionCard({
  suggestion,
  index,
  isApplied,
  onApply,
}: {
  suggestion: Suggestion;
  index?: number;
  isApplied?: boolean;
  onApply?: (suggestion: Suggestion) => void;
}) {
  return (
    <div className={`border rounded p-2 transition-all ${
      isApplied 
        ? 'bg-green-50 border-green-300 opacity-75' 
        : 'bg-white hover:bg-blue-50 hover:border-blue-300 border-gray-200'
    }`}>
      <div className="flex items-start gap-2">
        {/* Number badge - compact */}
        {index !== undefined && (
          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
            isApplied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            {index + 1}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1 mb-1">
            {isApplied && (
              <Badge variant="default" className="text-[10px] bg-green-600 px-1.5 py-0 h-4">
                ✓
              </Badge>
            )}
            {suggestion.quick_win && !isApplied && (
              <Badge variant="default" className="text-[10px] bg-yellow-500 px-1.5 py-0 h-4">
                ⚡
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] border-gray-300 px-1.5 py-0 h-4">
              {getCategoryLabel(suggestion.category)}
            </Badge>
            <span className={`text-[10px] font-bold ml-auto ${
              isApplied ? 'text-green-700' : 'text-green-600'
            }`}>
              +{suggestion.estimated_gain}
            </span>
          </div>
          <p className={`text-xs leading-tight ${isApplied ? 'text-gray-600 line-through' : 'text-gray-900'}`}>
            {suggestion.text}
          </p>
        </div>
      </div>
    </div>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    keywords: 'Keywords',
    formatting: 'Format',
    content: 'Content',
    structure: 'Structure',
    metrics: 'Metrics',
  };
  return labels[category] || category;
}
