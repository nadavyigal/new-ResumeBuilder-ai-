import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslations } from 'next-intl';

/**
 * HistoryTableSkeleton Component
 * Feature: 005-history-view-previous (User Story 1)
 *
 * Loading skeleton for the history table.
 * Displays a shimmer effect for 5 placeholder rows while data is being fetched.
 */
export default function HistoryTableSkeleton() {
  const t = useTranslations('dashboard.history.table');

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">{t('dateCreated')}</TableHead>
            <TableHead>{t('jobTitle')}</TableHead>
            <TableHead>{t('company')}</TableHead>
            <TableHead className="w-[120px]">{t('atsMatch')}</TableHead>
            <TableHead className="w-[120px]">{t('status')}</TableHead>
            <TableHead className="text-end w-[200px]">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              {/* Date skeleton */}
              <TableCell>
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </TableCell>

              {/* Job Title skeleton */}
              <TableCell>
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              </TableCell>

              {/* Company skeleton */}
              <TableCell>
                <div className="h-4 w-36 bg-muted animate-pulse rounded" />
              </TableCell>

              {/* Match Score skeleton */}
              <TableCell>
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              </TableCell>

              {/* Status skeleton */}
              <TableCell>
                <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
              </TableCell>

              {/* Actions skeleton */}
              <TableCell className="text-end">
                <div className="flex justify-end gap-2">
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-28 bg-muted animate-pulse rounded" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
