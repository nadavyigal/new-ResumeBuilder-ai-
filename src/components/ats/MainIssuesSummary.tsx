'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Target, TrendingUp, Sparkles, ShieldCheck, AlertTriangle, Copy, Check } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type IssueItem = {
  text: string;
  category?: string;
  estimated_gain?: number;
};

type MainIssueKey = 'keywords' | 'metrics' | 'content' | 'structure' | 'formatting';

type MainIssuesBaseKey = 'landing.score.mainIssues' | 'dashboard.chat.suggestionsBanner.mainIssues';

interface MainIssuesSummaryProps {
  items: IssueItem[];
  baseKey: MainIssuesBaseKey;
  className?: string;
  variant?: 'default' | 'compact';
  onContinue?: () => void;
}

const DEFAULT_MAIN_ISSUES: MainIssueKey[] = ['keywords', 'metrics', 'content'];

const CATEGORY_ICON: Record<MainIssueKey, React.ComponentType<{ className?: string }>> = {
  keywords: Target,
  metrics: TrendingUp,
  content: Sparkles,
  structure: ShieldCheck,
  formatting: AlertTriangle,
};

function normalizeCategory(category?: string): MainIssueKey | null {
  if (!category) return null;
  const normalized = category.trim().toLowerCase();
  if (normalized === 'keyword' || normalized === 'keywords') return 'keywords';
  if (normalized === 'metric' || normalized === 'metrics') return 'metrics';
  if (normalized === 'content' || normalized === 'relevance') return 'content';
  if (normalized === 'structure' || normalized === 'sections') return 'structure';
  if (normalized === 'formatting' || normalized === 'format') return 'formatting';
  return null;
}

function getUniqueCategories(items: IssueItem[]): MainIssueKey[] {
  const ordered: MainIssueKey[] = [];
  for (const item of items) {
    const key = normalizeCategory(item.category);
    if (key && !ordered.includes(key)) {
      ordered.push(key);
    }
  }
  for (const fallback of DEFAULT_MAIN_ISSUES) {
    if (!ordered.includes(fallback)) {
      ordered.push(fallback);
    }
  }
  return ordered.slice(0, 3);
}

function extractQuotedTerm(text: string): string | null {
  const singleQuoted = text.match(/'([^']+)'/);
  if (singleQuoted?.[1]) return singleQuoted[1];
  const doubleQuoted = text.match(/"([^"]+)"/);
  if (doubleQuoted?.[1]) return doubleQuoted[1];
  return null;
}

function extractCategoryTerm(items: IssueItem[], category: MainIssueKey): string | null {
  for (const item of items) {
    if (normalizeCategory(item.category) !== category) continue;
    const term = extractQuotedTerm(item.text);
    if (term) return term;
  }
  return null;
}

function sumEstimatedGain(items: IssueItem[], category: MainIssueKey): number | null {
  const total = items
    .filter((item) => normalizeCategory(item.category) === category)
    .reduce((sum, item) => sum + (typeof item.estimated_gain === 'number' ? item.estimated_gain : 0), 0);
  return total > 0 ? total : null;
}

export function MainIssuesSummary({
  items,
  baseKey,
  className,
  variant = 'default',
  onContinue,
}: MainIssuesSummaryProps) {
  const t = useTranslations(baseKey);
  const [copiedKey, setCopiedKey] = useState<MainIssueKey | null>(null);

  const categories = useMemo(() => getUniqueCategories(items), [items]);

  const handleCopy = async (category: MainIssueKey, exampleText: string) => {
    try {
      await navigator.clipboard.writeText(exampleText);
      setCopiedKey(category);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch (error) {
      console.error('Failed to copy main issue example:', error);
    }
  };

  return (
    <div className={cn('space-y-4', className)} data-testid="main-issues-summary">
      <div className="space-y-1">
        <h3 className={variant === 'compact' ? 'text-base font-semibold' : 'text-lg font-semibold'}>
          {t('title')}
        </h3>
        <p className={variant === 'compact' ? 'text-xs text-foreground/70' : 'text-sm text-foreground/70'}>
          {t('subtitle')}
        </p>
      </div>

      <div className={variant === 'compact' ? 'grid gap-2' : 'grid gap-3 md:grid-cols-3'}>
        {categories.map((category, index) => {
          const Icon = CATEGORY_ICON[category];
          const estimatedGain = sumEstimatedGain(items, category);
          const exampleTerm =
            extractCategoryTerm(items, category) ||
            t(`categories.${category}.fallbackTerm`);

          const example1 = t(`categories.${category}.examples.example1`, {
            term: exampleTerm,
          });
          const example2 = t(`categories.${category}.examples.example2`, {
            term: exampleTerm,
          });

          const exampleText = variant === 'compact' ? example1 : `${example1}\n${example2}`;
          const isCopied = copiedKey === category;

          return (
            <Card key={category} className="border-border/70">
              <CardContent className={variant === 'compact' ? 'p-3 space-y-2' : 'p-4 space-y-3'}>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-mobile-cta/10 text-mobile-cta flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[11px] font-semibold">
                    {t('issueBadge', { index: index + 1 })}
                  </Badge>
                  {estimatedGain && (
                    <Badge variant="secondary" className="ml-auto text-[11px]">
                      {t('pointsBadge', { points: estimatedGain })}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <p className={variant === 'compact' ? 'text-sm font-semibold' : 'text-base font-semibold'}>
                    {t(`categories.${category}.title`)}
                  </p>
                  <p className="text-xs text-foreground/70">{t(`categories.${category}.description`)}</p>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
                  <div className="text-[11px] font-semibold text-foreground/80 mb-1">{t('whyLabel')}</div>
                  <p className="text-xs text-foreground/80">{t(`categories.${category}.why`)}</p>
                </div>

                <div className="rounded-lg border border-border/60 bg-background p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-foreground/80">{t('exampleLabel')}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => handleCopy(category, exampleText)}
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3 w-3 text-green-600 mr-1" />
                          <span className="text-green-600">{t('copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          {t('copy')}
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="text-xs text-foreground/90 whitespace-pre-line">
                    {exampleText}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-xl border border-mobile-cta/30 bg-mobile-cta/5 p-3 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{t('continueTitle')}</p>
        <p className="text-xs text-foreground/80">{t('continueDescription')}</p>
        {onContinue && (
          <Button size="sm" className="mt-1" onClick={onContinue}>
            {t('continueCta')}
          </Button>
        )}
      </div>
    </div>
  );
}

