/**
 * ATS Score Card Component
 *
 * Displays original vs optimized ATS scores with improvement delta
 */

import React, { useMemo } from 'react';
import type { ATSScoreOutput } from '@/lib/ats/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ATSScoreCardProps {
  scoreData: ATSScoreOutput;
  showDetails?: boolean;
  afterSummary?: {
    score: number;
    before: number | null;
    delta: number | null;
  };
}

export function ATSScoreCard({ scoreData, showDetails = true, afterSummary }: ATSScoreCardProps) {
  const summary = useMemo(() => {
    const after = typeof afterSummary?.score === 'number' ? afterSummary.score : scoreData.ats_score_optimized;
    const before = afterSummary?.before ?? scoreData.ats_score_original ?? null;
    const delta = typeof afterSummary?.delta === 'number'
      ? afterSummary.delta
      : before !== null
        ? after - before
        : null;

    const improvementPercent = before && before > 0 && delta !== null
      ? ((delta / before) * 100).toFixed(1)
      : null;

    return { after, before, delta, improvementPercent };
  }, [afterSummary, scoreData.ats_score_optimized, scoreData.ats_score_original]);

  const hasImprovement = summary.delta !== null && summary.delta !== 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>ATS Match Score</span>
          <Badge variant={getConfidenceBadgeVariant(scoreData.confidence)}>
            {getConfidenceLabel(scoreData.confidence)} Confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Score Comparison */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Original</div>
            <div className={`text-4xl font-bold ${getScoreColor(summary.before ?? scoreData.ats_score_original)}`}>
              {summary.before ?? scoreData.ats_score_original}
            </div>
            <div className="text-xs text-gray-500">out of 100</div>
          </div>

          <div className="flex flex-col items-center px-4">
            <ArrowRight className="w-8 h-8 text-gray-400 mb-2" />
            {hasImprovement && summary.delta !== null && summary.delta > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+{summary.delta} pts</span>
              </div>
            )}
            {summary.delta !== null && summary.delta <= 0 && (
              <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
                {summary.delta === 0 ? 'No change' : `${summary.delta} pts`}
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Optimized</div>
            <div className={`text-4xl font-bold ${getScoreColor(summary.after)}`}>
              {summary.after}
            </div>
            <div className="text-xs text-gray-500">out of 100</div>
          </div>
        </div>

        {/* Improvement Summary */}
        {summary.delta !== null && summary.delta !== 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">
                  {summary.delta > 0 ? `+${summary.delta}` : summary.delta} point change
                  {summary.improvementPercent ? ` (${summary.improvementPercent}%)` : null}
                </div>
                <div className="text-sm text-green-700">
                  Your optimized resume scores significantly better!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delta Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className="text-xs">
            Before: {summary.before ?? '—'}
          </Badge>
          <Badge
            className={cn(
              'text-xs',
              summary.delta !== null && summary.delta > 0 && 'bg-emerald-100 text-emerald-700',
              summary.delta !== null && summary.delta < 0 && 'bg-red-100 text-red-700',
              summary.delta === 0 && 'bg-slate-100 text-slate-700'
            )}
          >
            Δ {summary.delta !== null && summary.delta > 0 ? `+${summary.delta}` : summary.delta ?? '—'}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            After: {summary.after}
          </Badge>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Processing Time:</span>
              <span className="font-medium">{scoreData.metadata.processing_time_ms}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Analyzers Used:</span>
              <span className="font-medium">{scoreData.metadata.analyzers_used.length}/8</span>
            </div>
            {scoreData.metadata.warnings.length > 0 && (
              <div className="mt-2 text-amber-600 text-xs">
                ⚠️ {scoreData.metadata.warnings[0]}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

function getConfidenceBadgeVariant(confidence: number): 'default' | 'secondary' | 'destructive' {
  if (confidence >= 0.8) return 'default';
  if (confidence >= 0.5) return 'secondary';
  return 'destructive';
}
