/**
 * Sub-Score Breakdown Component
 *
 * Displays all 8 sub-scores with progress bars and tooltips
 */

import React from 'react';
import type { SubScores } from '@/lib/ats/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Info } from 'lucide-react';

interface SubScoreBreakdownProps {
  subscores: SubScores;
  subscores_original?: SubScores;
  showComparison?: boolean;
}

const SUB_SCORE_LABELS: Record<keyof SubScores, { label: string; description: string }> = {
  keyword_exact: {
    label: 'Exact Keywords',
    description: 'Matches exact keywords from job description (must-have and nice-to-have skills)',
  },
  keyword_phrase: {
    label: 'Phrase Matching',
    description: 'Matches multi-word phrases and responsibilities from job description',
  },
  semantic_relevance: {
    label: 'Semantic Relevance',
    description: 'Overall relevance of experience and skills beyond exact keywords',
  },
  title_alignment: {
    label: 'Title Alignment',
    description: 'How well your job titles match the target role and seniority level',
  },
  metrics_presence: {
    label: 'Quantified Metrics',
    description: 'Presence of measurable achievements (%, $, numbers, timeframes)',
  },
  section_completeness: {
    label: 'Section Completeness',
    description: 'Presence and quality of required resume sections',
  },
  format_parseability: {
    label: 'ATS-Safe Format',
    description: 'Resume format compatibility with ATS systems (no tables, images, multi-column)',
  },
  recency_fit: {
    label: 'Recency Fit',
    description: 'How recent and relevant your skills and experience are',
  },
};

export function SubScoreBreakdown({
  subscores,
  subscores_original,
  showComparison = false,
}: SubScoreBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(subscores).map(([key, score]) => {
            const config = SUB_SCORE_LABELS[key as keyof SubScores];
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
