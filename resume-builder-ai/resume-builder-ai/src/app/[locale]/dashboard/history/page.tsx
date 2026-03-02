import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
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
export default async function HistoryPage() {
  const t = await getTranslations('dashboard.history');

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col space-y-6">
        {/* Page Header */}
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {/* History Table with Error Boundary */}
        <ErrorBoundary fallbackMessage={t('errorBoundary.fallbackMessage')}>
          <HistoryTable />
        </ErrorBoundary>
      </div>
    </div>
  );
}
