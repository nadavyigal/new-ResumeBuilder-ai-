'use client';

import { Trash2, Download, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BulkActionsProps } from '@/types/history';

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
  const hasSelections = selectedCount > 0;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-md border">
      {/* Left side: Selection info and toggle */}
      <div className="flex items-center gap-3">
        {/* Selection count badge */}
        {hasSelections && (
          <Badge variant="secondary" className="h-7 px-3 text-sm font-medium">
            {selectedCount} selected
          </Badge>
        )}

        {/* Select All / Deselect All toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="gap-2"
          disabled={isProcessing || totalCount === 0}
          aria-label={allSelected ? 'Deselect all items' : 'Select all items'}
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4" />
              Deselect All
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4" />
              Select All
            </>
          )}
        </Button>

        {!hasSelections && (
          <span className="text-sm text-muted-foreground">
            Select items to perform bulk actions
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
            aria-label={`Export ${selectedCount} selected optimization${selectedCount > 1 ? 's' : ''}`}
          >
            <Download className="h-4 w-4" />
            Export Selected
            {selectedCount > 20 && (
              <span className="text-xs text-destructive ml-1">(max 20)</span>
            )}
          </Button>

          {/* Delete Selected button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={isProcessing || selectedCount > 50}
            className="gap-2"
            aria-label={`Delete ${selectedCount} selected optimization${selectedCount > 1 ? 's' : ''}`}
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
            {selectedCount > 50 && (
              <span className="text-xs ml-1">(max 50)</span>
            )}
          </Button>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
}
