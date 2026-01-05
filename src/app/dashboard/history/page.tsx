import dynamic from 'next/dynamic';
import HistoryTableSkeleton from '@/components/history/HistoryTableSkeleton';
import ErrorBoundary from '@/components/history/ErrorBoundary';

const HistoryTable = dynamic(
  () => import('@/components/history/HistoryTable'),
  {
    loading: () => <HistoryTableSkeleton />,
  }
);

/**
 * History Page - View All Previous Optimizations
 * Feature: 005-history-view-previous (User Story 1, Phase 7 - T043)
 *
 * This page displays a comprehensive list of all resume optimizations
 * the user has created, with filtering, sorting, and action capabilities.
 *
 * Wrapped with ErrorBoundary for graceful error handling.
 */
export default function HistoryPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col space-y-6">
        {/* Page Header */}
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Optimization History
          </h1>
          <p className="text-muted-foreground">
            View and manage all your resume optimizations
          </p>
        </div>

        {/* History Table with Error Boundary */}
        <ErrorBoundary fallbackMessage="Unable to load your optimization history. Please try again.">
          <HistoryTable />
        </ErrorBoundary>
      </div>
    </div>
  );
}
