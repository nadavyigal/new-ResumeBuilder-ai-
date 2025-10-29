/**
 * ATS Compact Score Card Component
 *
 * Displays a condensed version of ATS scores for the optimization page header
 * Shows original vs optimized scores with improvement delta in a compact layout
 */

import React from 'react';
import Link from 'next/link';
import type { ATSScoreOutput } from '@/lib/ats/types';

interface ATSCompactScoreCardProps {
  scoreData: ATSScoreOutput;
  optimizationId: string;
}

export function ATSCompactScoreCard({ scoreData, optimizationId }: ATSCompactScoreCardProps) {
  const improvement = scoreData.ats_score_optimized - scoreData.ats_score_original;
  const improvementSign = improvement > 0 ? '+' : '';

  return (
    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title and comparison */}
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
            ATS Match Score
          </p>
          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
            <span>Original: {scoreData.ats_score_original}%</span>
            <span>→</span>
            <span>Optimized: {scoreData.ats_score_optimized}%</span>
            {improvement !== 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-200/50 dark:bg-green-800/50 rounded font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {improvementSign}{improvement}
              </span>
            )}
          </div>
        </div>

        {/* Right: Large score + Details link */}
        <div className="flex items-center gap-3">
          <div className={`text-3xl font-bold ${getScoreColor(scoreData.ats_score_optimized)}`}>
            {scoreData.ats_score_optimized}%
          </div>
          <Link
            href={`#ats-details`}
            className="text-sm text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 underline whitespace-nowrap"
          >
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

