/**
 * Sub-Score Breakdown Component
 *
 * Displays all 8 sub-scores with progress bars and tooltips
 */

import React from 'react';
import type { SubScores } from '@/lib/ats/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Info } from '@/lib/icons';
import { useTranslations } from 'next-intl';

interface SubScoreBreakdownProps {
  subscores: SubScores;
  subscores_original?: SubScores;
  showComparison?: boolean;
}

export function SubScoreBreakdown({
  subscores,
  subscores_original,
  showComparison = false,
}: SubScoreBreakdownProps) {
  const t = useTranslations('dashboard.ats.subscores');

  const labels: Record<keyof SubScores, { label: string; description: string }> = {
    keyword_exact: {
      label: t('keywordExact.label'),
      description: t('keywordExact.description'),
    },
    keyword_phrase: {
      label: t('keywordPhrase.label'),
      description: t('keywordPhrase.description'),
    },
    semantic_relevance: {
      label: t('semanticRelevance.label'),
      description: t('semanticRelevance.description'),
    },
    title_alignment: {
      label: t('titleAlignment.label'),
      description: t('titleAlignment.description'),
    },
    metrics_presence: {
      label: t('metricsPresence.label'),
      description: t('metricsPresence.description'),
    },
    section_completeness: {
      label: t('sectionCompleteness.label'),
      description: t('sectionCompleteness.description'),
    },
    format_parseability: {
      label: t('formatParseability.label'),
      description: t('formatParseability.description'),
    },
    recency_fit: {
      label: t('recencyFit.label'),
      description: t('recencyFit.description'),
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(subscores).map(([key, score]) => {
            const config = labels[key as keyof SubScores];
            const originalScore = subscores_original?.[key as keyof SubScores];
            const improvement = originalScore !== undefined ? score - originalScore : 0;

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{config.label}</span>
                    <div className="group relative">
                      <Info className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                        {config.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getScoreColor(score)}`}>
                      {score}
                    </span>
                    {showComparison && improvement !== 0 && (
                      <span className={`text-xs ${improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({improvement > 0 ? '+' : ''}{improvement})
                      </span>
                    )}
                  </div>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}
