"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeDiff } from "@/components/chat/ChangeDiff";
import type { ReviewChangeGroup } from "@/types/optimization-review";
import { CheckCircle, ChevronDown, ChevronUp, X } from "@/lib/icons";

interface ReviewChangeCardProps {
  group: ReviewChangeGroup;
  selected: boolean;
  onToggle: (groupId: string) => void;
  labels: {
    included: string;
    skipped: string;
    skip: string;
    include: string;
    hideDiff: string;
    viewDiff: string;
    before: string;
    after: string;
    emptyExcerpt: string;
  };
}

export function ReviewChangeCard({
  group,
  selected,
  onToggle,
  labels,
}: ReviewChangeCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={`border transition-colors ${
        selected
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selected ? "default" : "outline"}>
                {selected ? labels.included : labels.skipped}
              </Badge>
              {group.reason_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="bg-white/70 text-slate-600">
                  {tag}
                </Badge>
              ))}
            </div>
            <CardTitle className="text-lg text-slate-950">{group.title}</CardTitle>
            <p className="text-sm text-slate-600">{group.summary}</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={selected ? "outline" : "default"}
              onClick={() => onToggle(group.id)}
            >
              {selected ? (
                <>
                  <X className="mr-1.5 h-4 w-4" />
                  {labels.skip}
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  {labels.include}
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? (
                <>
                  {labels.hideDiff}
                  <ChevronUp className="ml-1.5 h-4 w-4" />
                </>
              ) : (
                <>
                  {labels.viewDiff}
                  <ChevronDown className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {labels.before}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {group.before_excerpt || labels.emptyExcerpt}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              {labels.after}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {group.after_excerpt || labels.emptyExcerpt}
            </p>
          </div>
        </div>

        {expanded && (
          <ChangeDiff
            original={group.before_excerpt || " "}
            modified={group.after_excerpt || " "}
            splitView={false}
            showLineNumbers={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
