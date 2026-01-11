'use client';

import { memo } from 'react';
import { Link } from "@/navigation";
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { OptimizationHistoryEntry } from '@/types/history';
import { Eye, Download, Send, Loader2 } from '@/lib/icons';
import { useLocale, useTranslations } from 'next-intl';

/**
 * OptimizationRow Component
 * Feature: 005-history-view-previous (User Story 1, 2 & 4, Phase 7 - T046)
 *
 * Single row in the history table representing one optimization.
 * Displays formatted date, job details, match score, status badge, action buttons,
 * "Apply Now" functionality with applied badge, and bulk selection checkbox.
 *
 * Optimized with React.memo to prevent unnecessary re-renders.
 */

interface OptimizationRowProps {
  optimization: OptimizationHistoryEntry;
  onApplyNow: (optimization: OptimizationHistoryEntry) => void;
  isApplying: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

function OptimizationRow({
  optimization,
  onApplyNow,
  isApplying,
  isSelected = false,
  onSelectionChange
}: OptimizationRowProps) {
  const t = useTranslations('dashboard.history.row');
  const locale = useLocale();
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-US';

  // Format date to readable string
  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat(dateLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Format match score as percentage
  const formatScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  // Get status badge variant
  const getStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'completed') return t('status.completed');
    if (normalized === 'processing') return t('status.processing');
    if (normalized === 'failed') return t('status.failed');
    return status;
  };

  // Handle PDF download
  const handleDownloadPDF = () => {
    // Open download endpoint in new window to trigger download
    window.open(`/api/download/${optimization.id}?fmt=pdf`, '_blank');
  };

  return (
    <TableRow className={isSelected ? 'bg-muted/50' : ''}>
      {/* Checkbox (T034) */}
      {onSelectionChange && (
        <TableCell className="w-[50px]">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) =>
              onSelectionChange(optimization.id, checked as boolean)
            }
            aria-label={t('selectOptimization', { id: optimization.id })}
          />
        </TableCell>
      )}

      {/* Date Created */}
      <TableCell className="font-medium">
        {formatDate(optimization.createdAt)}
      </TableCell>

      {/* Job Title */}
      <TableCell>
        {optimization.jobTitle || <span className="text-muted-foreground">{t('na')}</span>}
      </TableCell>

      {/* Company */}
      <TableCell>
        {optimization.company || <span className="text-muted-foreground">{t('na')}</span>}
      </TableCell>

      {/* ATS Match % */}
      <TableCell>
        <span className="font-semibold">
          {formatScore(optimization.matchScore)}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell>
        <div className="flex gap-2">
          <Badge variant={getStatusVariant(optimization.status)}>
            {getStatusLabel(optimization.status)}
          </Badge>

          {/* Applied Badge (T017) */}
          {optimization.hasApplication && (
            <Badge
              variant="success"
              className="cursor-help"
              title={t('appliedOn', {
                date: optimization.applicationDate
                  ? new Date(optimization.applicationDate).toLocaleDateString(dateLocale)
                  : t('unknownDate'),
              })}
            >
              {t('applied')}
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {/* View Details Button */}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/optimizations/${optimization.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              {t('viewDetails')}
            </Link>
          </Button>

          {/* Download PDF Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
          >
            <Download className="h-4 w-4 mr-1" />
            {t('downloadPdf')}
          </Button>

          {/* Apply Now Button (T015) */}
          <Button
            variant={optimization.hasApplication ? "secondary" : "default"}
            size="sm"
            onClick={() => onApplyNow(optimization)}
            disabled={isApplying || optimization.hasApplication}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {t('applying')}
              </>
            ) : optimization.hasApplication ? (
              <>{t('applied')}</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                {t('applyNow')}
              </>
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Export memoized component to prevent unnecessary re-renders (T046)
// Only re-renders when props actually change
export default memo(OptimizationRow);
