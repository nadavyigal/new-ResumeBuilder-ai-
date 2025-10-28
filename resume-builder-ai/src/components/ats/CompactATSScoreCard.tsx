/**
 * Compact ATS Score Card Component
 *
 * Displays ATS scores in a condensed format for the optimization page header
 */

import React, { useState } from 'react';
import type { ATSScoreOutput } from '@/lib/ats/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SubScoreBreakdown } from './SubScoreBreakdown';
import { ArrowRight, TrendingUp, ChevronRight } from 'lucide-react';

interface CompactATSScoreCardProps {
  atsScoreOriginal: number;
  atsScoreOptimized: number;
  subscores?: any;
  subscoresOriginal?: any;
  legacy?: boolean; // If true, using legacy single score
}

export function CompactATSScoreCard({
  atsScoreOriginal,
  atsScoreOptimized,
  subscores,
  subscoresOriginal,
  legacy = false,
}: CompactATSScoreCardProps) {
  const improvement = atsScoreOptimized - atsScoreOriginal;
  const hasV2Data = !legacy && subscores && subscoresOriginal;

  return (
    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
            ATS Match Score
          </p>

          {/* Score Comparison - Inline */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-600 dark:text-gray-400">Original:</span>
              <span className={`font-semibold ${getScoreColor(atsScoreOriginal)}`}>
                {atsScoreOriginal}%
              </span>
            </div>

            <ArrowRight className="w-3 h-3 text-gray-400" />

            <div className="flex items-center gap-1">
              <span className="text-gray-600 dark:text-gray-400">Optimized:</span>
              <span className={`font-semibold ${getScoreColor(atsScoreOptimized)}`}>
                {atsScoreOptimized}%
              </span>
            </div>

            {improvement > 0 && (
              <div className="flex items-center gap-0.5 text-green-600 dark:text-green-400 ml-1">
                <TrendingUp className="w-3 h-3" />
                <span className="font-semibold">+{improvement}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Main score and details link */}
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xl rounded-full font-bold">
            {atsScoreOptimized}%
          </span>

          {/* Details button - only show if v2 data available */}
          {hasV2Data && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 text-xs hover:bg-green-100 dark:hover:bg-green-900/50"
                >
                  <span className="text-green-700 dark:text-green-300">Details</span>
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Detailed ATS Score Breakdown</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <SubScoreBreakdown
                    subscores={subscores}
                    subscores_original={subscoresOriginal}
                    showComparison={true}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Legacy indicator */}
          {legacy && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              v1
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}
