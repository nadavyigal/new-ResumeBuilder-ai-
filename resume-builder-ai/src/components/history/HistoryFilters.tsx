'use client';

import { useState } from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import type {
  HistoryFiltersProps,
  DateRangePreset,
  ScoreFilterPreset,
} from '@/types/history';
import {
  getDateRangeFromPreset,
  detectDateRangePreset,
  detectScorePreset,
  countActiveFilters,
} from '@/lib/history-utils';

/**
 * HistoryFilters Component
 * Feature: 005-history-view-previous (User Story 3 - T022)
 *
 * Provides filtering controls for optimization history:
 * - Date range picker (Last 7/30/90 days, Custom)
 * - ATS score filter dropdown
 * - Clear Filters button
 */
export default function HistoryFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  activeFilterCount,
}: HistoryFiltersProps) {
  // Local state for date range picker
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: filters.dateRange?.from,
    to: filters.dateRange?.to,
  });

  // Detect current presets
  const currentDatePreset = detectDateRangePreset(filters.dateRange);
  const currentScorePreset = detectScorePreset(filters.minScore);

  /**
   * Handle date range preset selection
   */
  const handleDatePresetChange = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      // Open calendar for custom range
      setDateRangeOpen(true);
      return;
    }

    const range = getDateRangeFromPreset(preset);
    if (range) {
      onFiltersChange({
        ...filters,
        dateRange: range,
      });
    }
  };

  /**
   * Handle custom date range selection
   */
  const handleCustomDateSelect = (range: { from: Date | undefined; to: Date | undefined }) => {
    setCustomDateRange(range);

    // Only update filters when both dates are selected
    if (range.from && range.to) {
      onFiltersChange({
        ...filters,
        dateRange: {
          from: range.from,
          to: range.to,
        },
      });
      setDateRangeOpen(false);
    }
  };

  /**
   * Handle score filter preset selection
   */
  const handleScorePresetChange = (preset: ScoreFilterPreset) => {
    const minScore = preset === 'all' ? null : parseInt(preset.replace('-plus', ''));

    onFiltersChange({
      ...filters,
      minScore,
    });
  };

  /**
   * Clear date range filter
   */
  const handleClearDateRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFiltersChange({
      ...filters,
      dateRange: null,
    });
    setCustomDateRange({ from: undefined, to: undefined });
  };

  /**
   * Format date range for display
   */
  const formatDateRangeLabel = (): string => {
    if (!filters.dateRange) {
      return 'All time';
    }

    if (currentDatePreset !== 'custom') {
      const presetLabels: Record<DateRangePreset, string> = {
        'last-7-days': 'Last 7 days',
        'last-30-days': 'Last 30 days',
        'last-90-days': 'Last 90 days',
        'custom': 'Custom',
      };
      return presetLabels[currentDatePreset];
    }

    const from = filters.dateRange.from.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const to = filters.dateRange.to.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${from} - ${to}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Filter icon with active count badge */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filters:</span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </div>

      {/* Date Range Filter */}
      <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={filters.dateRange ? 'default' : 'outline'}
            size="sm"
            className="h-9 gap-2"
          >
            <Calendar className="h-4 w-4" />
            <span>{formatDateRangeLabel()}</span>
            {filters.dateRange && (
              <X
                className="h-3 w-3 ml-1"
                onClick={handleClearDateRange}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col space-y-2 p-3">
            {/* Preset options */}
            <div className="space-y-1">
              <Button
                variant={currentDatePreset === 'last-7-days' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDatePresetChange('last-7-days')}
              >
                Last 7 days
              </Button>
              <Button
                variant={currentDatePreset === 'last-30-days' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDatePresetChange('last-30-days')}
              >
                Last 30 days
              </Button>
              <Button
                variant={currentDatePreset === 'last-90-days' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => handleDatePresetChange('last-90-days')}
              >
                Last 90 days
              </Button>
            </div>

            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground mb-2">Custom range:</p>
              <CalendarComponent
                mode="range"
                selected={{
                  from: customDateRange.from,
                  to: customDateRange.to,
                }}
                onSelect={(range) =>
                  handleCustomDateSelect({
                    from: range?.from,
                    to: range?.to,
                  })
                }
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* ATS Score Filter */}
      <Select
        value={currentScorePreset}
        onValueChange={(value) => handleScorePresetChange(value as ScoreFilterPreset)}
      >
        <SelectTrigger
          className={`h-9 w-[140px] ${filters.minScore !== null ? 'border-primary' : ''}`}
        >
          <SelectValue placeholder="Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All scores</SelectItem>
          <SelectItem value="90-plus">90% and above</SelectItem>
          <SelectItem value="80-plus">80% and above</SelectItem>
          <SelectItem value="70-plus">70% and above</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters Button */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-9 gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
