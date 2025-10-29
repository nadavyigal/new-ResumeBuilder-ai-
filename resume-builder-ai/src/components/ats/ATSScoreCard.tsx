/**
 * ATS Score Card Component
 *
 * Displays original vs optimized ATS scores with improvement delta
 */

import React from 'react';
import type { ATSScoreOutput } from '@/lib/ats/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp } from 'lucide-react';

interface ATSScoreCardProps {
  scoreData: ATSScoreOutput;
  showDetails?: boolean;
}

export function ATSScoreCard({ scoreData, showDetails = true }: ATSScoreCardProps) {
  const improvement = scoreData.ats_score_optimized - scoreData.ats_score_original;
  const improvementPercent = scoreData.ats_score_original > 0
    ? ((improvement / scoreData.ats_score_original) * 100).toFixed(1)
    : '0';

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
            <div className={`text-4xl font-bold ${getScoreColor(scoreData.ats_score_original)}`}>
              {scoreData.ats_score_original}
            </div>
            <div className="text-xs text-gray-500">out of 100</div>
          </div>

          <div className="flex flex-col items-center px-4">
            <ArrowRight className="w-8 h-8 text-gray-400 mb-2" />
            {improvement > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+{improvement} pts</span>
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Optimized</div>
            <div className={`text-4xl font-bold ${getScoreColor(scoreData.ats_score_optimized)}`}>
              {scoreData.ats_score_optimized}
            </div>
            <div className="text-xs text-gray-500">out of 100</div>
          </div>
        </div>

        {/* Improvement Summary */}
        {improvement > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">
                  {improvement} point improvement ({improvementPercent}%)
                </div>
                <div className="text-sm text-green-700">
                  Your optimized resume scores significantly better!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        {showDetails && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Processing Time:</span>
              <span className="font-medium">{scoreData.metadata.processing_time_ms}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Analyzers Used:</span>
              <span className="font-medium">{scoreData.metadata.analyzers_used?.length || 8}/8</span>
            </div>
            {scoreData.metadata.warnings && scoreData.metadata.warnings.length > 0 && (
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
