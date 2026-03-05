'use client';

import { Trash2, Download, CheckSquare, Square } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BulkActionsProps } from '@/types/history';
import { useTranslations } from 'next-intl';

/**
 * BulkActions Component
 * Feature: 005-history-view-previous (User Story 4 - T033)
 *
 * Toolbar for bulk operations on selected optimizations:
 * - Delete Selected button
 * - Export Selected button
 * - Select All / Deselect All toggle
 * - Selection count display
 */
export default function BulkActions({
  selectedCount,
  totalCount,
  onDeleteSelected,
  onExportSelected,
  onSelectAll,
  onDeselectAll,
  isProcessing,
}: BulkActionsProps) {
  const t = useTranslations('dashboard.history.bulk');
  const hasSelections = selectedCount > 0;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-md border">
      {/* Left side: Selection info and toggle */}
      <div className="flex items-center gap-3">
        {/* Selection count badge */}
        {hasSelections && (
          <Badge variant="secondary" className="h-7 px-3 text-sm font-medium">
            {t('selectedCount', { count: selectedCount })}
          </Badge>
        )}

        {/* Select All / Deselect All toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="gap-2"
          disabled={isProcessing || totalCount === 0}
          aria-label={allSelected ? t('aria.deselectAll') : t('aria.selectAll')}
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4" />
              {t('deselectAll')}
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4" />
              {t('selectAll')}
            </>
          )}
        </Button>

        {!hasSelections && (
          <span className="text-sm text-muted-foreground">
            {t('selectHint')}
          </span>
        )}
      </div>

      {/* Right side: Action buttons */}
      {hasSelections && (
        <div className="flex items-center gap-2">
          {/* Export Selected button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportSelected}
            disabled={isProcessing || selectedCount > 20}
            className="gap-2"
            aria-label={t('aria.exportSelected', { count: selectedCount })}
          >
            <Download className="h-4 w-4" />
            {t('exportSelected')}
            {selectedCount > 20 && (
              <span className="text-xs text-destructive ms-1">{t('max20')}</span>
            )}
          </Button>

          {/* Delete Selected button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={isProcessing || selectedCount > 50}
            className="gap-2"
            aria-label={t('aria.deleteSelected', { count: selectedCount })}
          >
            <Trash2 className="h-4 w-4" />
            {t('deleteSelected')}
            {selectedCount > 50 && (
              <span className="text-xs ms-1">{t('max50')}</span>
            )}
          </Button>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{t('processing')}</span>
        </div>
      )}
    </div>
  );
}
