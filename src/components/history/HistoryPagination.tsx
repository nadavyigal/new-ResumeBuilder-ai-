'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HistoryPaginationProps } from '@/types/history';
import { useTranslations } from 'next-intl';

/**
 * HistoryPagination Component
 * Feature: 005-history-view-previous (User Story 3 - T023)
 *
 * Pagination controls for optimization history table:
 * - Page numbers with Previous/Next buttons
 * - Jump to first/last page
 * - Items per page selector
 * - Total count display
 */
export default function HistoryPagination({
  pagination,
  onPageChange,
  onLimitChange,
}: HistoryPaginationProps) {
  const t = useTranslations('dashboard.history.pagination');
  const { page, limit, total, totalPages, hasMore } = pagination;

  // Calculate display range
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  /**
   * Generate page numbers to display
   * Shows: [1] ... [current-1] [current] [current+1] ... [last]
   */
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    // Always show first page
    pages.push(1);

    if (page > 3) {
      pages.push('ellipsis');
    }

    // Show pages around current page
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
      {/* Left side: Items per page selector + count */}
      <div className="flex items-center gap-4">
        {/* Items per page */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('rowsPerPage')}</span>
          <Select
            value={limit.toString()}
            onValueChange={(value) => onLimitChange(parseInt(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Count display */}
        <div className="text-sm text-muted-foreground">
          {total === 0 ? (
            t('noResults')
          ) : (
            t('showing', { start: startItem, end: endItem, total })
          )}
        </div>
      </div>

      {/* Right side: Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Jump to first page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            aria-label={t('ariaFirst')}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Previous page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label={t('ariaPrev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-2">
            {pageNumbers.map((pageNum, index) => {
              if (pageNum === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-muted-foreground"
                  >
                    ...
                  </span>
                );
              }

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(pageNum)}
                  aria-label={t('ariaPage', { page: pageNum })}
                  aria-current={page === pageNum ? 'page' : undefined}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          {/* Next page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore}
            aria-label={t('ariaNext')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Jump to last page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            aria-label={t('ariaLast')}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
