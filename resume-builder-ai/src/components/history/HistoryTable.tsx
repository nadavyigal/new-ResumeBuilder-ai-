'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useOptimizations } from '@/hooks/useOptimizations';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import HistoryTableSkeleton from './HistoryTableSkeleton';
import EmptyState from './EmptyState';
import OptimizationRow from './OptimizationRow';
import HistorySearch from './HistorySearch';
import HistoryFilters from './HistoryFilters';
import HistoryPagination from './HistoryPagination';
import BulkActions from './BulkActions';
import { useToast } from '@/hooks/useToast';
import type { OptimizationHistoryEntry, HistoryFilters as FiltersType, SortConfig } from '@/types/history';
import {
  parseQueryParams,
  buildURLSearchParams,
  buildQueryParams,
  createDefaultFilters,
  createDefaultSort,
  countActiveFilters,
} from '@/lib/history-utils';

/**
 * HistoryTable Component
 * Feature: 005-history-view-previous (User Stories 1, 2, 3 & 4)
 *
 * Main table component displaying optimization history.
 * Now includes:
 * - Search functionality (T021, T025)
 * - Filters (date range, ATS score) (T022, T026)
 * - Pagination (T023, T027)
 * - Column sorting (T028)
 * - URL state synchronization (T029)
 * - No results state (T030)
 * - Apply Now flow (US2)
 * - Bulk actions (T034-T042): Select, Delete, Export
 */
export default function HistoryTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Parse initial state from URL or use defaults
  const initialState = parseQueryParams(searchParams);

  // State management
  const [filters, setFilters] = useState<FiltersType>(initialState.filters);
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialState.sort);
  const [pagination, setPagination] = useState(initialState.pagination);
  const [applyingIds, setApplyingIds] = useState<Set<number>>(new Set());

  // Bulk actions state (T034, T035)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Build query params for API
  const queryParams = buildQueryParams(filters, sortConfig, pagination);

  // Fetch optimizations using custom hook
  const { optimizations, pagination: paginationMeta, isLoading, error, refetch, invalidate } = useOptimizations(queryParams);

  /**
   * Update URL when state changes (debounced)
   */
  useEffect(() => {
    const urlParams = buildURLSearchParams(filters, sortConfig, pagination);
    const newUrl = urlParams ? `/dashboard/history?${urlParams}` : '/dashboard/history';

    // Use replace to avoid cluttering browser history
    router.replace(newUrl, { scroll: false });
  }, [filters, sortConfig, pagination, router]);

  /**
   * Handle search change (debounced in HistorySearch component)
   */
  const handleSearchChange = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
    // Reset to page 1 when search changes
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Handle search clear
   */
  const handleSearchClear = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: '' }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Handle filters change
   */
  const handleFiltersChange = useCallback((newFilters: FiltersType) => {
    setFilters(newFilters);
    // Reset to page 1 when filters change
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Handle clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setFilters(createDefaultFilters());
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Handle page change
   */
  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  /**
   * Handle items per page change
   */
  const handleLimitChange = useCallback((limit: number) => {
    setPagination({ page: 1, limit }); // Reset to page 1 when changing limit
  }, []);

  /**
   * Handle column sort
   */
  const handleSort = useCallback((column: 'date' | 'score' | 'company') => {
    setSortConfig((prev) => {
      // Toggle direction if clicking same column, otherwise default to desc
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { column, direction: 'desc' };
    });
  }, []);

  /**
   * Handle Apply Now action
   * Triggers PDF download, opens job URL, creates application record
   */
  const handleApplyNow = async (optimization: OptimizationHistoryEntry) => {
    // Check if already applying
    if (applyingIds.has(optimization.id)) {
      return;
    }

    // Warning if already applied
    if (optimization.hasApplication) {
      toast({
        variant: "default",
        title: "Already Applied",
        description: `You've already applied to this position on ${
          optimization.applicationDate
            ? new Date(optimization.applicationDate).toLocaleDateString()
            : 'a previous date'
        }. Creating a new application record.`,
      });
    }

    // Optimistic update - mark as applying
    setApplyingIds(prev => new Set(prev).add(optimization.id));

    try {
      // Step 1: Download PDF
      window.open(`/api/download/${optimization.id}`, '_blank');

      // Step 2: Open job URL if available
      if (optimization.jobUrl) {
        window.open(optimization.jobUrl, '_blank');
      }

      // Step 3: Create application record
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          optimization_id: optimization.id,
          job_title: optimization.jobTitle,
          company: optimization.company,
          job_url: optimization.jobUrl,
          status: 'applied',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create application record');
      }

      // Success - refresh data
      await invalidate();

      toast({
        variant: "default",
        title: "Application Started!",
        description: optimization.jobUrl
          ? "PDF downloaded and job posting opened. Application record created."
          : "PDF downloaded. Application record created.",
      });
    } catch (err) {
      // Revert optimistic update on error
      console.error('Apply Now error:', err);

      toast({
        variant: "destructive",
        title: "Application Failed",
        description: err instanceof Error ? err.message : "Failed to process application. Please try again.",
      });
    } finally {
      // Remove from applying set
      setApplyingIds(prev => {
        const next = new Set(prev);
        next.delete(optimization.id);
        return next;
      });
    }
  };

  /**
   * Handle selection change for a single row (T034)
   */
  const handleSelectionChange = useCallback((id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  /**
   * Handle Select All (T035)
   */
  const handleSelectAll = useCallback(() => {
    if (!optimizations) return;
    setSelectedIds(new Set(optimizations.map((opt) => opt.id)));
  }, [optimizations]);

  /**
   * Handle Deselect All (T035)
   */
  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Handle bulk delete button click (T037)
   * Shows confirmation dialog
   */
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowDeleteDialog(true);
  }, [selectedIds.size]);

  /**
   * Confirm and execute bulk delete (T038)
   */
  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0 || isBulkProcessing) return;

    setIsBulkProcessing(true);
    setShowDeleteDialog(false);

    try {
      const response = await fetch('/api/optimizations/bulk', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete optimizations');
      }

      const result = await response.json();

      // Clear selection
      setSelectedIds(new Set());

      // Refresh data
      await invalidate();

      // Show success toast
      toast({
        variant: 'default',
        title: 'Deletion Complete',
        description: `Successfully deleted ${result.deleted} optimization${
          result.deleted > 1 ? 's' : ''
        }.${
          result.errors?.length
            ? ` ${result.errors.length} item${result.errors.length > 1 ? 's' : ''} could not be deleted.`
            : ''
        }`,
      });

      // Show warning if applications were preserved
      if (result.preserved?.applications > 0) {
        toast({
          variant: 'default',
          title: 'Application Records Preserved',
          description: `${result.preserved.applications} application record${
            result.preserved.applications > 1 ? 's were' : ' was'
          } preserved and can be viewed in your applications history.`,
        });
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description:
          err instanceof Error
            ? err.message
            : 'Failed to delete optimizations. Please try again.',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  /**
   * Handle bulk export (T041)
   */
  const handleExportSelected = async () => {
    if (selectedIds.size === 0 || isBulkProcessing) return;

    setIsBulkProcessing(true);

    try {
      const response = await fetch('/api/optimizations/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          includeManifest: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export optimizations');
      }

      // Get the ZIP file as blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch?.[1] || `resume-optimizations-${new Date().toISOString().split('T')[0]}.zip`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Clear selection
      setSelectedIds(new Set());

      // Show success toast
      toast({
        variant: 'default',
        title: 'Export Complete',
        description: `Successfully exported ${selectedIds.size} optimization${
          selectedIds.size > 1 ? 's' : ''
        } to ZIP file.`,
      });
    } catch (err) {
      console.error('Bulk export error:', err);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description:
          err instanceof Error
            ? err.message
            : 'Failed to export optimizations. Please try again.',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  /**
   * Render sort icon for column header
   */
  const renderSortIcon = (column: 'date' | 'score' | 'company') => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Calculate active filter count
  const activeFilterCount = countActiveFilters(filters);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Show filter skeleton during initial load */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="h-9 w-full sm:w-80 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-full sm:w-auto flex gap-2">
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
        <HistoryTableSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        {/* Show filters even in error state */}
        <div className="flex flex-col sm:flex-row gap-4">
          <HistorySearch
            value={filters.search}
            onChange={handleSearchChange}
            onClear={handleSearchClear}
          />
          <HistoryFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>

        <div className="rounded-md border border-destructive bg-destructive/10 p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <p className="text-sm font-medium text-destructive">
              Failed to load optimization history
            </p>
            <p className="text-sm text-muted-foreground">
              {error.message}
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No results state (T030 - filtered but empty)
  const hasFilters = activeFilterCount > 0;
  const isEmpty = !optimizations || optimizations.length === 0;

  if (isEmpty && hasFilters) {
    return (
      <div className="space-y-4">
        {/* Show filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <HistorySearch
            value={filters.search}
            onChange={handleSearchChange}
            onClear={handleSearchClear}
          />
          <HistoryFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* No results message */}
        <div className="rounded-md border border-dashed p-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <p className="text-sm font-medium">No optimizations match your filters</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search criteria or clearing filters to see all optimizations.
            </p>
            <Button
              onClick={handleClearFilters}
              variant="outline"
              size="sm"
            >
              Clear filters
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no optimizations at all)
  if (isEmpty) {
    return <EmptyState />;
  }

  // Data table with filters and pagination
  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <HistorySearch
          value={filters.search}
          onChange={handleSearchChange}
          onClear={handleSearchClear}
        />
        <HistoryFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Bulk Actions Toolbar (T033) */}
      <BulkActions
        selectedCount={selectedIds.size}
        totalCount={optimizations?.length || 0}
        onDeleteSelected={handleDeleteSelected}
        onExportSelected={handleExportSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        isProcessing={isBulkProcessing}
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Checkbox Column Header (T034) */}
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    optimizations &&
                    optimizations.length > 0 &&
                    selectedIds.size === optimizations.length
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleSelectAll();
                    } else {
                      handleDeselectAll();
                    }
                  }}
                  aria-label="Select all optimizations"
                />
              </TableHead>

              {/* Date Created - Sortable */}
              <TableHead className="w-[180px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('date')}
                >
                  Date Created
                  {renderSortIcon('date')}
                </Button>
              </TableHead>

              {/* Job Title */}
              <TableHead>Job Title</TableHead>

              {/* Company - Sortable */}
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('company')}
                >
                  Company
                  {renderSortIcon('company')}
                </Button>
              </TableHead>

              {/* ATS Match % - Sortable */}
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('score')}
                >
                  ATS Match %
                  {renderSortIcon('score')}
                </Button>
              </TableHead>

              {/* Status */}
              <TableHead className="w-[120px]">Status</TableHead>

              {/* Actions */}
              <TableHead className="text-right w-[250px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimizations.map((optimization) => (
              <OptimizationRow
                key={optimization.id}
                optimization={optimization}
                onApplyNow={handleApplyNow}
                isApplying={applyingIds.has(optimization.id)}
                isSelected={selectedIds.has(optimization.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Delete Confirmation Dialog (T037) */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Optimizations?</DialogTitle>
            <DialogDescription>
              You are about to delete {selectedIds.size} optimization
              {selectedIds.size > 1 ? 's' : ''}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              The following will be permanently deleted:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Optimization records and PDF files</li>
              <li>Associated metadata and ATS scores</li>
            </ul>
            <p className="text-sm font-medium text-amber-600 dark:text-amber-500 mt-4">
              ⚠️ Application records will be preserved and remain accessible in
              your application history.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isBulkProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={isBulkProcessing}
            >
              {isBulkProcessing ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      <HistoryPagination
        pagination={paginationMeta}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />
    </div>
  );
}
