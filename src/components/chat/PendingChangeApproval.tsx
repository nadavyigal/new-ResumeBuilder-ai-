'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { ProposedChange } from '@/lib/agent/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocalization } from '@/hooks/useLocalization';

type AgentApplyResponse = {
  resume_json: OptimizedResume;
  preview_url: string | null;
  after_scores?: {
    ats?: {
      score: number;
      before: number | null;
      delta: number | null;
      missing_keywords?: string[];
      recommendations?: string[];
      languages?: Record<string, unknown>;
    };
  };
  history_entry_id?: string;
  language?: { lang: string; confidence?: number; rtl?: boolean; source?: string };
};

export interface PendingChangeApprovalProps {
  resumeJson: OptimizedResume;
  proposedChanges: ProposedChange[];
  jobText?: string | null;
  baselineAtsScore?: number | null;
  onApplySuccess?: (payload: AgentApplyResponse) => void;
  onDismiss?: () => void;
}

interface ChangeRowProps {
  change: ProposedChange;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  direction: 'ltr' | 'rtl';
}

function ChangeRow({ change, checked, onToggle, direction }: ChangeRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex items-start gap-3 p-4">
        <Checkbox
          id={`change-${change.id}`}
          checked={checked}
          onCheckedChange={(value) => onToggle(Boolean(value))}
          className="mt-1"
        />
        <div className="flex-1 min-w-0" dir={direction}>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
              {change.category.replace(/_/g, ' ')}
            </Badge>
            <Badge variant={change.confidence === 'high' ? 'default' : change.confidence === 'medium' ? 'secondary' : 'destructive'}>
              {change.confidence.charAt(0).toUpperCase() + change.confidence.slice(1)} confidence
            </Badge>
            {change.requires_human_review && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Needs review
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">{change.summary}</p>
          {(change.before || change.after) && (
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {change.before && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Before:</span>
                  <div className="mt-1 whitespace-pre-wrap break-words">{change.before}</div>
                </div>
              )}
              {change.after && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-300">After:</span>
                  <div className="mt-1 whitespace-pre-wrap break-words">{change.after}</div>
                </div>
              )}
            </div>
          )}
          {change.rationale && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500"
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {isExpanded ? 'Hide rationale' : 'View rationale'}
            </button>
          )}
          {isExpanded && change.rationale && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded p-3">
              {change.rationale}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PendingChangeApproval({
  resumeJson,
  proposedChanges,
  jobText,
  baselineAtsScore,
  onApplySuccess,
  onDismiss,
}: PendingChangeApprovalProps) {
  const { direction, setLanguage } = useLocalization();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(proposedChanges.map((change) => change.id)));
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const knownProposedIdsRef = useRef<Set<string>>(new Set(proposedChanges.map((change) => change.id)));

  useEffect(() => {
    const currentIds = new Set(proposedChanges.map((change) => change.id));
    const previousIds = knownProposedIdsRef.current;
    let hasMutation = false;

    setSelectedIds((previous) => {
      const next = new Set(previous);

      for (const id of currentIds) {
        if (!previousIds.has(id)) {
          next.add(id);
          hasMutation = true;
        }
      }

      for (const id of Array.from(next)) {
        if (!currentIds.has(id)) {
          next.delete(id);
          hasMutation = true;
        }
      }

      return hasMutation ? next : previous;
    });

    knownProposedIdsRef.current = currentIds;
  }, [proposedChanges]);

  const allSelected = useMemo(() => proposedChanges.every((change) => selectedIds.has(change.id)), [proposedChanges, selectedIds]);
  const selectedChanges = useMemo(() => proposedChanges.filter((change) => selectedIds.has(change.id)), [proposedChanges, selectedIds]);

  if (!proposedChanges.length) {
    return null;
  }

  const toggleChange = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(proposedChanges.map((change) => change.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleApply = async () => {
    if (!selectedChanges.length) {
      setError('Select at least one change to apply.');
      return;
    }

    setIsApplying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/agent/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_json: resumeJson,
          proposed_changes: selectedChanges,
          job_text: jobText ?? undefined,
          baseline_scores:
            typeof baselineAtsScore === 'number'
              ? {
                  ats: baselineAtsScore,
                }
              : undefined,
        }),
      });

      const data: AgentApplyResponse | { error?: string; message?: string } = await response.json().catch(() => ({} as any));

      if (!response.ok) {
        const message =
          (data as { error?: string; message?: string }).error ||
          (data as { error?: string; message?: string }).message ||
          'Failed to apply changes.';
        throw new Error(message);
      }

      if (data && 'language' in data && data.language) {
        setLanguage({
          lang: data.language.lang ?? 'en',
          confidence: data.language.confidence ?? 0,
          rtl: Boolean(data.language.rtl),
          source: data.language.source ?? 'heuristic',
        });
      }

      setSuccessMessage('Changes applied successfully!');
      onApplySuccess?.(data as AgentApplyResponse);
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : 'Failed to apply changes.';
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className="border-blue-200 dark:border-blue-900/50 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Sparkles className="w-5 h-5" />
          <CardTitle className="text-base">Proposed updates ready to apply</CardTitle>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Review AI-generated improvements before they are applied to your resume.
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Checkbox id="select-all-changes" checked={allSelected} onCheckedChange={(value) => toggleAll(Boolean(value))} />
          <label htmlFor="select-all-changes" className="cursor-pointer select-none">
            Select all ({selectedChanges.length}/{proposedChanges.length})
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            <XCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}
        <div className="space-y-3">
          {proposedChanges.map((change) => (
            <ChangeRow
              key={change.id}
              change={change}
              checked={selectedIds.has(change.id)}
              onToggle={(checked) => toggleChange(change.id, checked)}
              direction={direction}
            />
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            AI changes respect your resume language settings to keep tone and direction consistent.
          </div>
          <div className="flex items-center gap-2">
            {onDismiss && (
              <Button variant="outline" onClick={onDismiss} disabled={isApplying}>
                Dismiss
              </Button>
            )}
            <Button onClick={handleApply} disabled={isApplying} className="flex items-center gap-2">
              {isApplying && <Loader2 className="w-4 h-4 animate-spin" />}
              Apply selected
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
