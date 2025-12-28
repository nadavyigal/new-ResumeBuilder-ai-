'use client';

/**
 * Quick Wins Section Component
 *
 * Displays 3 AI-powered before/after text improvements with copy functionality
 */

import React, { useState } from 'react';
import type { QuickWinSuggestion } from '@/lib/ats/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickWinsSectionProps {
  quickWins: QuickWinSuggestion[];
  className?: string;
}

export function QuickWinsSection({ quickWins, className }: QuickWinsSectionProps) {
  if (!quickWins || quickWins.length === 0) {
    return null;
  }

  const totalPotentialGain = quickWins.reduce((sum, qw) => sum + qw.estimated_impact, 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold">3 Quick Win Suggestions</h3>
        <Badge variant="secondary" className="ml-auto">
          +{totalPotentialGain} pts potential
        </Badge>
      </div>

      {/* Quick Wins List */}
      <div className="space-y-4">
        {quickWins.map((qw, index) => (
          <QuickWinCard key={qw.id} quickWin={qw} index={index} />
        ))}
      </div>

      {/* Educational Note */}
      <p className="text-sm text-gray-500 italic">
        These AI-generated suggestions show specific improvements to boost your ATS score.
        Copy and adapt them to your resume while staying truthful to your experience.
      </p>
    </div>
  );
}

function QuickWinCard({
  quickWin,
  index
}: {
  quickWin: QuickWinSuggestion;
  index: number;
}) {
  const [copiedField, setCopiedField] = useState<'original' | 'optimized' | null>(null);

  const handleCopy = async (text: string, field: 'original' | 'optimized') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Card className="border-l-4 border-l-yellow-400">
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
              Quick Win #{index + 1}
            </Badge>
            <Badge variant="outline">
              {getImprovementTypeLabel(quickWin.improvement_type)}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold">+{quickWin.estimated_impact} pts</span>
          </div>
        </div>

        {/* Location */}
        <div className="text-xs text-gray-500 mb-3">
          Location: {quickWin.location.section}
          {quickWin.location.subsection && ` → ${quickWin.location.subsection}`}
        </div>

        {/* Before/After Comparison */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Original */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">BEFORE</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => handleCopy(quickWin.original_text, 'original')}
              >
                {copiedField === 'original' ? (
                  <>
                    <Check className="w-3 h-3 text-green-600 mr-1" />
                    <span className="text-green-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm min-h-[80px]">
              {quickWin.original_text}
            </div>
          </div>

          {/* Optimized */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">AFTER (OPTIMIZED)</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => handleCopy(quickWin.optimized_text, 'optimized')}
              >
                {copiedField === 'optimized' ? (
                  <>
                    <Check className="w-3 h-3 text-green-600 mr-1" />
                    <span className="text-green-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm min-h-[80px]">
              {quickWin.optimized_text}
            </div>
          </div>
        </div>

        {/* Rationale */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-medium text-blue-900 mb-1">Why this improves your score:</div>
          <p className="text-sm text-blue-800">{quickWin.rationale}</p>

          {quickWin.keywords_added.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 items-center">
              <span className="text-xs text-blue-700">Keywords added:</span>
              {quickWin.keywords_added.map(keyword => (
                <Badge key={keyword} variant="secondary" className="text-xs bg-blue-100">
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getImprovementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    keyword_optimization: 'Keywords',
    quantified_achievement: 'Metrics',
    action_verb: 'Action Verbs',
    relevance_enhancement: 'Relevance',
  };
  return labels[type] || type;
}
