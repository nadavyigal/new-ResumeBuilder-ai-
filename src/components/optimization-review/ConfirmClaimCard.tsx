"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ReviewChangeGroup } from "@/types/optimization-review";
import { CheckCircle, X } from "@/lib/icons";

interface ConfirmClaimCardProps {
  group: ReviewChangeGroup;
  confirmed: boolean;
  /** False when the section change this edits is not included, so there is nothing to add it to. */
  available: boolean;
  onToggle: (groupId: string) => void;
  labels: {
    badge: string;
    question: string;
    now: string;
    nowEmpty: string;
    withLine: string;
    gain: (points: number) => string;
    add: string;
    remove: string;
    needsSection: string;
  };
}

/**
 * "Add only if true": a job-post phrase the optimizer wrote and the guard held
 * back. Never pre-selected. Confirming puts the line back and its points with it.
 */
export function ConfirmClaimCard({ group, confirmed, available, onToggle, labels }: ConfirmClaimCardProps) {
  const claim = group.confirm;
  if (!claim) return null;
  const active = confirmed && available;

  return (
    <Card className={`border transition-colors ${active ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              {labels.badge}
            </Badge>
            {typeof claim.estimated_gain === "number" && claim.estimated_gain > 0 && (
              <Badge variant="secondary">{labels.gain(claim.estimated_gain)}</Badge>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant={active ? "outline" : "default"}
            disabled={!available}
            onClick={() => onToggle(group.id)}
          >
            {active ? (
              <>
                <X className="mr-1.5 h-4 w-4" />
                {labels.remove}
              </>
            ) : (
              <>
                <CheckCircle className="mr-1.5 h-4 w-4" />
                {labels.add}
              </>
            )}
          </Button>
        </div>

        <p className="text-sm font-medium text-slate-800">{labels.question}</p>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{labels.now}</div>
            <p dir="auto" className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {claim.kept || labels.nowEmpty}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">{labels.withLine}</div>
            <p dir="auto" className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {claim.proposed}
            </p>
          </div>
        </div>

        {!available && <p className="text-xs text-muted-foreground">{labels.needsSection}</p>}
      </CardContent>
    </Card>
  );
}
