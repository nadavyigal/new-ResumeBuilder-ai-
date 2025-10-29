"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface AutoUpgradeATSV2Props {
  optimizationId: string;
  hasV2Data: boolean;
  onUpgradeComplete: () => void;
}

/**
 * Automatically upgrade old optimizations to ATS v2
 * Shows a banner if the optimization doesn't have ATS v2 data
 */
export function AutoUpgradeATSV2({ optimizationId, hasV2Data, onUpgradeComplete }: AutoUpgradeATSV2Props) {
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already has v2 data or was dismissed
  if (hasV2Data || dismissed) {
    return null;
  }

  const handleUpgrade = async () => {
    setUpgrading(true);
    setError(null);

    try {
      const response = await fetch('/api/ats/rescan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          optimization_id: optimizationId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to upgrade ATS scoring');
      }

      const result = await response.json();
      console.log('✅ ATS v2 upgrade successful:', result);

      // Reload the page data
      onUpgradeComplete();
    } catch (err) {
      console.error('❌ ATS v2 upgrade failed:', err);
      setError(err instanceof Error ? err.message : 'Upgrade failed');
      setUpgrading(false);
    }
  };

  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg shadow-sm">
      <div className="flex items-start gap-3">
        <div className="text-3xl">✨</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">
            ATS v2 Upgrade Available
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
            This optimization was created with the older ATS scoring system. Upgrade now to see:
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 mb-4 ml-4">
            <li>• <strong>Detailed score breakdown</strong> with 8 specific metrics</li>
            <li>• <strong>Original vs Optimized</strong> comparison</li>
            <li>• <strong>Improvement suggestions</strong> with quick wins</li>
            <li>• <strong>Better accuracy</strong> with AI-powered analysis</li>
          </ul>
          
          {error && (
            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-sm text-red-800 dark:text-red-200">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {upgrading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Upgrading...
                </>
              ) : (
                <>
                  <span className="mr-2">🚀</span>
                  Upgrade to ATS v2
                </>
              )}
            </Button>
            <Button
              onClick={() => setDismissed(true)}
              variant="ghost"
              className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

