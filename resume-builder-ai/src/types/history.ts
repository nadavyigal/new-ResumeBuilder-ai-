/**
 * Type definitions for History View feature
 * Feature: 005-history-view-previous
 *
 * This file contains all TypeScript interfaces and types for:
 * - API request/response structures
 * - Frontend state management
 * - Component props and data structures
 */

// ============================================================================
// API Types (Request/Response)
// ============================================================================

/**
 * Query parameters for GET /api/optimizations
 * Used to filter, sort, and paginate optimization history
 */
export interface OptimizationsQueryParams {
  /** Page number (1-indexed, default: 1) */
  page?: number;

  /** Items per page (default: 20, max: 100) */
  limit?: number;

  /** Sort field (default: 'date') */
  sort?: 'date' | 'score' | 'company';

  /** Sort direction (default: 'desc') */
  order?: 'asc' | 'desc';

  /** Filter by date range start (ISO 8601 format) */
  dateFrom?: string;

  /** Filter by date range end (ISO 8601 format) */
  dateTo?: string;

  /** Filter by minimum match score (0-1 scale) */
  minScore?: number;

  /** Search query for job title/company (case-insensitive partial match) */
  search?: string;
}

/**
 * Response from GET /api/optimizations
 * Contains paginated optimization history with metadata
 */
export interface OptimizationsResponse {
  /** Request success status */
  success: boolean;

  /** Array of optimization entries */
  optimizations: OptimizationHistoryEntry[];

  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Single optimization entry in history view
 * Represents one row in the history table
 */
export interface OptimizationHistoryEntry {
  /** Optimization ID (unique identifier) */
  id: string;

  /** Creation timestamp (ISO 8601 format) */
  createdAt: string;

  /** Job title from job description (null if missing) */
  jobTitle: string | null;

  /** Company name from job description (null if missing) */
  company: string | null;

  /** ATS match score (0-1 scale, e.g., 0.85 = 85%) */
  matchScore: number;

  /** Optimization status (e.g., "completed", "processing", "failed") */
  status: string;

  /** Source job posting URL (null if not scraped from URL) */
  jobUrl: string | null;

  /** Template key used for this optimization (e.g., "ats-safe", "minimal-ssr") */
  templateKey: string | null;

  /** Whether this optimization has been applied to (has application record) */
  hasApplication: boolean;

  /** Application status if exists (e.g., "applied", "interviewing") */
  applicationStatus?: ApplicationStatus;

  /** Applied date if exists (ISO 8601 format) */
  applicationDate?: string;

  /** Application ID if exists */
  applicationId?: string;
}

/**
 * Pagination metadata
 * Provides information about current page and total results
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;

  /** Items per page */
  limit: number;

  /** Total items matching filters */
  total: number;

  /** Whether more pages exist after current page */
  hasMore: boolean;

  /** Total number of pages */
  totalPages: number;
}

/**
 * Application status enum
 * Represents the current state of a job application
 */
export type ApplicationStatus =
  | 'saved'        // Saved but not yet applied
  | 'applied'      // Application submitted
  | 'interviewing' // In interview process
  | 'offer'        // Received job offer
  | 'rejected'     // Application rejected
  | 'withdrawn';   // User withdrew application

/**
 * Bulk delete request
 * Used for deleting multiple optimizations at once (P4 feature)
 */
export interface BulkDeleteRequest {
  /** Array of optimization IDs to delete (max 50) */
  ids: string[];
}

/**
 * Bulk delete response
 * Provides feedback on deletion operation
 */
export interface BulkDeleteResponse {
  /** Request success status */
  success: boolean;

  /** Number of optimizations successfully deleted */
  deleted: number;

  /** Errors encountered (if any) */
  errors?: Array<{ id: string; error: string }>;

  /** Information about preserved records */
  preserved: {
    /** Number of application records preserved (not deleted) */
    applications: number;
  };
}

/**
 * Bulk export request
 * Used for exporting multiple optimization PDFs (P4 feature)
 */
export interface BulkExportRequest {
  /** Array of optimization IDs to export (max 20) */
  ids: string[];

  /** Whether to include metadata manifest file in ZIP */
  includeManifest?: boolean;
}

// ============================================================================
// Frontend State Types
// ============================================================================

/**
 * History page state management
 * Complete state for the history page component
 */
export interface HistoryPageState {
  // Data
  /** List of optimization entries currently displayed */
  optimizations: OptimizationHistoryEntry[];

  /** Set of selected optimization IDs (for bulk operations) */
  selectedIds: Set<number>;

  // Filters
  /** Current active filters */
  filters: HistoryFilters;

  // Pagination
  /** Pagination metadata from API */
  pagination: PaginationMeta;

  // UI State
  /** Whether data is currently loading */
  isLoading: boolean;

  /** Error message if request failed (null if no error) */
  error: string | null;

  /** Current sort configuration */
  sortConfig: SortConfig;

  // Bulk operations
  /** Active bulk operation state (null if no operation in progress) */
  bulkOperation: BulkOperationState | null;
}

/**
 * Filter state
 * Manages all filter criteria for history view
 */
export interface HistoryFilters {
  /** Search text for job title/company (empty string if no search) */
  search: string;

  /** Date range filter (null if no date filter applied) */
  dateRange: {
    from: Date;
    to: Date;
  } | null;

  /** Minimum match score filter in percentage (0-100, null if no filter) */
  minScore: number | null;
}

/**
 * Sort configuration
 * Defines current sorting behavior
 */
export interface SortConfig {
  /** Column to sort by */
  column: 'date' | 'score' | 'company';

  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Bulk operation state
 * Tracks progress of bulk delete or export operations
 */
export interface BulkOperationState {
  /** Type of bulk operation */
  type: 'delete' | 'export';

  /** Whether operation is currently processing */
  isProcessing: boolean;

  /** Progress information (optional) */
  progress?: {
    /** Current item being processed */
    current: number;

    /** Total items to process */
    total: number;
  };
}

/**
 * Table row action result
 * Result of a user action on a table row
 */
export interface RowActionResult {
  /** Whether action succeeded */
  success: boolean;

  /** Type of action performed */
  action: 'view' | 'download' | 'apply';

  /** Optimization ID that action was performed on */
  optimizationId: number;

  /** Error message if action failed */
  error?: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for HistoryTable component
 */
export interface HistoryTableProps {
  /** Optional: Initial filter state */
  initialFilters?: Partial<HistoryFilters>;

  /** Optional: Initial sort configuration */
  initialSort?: Partial<SortConfig>;

  /** Optional: Callback when row is clicked */
  onRowClick?: (optimization: OptimizationHistoryEntry) => void;
}

/**
 * Props for OptimizationRow component
 */
export interface OptimizationRowProps {
  /** Optimization data for this row */
  optimization: OptimizationHistoryEntry;

  /** Whether this row is selected (for bulk operations) */
  isSelected: boolean;

  /** Callback when row selection changes */
  onSelectionChange: (id: number, selected: boolean) => void;

  /** Callback when "View Details" is clicked */
  onViewDetails: (id: number) => void;

  /** Callback when "Download PDF" is clicked */
  onDownloadPDF: (id: number) => void;

  /** Callback when "Apply Now" is clicked */
  onApplyNow: (optimization: OptimizationHistoryEntry) => void;
}

/**
 * Props for HistoryFilters component
 */
export interface HistoryFiltersProps {
  /** Current filter state */
  filters: HistoryFilters;

  /** Callback when filters change */
  onFiltersChange: (filters: HistoryFilters) => void;

  /** Callback when "Clear Filters" is clicked */
  onClearFilters: () => void;

  /** Number of active filters (for badge display) */
  activeFilterCount: number;
}

/**
 * Props for HistorySearch component
 */
export interface HistorySearchProps {
  /** Current search value */
  value: string;

  /** Callback when search value changes (debounced) */
  onChange: (value: string) => void;

  /** Callback when search is cleared */
  onClear: () => void;

  /** Placeholder text */
  placeholder?: string;
}

/**
 * Props for HistoryPagination component
 */
export interface HistoryPaginationProps {
  /** Current pagination state */
  pagination: PaginationMeta;

  /** Callback when page changes */
  onPageChange: (page: number) => void;

  /** Callback when items per page changes */
  onLimitChange: (limit: number) => void;
}

/**
 * Props for BulkActions component
 */
export interface BulkActionsProps {
  /** Number of items currently selected */
  selectedCount: number;

  /** Total number of items available */
  totalCount: number;

  /** Callback when "Delete Selected" is clicked */
  onDeleteSelected: () => void;

  /** Callback when "Export Selected" is clicked */
  onExportSelected: () => void;

  /** Callback when "Select All" is clicked */
  onSelectAll: () => void;

  /** Callback when "Deselect All" is clicked */
  onDeselectAll: () => void;

  /** Whether bulk operation is in progress */
  isProcessing: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Date range preset options
 * Predefined date ranges for quick filtering
 */
export type DateRangePreset =
  | 'last-7-days'
  | 'last-30-days'
  | 'last-90-days'
  | 'custom';

/**
 * Score filter preset options
 * Predefined score thresholds for quick filtering
 */
export type ScoreFilterPreset =
  | 'all'
  | '90-plus'  // 90% and above
  | '80-plus'  // 80% and above
  | '70-plus'; // 70% and above

/**
 * Helper type for converting score filter preset to number
 */
export const SCORE_FILTER_VALUES: Record<ScoreFilterPreset, number | null> = {
  'all': null,
  '90-plus': 0.9,
  '80-plus': 0.8,
  '70-plus': 0.7,
};

/**
 * Helper type for date range presets in days
 */
export const DATE_RANGE_DAYS: Record<Exclude<DateRangePreset, 'custom'>, number> = {
  'last-7-days': 7,
  'last-30-days': 30,
  'last-90-days': 90,
};
