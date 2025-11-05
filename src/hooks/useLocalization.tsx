'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { LanguageDetection } from '@/lib/agent/types';

interface LocalizationContextValue {
  language: LanguageDetection;
  direction: 'ltr' | 'rtl';
  setLanguage: (language: LanguageDetection) => void;
  updateLanguage: (language?: Partial<LanguageDetection> | null) => void;
}

const DEFAULT_LANGUAGE: LanguageDetection = {
  lang: 'en',
  confidence: 0,
  rtl: false,
  source: 'heuristic',
};

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

export interface LocalizationProviderProps extends PropsWithChildren {
  initialLanguage?: LanguageDetection | null;
}

export function LocalizationProvider({ initialLanguage, children }: LocalizationProviderProps) {
  const [language, setLanguageState] = useState<LanguageDetection>(initialLanguage ?? DEFAULT_LANGUAGE);

  const setLanguage = useCallback((next: LanguageDetection) => {
    setLanguageState((prev) => {
      if (!next) return prev;
      return {
        lang: next.lang ?? prev.lang ?? DEFAULT_LANGUAGE.lang,
        confidence: typeof next.confidence === 'number' ? next.confidence : prev.confidence ?? DEFAULT_LANGUAGE.confidence,
        rtl: typeof next.rtl === 'boolean' ? next.rtl : prev.rtl ?? DEFAULT_LANGUAGE.rtl,
        source: next.source ?? prev.source ?? DEFAULT_LANGUAGE.source,
      };
    });
  }, []);

  const updateLanguage = useCallback((next?: Partial<LanguageDetection> | null) => {
    if (!next) return;
    setLanguageState((prev) => ({
      lang: next.lang ?? prev.lang ?? DEFAULT_LANGUAGE.lang,
      confidence: typeof next.confidence === 'number' ? next.confidence : prev.confidence ?? DEFAULT_LANGUAGE.confidence,
      rtl: typeof next.rtl === 'boolean' ? next.rtl : prev.rtl ?? DEFAULT_LANGUAGE.rtl,
      source: next.source ?? prev.source ?? DEFAULT_LANGUAGE.source,
    }));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      document.documentElement.setAttribute('lang', language.lang ?? DEFAULT_LANGUAGE.lang);
      document.documentElement.setAttribute('dir', language.rtl ? 'rtl' : 'ltr');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[LocalizationProvider] Failed to apply language attributes', error);
      }
    }
  }, [language.lang, language.rtl]);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      language,
      direction: language.rtl ? 'rtl' : 'ltr',
      setLanguage,
      updateLanguage,
    }),
    [language, setLanguage, updateLanguage]
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization(): LocalizationContextValue {
  const ctx = useContext(LocalizationContext);
  if (!ctx) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return ctx;
}
