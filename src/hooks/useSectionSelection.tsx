import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { RefineSelection, RefineField } from '@/types/refine';

interface SectionSelectionContextValue {
  selection: RefineSelection | null;
  setSelection: (sel: RefineSelection | null) => void;
  beginSelection: (sectionId: string, field: RefineField, text: string) => void;
  clearSelection: () => void;
}

const SectionSelectionContext = createContext<SectionSelectionContextValue | undefined>(undefined);

export function SectionSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<RefineSelection | null>(null);

  const beginSelection = useCallback((sectionId: string, field: RefineField, text: string) => {
    setSelection({ sectionId, field, text });
  }, []);

  const clearSelection = useCallback(() => setSelection(null), []);

  const value = useMemo(
    () => ({ selection, setSelection, beginSelection, clearSelection }),
    [selection, beginSelection, clearSelection]
  );

  return (
    <SectionSelectionContext.Provider value={value}>{children}</SectionSelectionContext.Provider>
  );
}

export function useSectionSelection() {
  const ctx = useContext(SectionSelectionContext);
  if (!ctx) throw new Error('useSectionSelection must be used within SectionSelectionProvider');
  return ctx;
}






