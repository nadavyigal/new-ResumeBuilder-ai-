'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X } from '@/lib/icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { HistorySearchProps } from '@/types/history';

/**
 * HistorySearch Component
 * Feature: 005-history-view-previous (User Story 3 - T021)
 *
 * Search input for filtering optimizations by job title or company name.
 * Includes debouncing to avoid excessive API calls.
 */
export default function HistorySearch({
  value,
  onChange,
  onClear,
  placeholder = 'Search by job title or company...',
}: HistorySearchProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Debounced onChange handler - delays API call by 300ms
   * Fixed: Now properly maintains timeout reference and clears previous timeouts
   */
  const debouncedOnChange = useCallback(
    (searchValue: string) => {
      // Clear previous timeout to prevent multiple API calls
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        onChange(searchValue);
      }, 300);
    },
    [onChange]
  );

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle input change - updates local state immediately,
   * triggers debounced onChange after 300ms
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  /**
   * Handle clear button click - resets search immediately
   */
  const handleClear = () => {
    setLocalValue('');
    onChange('');
    onClear();
  };

  /**
   * Sync local value with prop value (when parent state changes externally)
   */
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="relative w-full max-w-md">
      {/* Search icon */}
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      {/* Search input */}
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleInputChange}
        className="pl-10 pr-10"
        aria-label="Search optimizations"
      />

      {/* Clear button - only show when input has value */}
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
