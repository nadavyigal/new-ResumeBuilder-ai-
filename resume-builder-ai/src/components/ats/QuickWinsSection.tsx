'use client';

/**
 * Quick Wins Section Component
 *
 * Displays AI-powered before/after text improvements with copy functionality.
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { QuickWinSuggestion } from '@/lib/ats/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Sparkles, TrendingUp } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface QuickWinsSectionProps {
  quickWins: QuickWinSuggestion[];
  className?: string;
}

export function QuickWinsSection({ quickWins, className }: QuickWinsSectionProps) {
  const t = useTranslations('landing.quickWins');
  if (!quickWins || quickWins.length === 0) {
    return null;
  }

  const totalPotentialGain = quickWins.reduce((sum, qw) => sum + qw.estimated_impact, 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold">
          {t('title', { count: quickWins.length })}
        </h3>
        <Badge variant="secondary" className="ml-auto">
          {t('potential', { points: totalPotentialGain })}
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
        {t('note')}
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
  const t = useTranslations('landing.quickWins');
  const [copiedField, setCopiedField] = useState<'original' | 'optimized' | null>(null);

  const typeLabels: Record<string, string> = {
    keyword_optimization: t('types.keyword_optimization'),
    quantified_achievement: t('types.quantified_achievement'),
    action_verb: t('types.action_verb'),
    relevance_enhancement: t('types.relevance_enhancement'),
  };
  const typeLabel = typeLabels[quickWin.improvement_type] || quickWin.improvement_type;

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
              {t('card.badge', { index: index + 1 })}
            </Badge>
            <Badge variant="outline">{typeLabel}</Badge>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {t('card.points', { points: quickWin.estimated_impact })}
            </span>
          </div>
        </div>

        {/* Location */}
        <div className="text-xs text-gray-500 mb-3">
          {quickWin.location.subsection
            ? t('card.locationWithSubsection', {
                section: quickWin.location.section,
                subsection: quickWin.location.subsection,
              })
            : t('card.location', { section: quickWin.location.section })}
        </div>

        {/* Before/After Comparison */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Original */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">{t('card.before')}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => handleCopy(quickWin.original_text, 'original')}
              >
                {copiedField === 'original' ? (
                  <>
                    <Check className="w-3 h-3 text-green-600 mr-1" />
                    <span className="text-green-600">{t('card.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    {t('card.copy')}
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
              <span className="text-xs font-medium text-gray-600">{t('card.after')}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => handleCopy(quickWin.optimized_text, 'optimized')}
              >
                {copiedField === 'optimized' ? (
                  <>
                    <Check className="w-3 h-3 text-green-600 mr-1" />
                    <span className="text-green-600">{t('card.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    {t('card.copy')}
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
          <div className="text-xs font-medium text-blue-900 mb-1">{t('card.rationaleTitle')}</div>
          <p className="text-sm text-blue-800">{quickWin.rationale}</p>

          {quickWin.keywords_added.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 items-center">
              <span className="text-xs text-blue-700">{t('card.keywords')}</span>
              {quickWin.keywords_added.map((keyword) => (
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
