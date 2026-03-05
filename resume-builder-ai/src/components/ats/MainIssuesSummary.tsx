'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Target, TrendingUp, Sparkles, ShieldCheck, AlertTriangle, Copy, Check } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SuggestionAction } from '@/lib/ats/types';

type IssueItem = {
  text: string;
  category?: string;
  estimated_gain?: number;
  action?: SuggestionAction;
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

const GENERIC_TERM_PATTERNS: RegExp[] = [
  /^job title\b/i,
  /^company\b/i,
  /^nominal about\b/i,
  /^about\b/i,
  /^role\b/i,
  /^position\b/i,
  /^title\b/i,
  /^responsibilities\b/i,
  /^requirements\b/i,
  /^summary\b/i,
  /^skills?\b/i,
  /^experience\b/i,
];

const DEDUPE_MAX = 5;

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

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

function sanitizeExampleTerm(term?: string | null): string | null {
  if (!term) return null;
  const cleaned = term.trim();
  if (cleaned.length < 3) return null;
  if (GENERIC_TERM_PATTERNS.some((pattern) => pattern.test(cleaned))) return null;
  return cleaned;
}

type RoleContext = {
  title?: string;
  keywords: string[];
  niceToHave: string[];
  phrases: string[];
};

function collectRoleContext(items: IssueItem[]): RoleContext {
  const keywords: string[] = [];
  const niceToHave: string[] = [];
  const phrases: string[] = [];
  let title: string | undefined;

  for (const item of items) {
    const action = item.action;
    if (action?.type === 'align_title') {
      title = title || action.params.targetTitle;
    }
    if (action?.type === 'add_keyword') {
      const next = (action.params.keywords || []).map(String);
      if (action.params.source === 'nice_to_have') {
        niceToHave.push(...next);
      } else {
        keywords.push(...next);
      }
    }
    if (action?.type === 'add_phrase') {
      const next = (action.params.phrases || []).map(String);
      phrases.push(...next);
    }

    const quoted = sanitizeExampleTerm(extractQuotedTerm(item.text));
    if (quoted && !title && item.category === 'content') {
      title = quoted;
    }
  }

  const cleanedKeywords = dedupePreserveOrder(
    keywords.map((keyword) => sanitizeExampleTerm(keyword)).filter(Boolean) as string[]
  ).slice(0, DEDUPE_MAX);

  const cleanedNice = dedupePreserveOrder(
    niceToHave.map((keyword) => sanitizeExampleTerm(keyword)).filter(Boolean) as string[]
  ).slice(0, DEDUPE_MAX);

  const cleanedPhrases = dedupePreserveOrder(
    phrases.map((phrase) => sanitizeExampleTerm(phrase)).filter(Boolean) as string[]
  ).slice(0, DEDUPE_MAX);

  return {
    title: sanitizeExampleTerm(title) || undefined,
    keywords: cleanedKeywords,
    niceToHave: cleanedNice,
    phrases: cleanedPhrases,
  };
}

function joinList(items: string[], max = 4): string {
  return items.slice(0, max).join(', ');
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
  const locale = useLocale();
  const [copiedKey, setCopiedKey] = useState<MainIssueKey | null>(null);

  const categories = useMemo(() => getUniqueCategories(items), [items]);
  const roleContext = useMemo(() => collectRoleContext(items), [items]);

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
            sanitizeExampleTerm(extractCategoryTerm(items, category)) ||
            t(`categories.${category}.fallbackTerm`);

          const fallbackSkill2 = locale === 'he' ? '[מיומנות 2]' : '[Skill 2]';
          const fallbackSkill3 = locale === 'he' ? '[מיומנות 3]' : '[Skill 3]';
          const fallbackTool = locale === 'he' ? '[כלי]' : '[Tool]';
          const fallbackMethod = locale === 'he' ? '[שיטה]' : '[Method]';
          const fallbackNiceList = locale === 'he'
            ? '[מיומנות], [כלי], [שיטה]'
            : '[Skill], [Tool], [Method]';
          const fallbackAction = locale === 'he' ? '[פעולה]' : '[action]';
          const fallbackInitiative = locale === 'he' ? '[יוזמה]' : '[initiative]';
          const fallbackScope = locale === 'he' ? '[צוות/אזור]' : '[team/region]';
          const fallbackResult = locale === 'he' ? '[תוצאה]' : '[result]';

          const keywordSource = roleContext.keywords.length ? roleContext.keywords : roleContext.phrases;

          const keywordList = keywordSource.length
            ? joinList(keywordSource)
            : joinList([exampleTerm, fallbackSkill2, fallbackTool, fallbackMethod]);

          const niceList = roleContext.niceToHave.length
            ? joinList(roleContext.niceToHave)
            : fallbackNiceList;

          const skill1 = keywordSource[0] || exampleTerm;
          const skill2 = keywordSource[1] || fallbackSkill2;
          const skill3 = keywordSource[2] || fallbackSkill3;
          const title = roleContext.title || exampleTerm;
          const metric = keywordSource[0] || exampleTerm;

          const example1 = t(`categories.${category}.examples.example1`, {
            term: exampleTerm,
            skillsList: keywordList,
            niceList,
            title,
            skill1,
            skill2,
            skill3,
            metric,
            action: fallbackAction,
            initiative: fallbackInitiative,
            scope: fallbackScope,
            result: fallbackResult,
          });
          const example2 = t(`categories.${category}.examples.example2`, {
            term: exampleTerm,
            skillsList: keywordList,
            niceList,
            title,
            skill1,
            skill2,
            skill3,
            metric,
            action: fallbackAction,
            initiative: fallbackInitiative,
            scope: fallbackScope,
            result: fallbackResult,
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

      {onContinue && (
        <div className="rounded-xl border border-mobile-cta/30 bg-mobile-cta/5 p-3 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{t('continueTitle')}</p>
          <p className="text-xs text-foreground/80">{t('continueDescription')}</p>
          <Button size="sm" className="mt-1" onClick={onContinue}>
            {t('continueCta')}
          </Button>
        </div>
      )}
    </div>
  );
}
