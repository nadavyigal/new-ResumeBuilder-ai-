"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompactATSScoreCard } from "@/components/ats/CompactATSScoreCard";
import { ReadinessOverview } from "@/components/optimization/ReadinessOverview";
import { ReviewChangeCard } from "@/components/optimization-review/ReviewChangeCard";
import { DesignRenderer } from "@/components/design/DesignRenderer";
import { buildResumeFromApprovedGroups } from "@/lib/optimization-review";
import type { OptimizationReviewRun, ReviewChangeGroup } from "@/types/optimization-review";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/lib/constants";
import { stashAtsBootstrap } from "@/lib/ats/resolve-display-scores";

type ReviewPayload = {
  review: OptimizationReviewRun;
  resume: {
    filename: string | null;
    raw_text: string | null;
  } | null;
  jobDescription: {
    title: string | null;
    company: string | null;
    source_url: string | null;
    raw_text: string | null;
    clean_text: string | null;
  } | null;
};

export default function OptimizationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("dashboard.optimization.review");
  const commonT = useTranslations("dashboard.optimization");
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/v1/optimization-reviews/${params.id}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || t("errors.load"));
        }

        setPayload(data as ReviewPayload);
        const groupIds = ((data as ReviewPayload).review.grouped_changes_json || []).map((group) => group.id);
        setSelectedIds(new Set(groupIds));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t("errors.load"));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.id, t]);

  const selectedGroups = useMemo<ReviewChangeGroup[]>(() => {
    if (!payload) return [];
    return payload.review.grouped_changes_json.filter((group) => selectedIds.has(group.id));
  }, [payload, selectedIds]);

  const previewResume = useMemo(() => {
    if (!payload) return null;
    return buildResumeFromApprovedGroups(payload.review.original_resume_json, selectedGroups, {
      keyImprovements: selectedGroups.map((group) => group.title),
      matchScore: payload.review.ats_preview_json?.after ?? 0,
    });
  }, [payload, selectedGroups]);

  const highlights = useMemo(() => {
    if (selectedGroups.length > 0) {
      return selectedGroups.map((group) => group.summary);
    }
    return [t("hero.emptySelection")];
  }, [selectedGroups, t]);

  const stats = useMemo(() => {
    const delta = payload?.review.ats_preview_json?.delta;
    const after = payload?.review.ats_preview_json?.after;
    return [
      {
        label: t("hero.stats.selected"),
        value: String(selectedGroups.length),
      },
      {
        label: t("hero.stats.projectedScore"),
        value: after !== null && after !== undefined ? `${Math.round(after)}%` : "--",
      },
      {
        label: t("hero.stats.projectedGain"),
        value: delta !== null && delta !== undefined ? `${delta > 0 ? "+" : ""}${Math.round(delta)}` : "--",
      },
    ];
  }, [payload, selectedGroups.length, t]);

  const toggleGroup = (groupId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!payload) return;
    setSelectedIds(new Set(payload.review.grouped_changes_json.map((group) => group.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const applySelection = async () => {
    if (!payload || selectedGroups.length === 0) return;

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/v1/optimization-reviews/${payload.review.id}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approvedGroupIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("errors.apply"));
      }

      if (data.optimizationId && data.atsImpact) {
        stashAtsBootstrap(String(data.optimizationId), {
          ats_score_original: data.atsImpact.before ?? null,
          ats_score_optimized: data.atsImpact.after ?? null,
        });
      }

      router.push(`${ROUTES.optimizations}/${data.optimizationId}`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : t("errors.apply"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/40 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {t("loading")}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-muted/40 p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{t("errors.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{error || t("errors.load")}</p>
              <div className="flex gap-2">
                <Button onClick={() => window.location.reload()}>{commonT("error.reload")}</Button>
                <Button variant="outline" asChild>
                  <Link href={ROUTES.upload}>{commonT("error.backToDashboard")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-4 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={ROUTES.upload} className="text-sm text-muted-foreground hover:text-foreground">
              {t("back")}
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {t("subtitle", {
                title: payload.jobDescription?.title || t("fallbackTitle"),
                company: payload.jobDescription?.company || t("fallbackCompany"),
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={clearSelection} disabled={selectedGroups.length === 0}>
              {t("actions.clear")}
            </Button>
            <Button variant="outline" onClick={selectAll}>
              {t("actions.selectAll")}
            </Button>
            <Button onClick={applySelection} disabled={selectedGroups.length === 0 || submitting}>
              {submitting ? t("actions.applying") : t("actions.apply")}
            </Button>
          </div>
        </div>

        <ReadinessOverview
          eyebrow={t("hero.eyebrow")}
          structureBadge={t("hero.structureBadge")}
          title={t("hero.title")}
          subtitle={t("hero.subtitle", {
            title: payload.jobDescription?.title || t("fallbackTitle"),
          })}
          highlights={highlights}
          stats={stats}
        />

        {payload.review.ats_preview_json && (
          <div className="space-y-2">
            <CompactATSScoreCard
              atsScoreOriginal={payload.review.ats_preview_json.before || 0}
              atsScoreOptimized={payload.review.ats_preview_json.after || 0}
            />
            <p className="text-xs text-muted-foreground">
              {t("atsNote")}
              {payload.review.ats_preview_json.confidence_note
                ? ` ${payload.review.ats_preview_json.confidence_note}`
                : ""}
            </p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t("changes.title", { count: payload.review.grouped_changes_json.length })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {payload.review.grouped_changes_json.map((group) => (
                  <ReviewChangeCard
                    key={group.id}
                    group={group}
                    selected={selectedIds.has(group.id)}
                    onToggle={toggleGroup}
                    labels={{
                      included: t("changes.card.included"),
                      skipped: t("changes.card.skipped"),
                      skip: t("changes.card.skip"),
                      include: t("changes.card.include"),
                      hideDiff: t("changes.card.hideDiff"),
                      viewDiff: t("changes.card.viewDiff"),
                      before: t("changes.card.before"),
                      after: t("changes.card.after"),
                      emptyExcerpt: t("changes.card.emptyExcerpt"),
                    }}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t("preview.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {selectedGroups.length > 0
                    ? t("preview.selected", { count: selectedGroups.length })
                    : t("preview.empty")}
                </p>
                {previewResume && (
                  <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white p-2">
                    <DesignRenderer resumeData={previewResume} refreshKey={selectedGroups.length} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
