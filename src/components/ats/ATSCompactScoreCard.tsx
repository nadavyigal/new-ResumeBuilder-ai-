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
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center justify-between gap-6">
        {/* Left: Title and comparison */}
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 mb-1.5">
            ATS Match Score
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <span>Original: <span className="font-semibold">{scoreData.ats_score_original}%</span></span>
            <span className="mx-1 text-green-600">→</span>
            <span>Optimized: <span className="font-semibold">{scoreData.ats_score_optimized}%</span></span>
            {improvement !== 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-green-200 text-green-700 rounded font-semibold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {improvementSign}{improvement}
              </span>
            )}
          </div>
        </div>

        {/* Right: Circular score + Details link */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
            {scoreData.ats_score_optimized}%
          </div>
          <Link
            href={`#ats-details`}
            className="text-sm text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap flex items-center gap-1"
          >
            Details <span className="text-base">›</span>
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

