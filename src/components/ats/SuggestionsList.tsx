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
}

export function SuggestionsList({
  suggestions,
  onApplySuggestion,
  maxSuggestions = 10,
}: SuggestionsListProps) {
  const displayedSuggestions = suggestions.slice(0, maxSuggestions);

  if (displayedSuggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Suggestions</CardTitle>
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Improvement Suggestions</CardTitle>
          <Badge variant="secondary">
            {displayedSuggestions.length} suggestions
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Quick Wins */}
          {quickWins.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-yellow-500" />
                <h3 className="font-semibold text-sm">Quick Wins</h3>
              </div>
              <div className="space-y-3">
                {quickWins.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={onApplySuggestion}
                  />
                ))}
              </div>
            </div>
          )}

          {/* High Impact */}
          {highImpact.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <h3 className="font-semibold text-sm">High Impact</h3>
              </div>
              <div className="space-y-3">
                {highImpact.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={onApplySuggestion}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Suggestions */}
          {otherSuggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-sm">Other Improvements</h3>
              </div>
              <div className="space-y-3">
                {otherSuggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={onApplySuggestion}
                  />
                ))}
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
  onApply,
}: {
  suggestion: Suggestion;
  onApply?: (suggestion: Suggestion) => void;
}) {
  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {suggestion.quick_win && (
              <Badge variant="default" className="text-xs">
                Quick Win
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {getCategoryLabel(suggestion.category)}
            </Badge>
          </div>
          <p className="text-sm text-gray-900">{suggestion.text}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold text-green-600">
            +{suggestion.estimated_gain} pts
          </div>
          {onApply && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => onApply(suggestion)}
            >
              Apply
            </Button>
          )}
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
