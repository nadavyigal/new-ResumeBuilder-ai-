"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompactATSScoreCard } from "@/components/ats/CompactATSScoreCard";
import { ReadinessOverview } from "@/components/optimization/ReadinessOverview";
import { ReviewChangeCard } from "@/components/optimization-review/ReviewChangeCard";
import { ConfirmClaimCard } from "@/components/optimization-review/ConfirmClaimCard";
import { DesignRenderer } from "@/components/design/DesignRenderer";
import { buildResumeFromApprovedGroups } from "@/lib/optimization-review";
import type { OptimizationReviewRun, ReviewChangeGroup } from "@/types/optimization-review";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/lib/constants";
import { stashAtsBootstrap } from "@/lib/ats/resolve-display-scores";
import { SectionSelectionProvider } from "@/hooks/useSectionSelection";

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
        // "Add only if true" items start unselected: only the user can confirm them.
        const groupIds = ((data as ReviewPayload).review.grouped_changes_json || [])
          .filter((group) => !group.confirm)
          .map((group) => group.id);
        setSelectedIds(new Set(groupIds));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t("errors.load"));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.id, t]);

  const sectionGroups = useMemo<ReviewChangeGroup[]>(
    () => (payload?.review.grouped_changes_json ?? []).filter((group) => !group.confirm),
    [payload]
  );
  const confirmGroups = useMemo<ReviewChangeGroup[]>(
    () => (payload?.review.grouped_changes_json ?? []).filter((group) => group.confirm),
    [payload]
  );

  // A confirmation edits its section's new text, so it counts only while that
  // section's change is included (or when there is no section change at all).
  const isConfirmAvailable = (group: ReviewChangeGroup) =>
    Boolean(group.confirm?.standalone || (group.confirm && selectedIds.has(group.confirm.requires)));

  const selectedGroups = useMemo<ReviewChangeGroup[]>(() => {
    if (!payload) return [];
    return payload.review.grouped_changes_json.filter((group) => selectedIds.has(group.id));
  }, [payload, selectedIds]);

  const selectedSectionCount = selectedGroups.filter((group) => !group.confirm).length;

  // What confirmed items add back, measured per item when the review was created.
  const confirmedGain = useMemo(
    () =>
      confirmGroups
        .filter((group) => selectedIds.has(group.id) && isConfirmAvailable(group))
        .reduce((sum, group) => sum + (group.confirm?.estimated_gain ?? 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmGroups, selectedIds]
  );
  const projectedAfter =
    typeof payload?.review.ats_preview_json?.after === "number"
      ? payload.review.ats_preview_json.after + confirmedGain
      : null;
  const projectedDelta =
    typeof payload?.review.ats_preview_json?.delta === "number"
      ? payload.review.ats_preview_json.delta + confirmedGain
      : null;

  const previewResume = useMemo(() => {
    if (!payload) return null;
    return buildResumeFromApprovedGroups(payload.review.original_resume_json, selectedGroups, {
      keyImprovements: selectedGroups.filter((group) => !group.confirm).map((group) => group.title),
      matchScore: projectedAfter ?? 0,
    });
  }, [payload, selectedGroups, projectedAfter]);

  const highlights = useMemo(() => {
    if (selectedSectionCount > 0) {
      return selectedGroups.filter((group) => !group.confirm).map((group) => group.summary);
    }
    return [t("hero.emptySelection")];
  }, [selectedGroups, selectedSectionCount, t]);

  const stats = useMemo(() => {
    const delta = projectedDelta;
    const after = projectedAfter;
    return [
      {
        label: t("hero.stats.selected"),
        value: String(selectedSectionCount),
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
  }, [projectedAfter, projectedDelta, selectedSectionCount, t]);

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

  // Never confirms a claim on the user's behalf: confirmed items stay as they are.
  const selectAll = () => {
    if (!payload) return;
    setSelectedIds((current) => {
      const next = new Set(sectionGroups.map((group) => group.id));
      confirmGroups.forEach((group) => {
        if (current.has(group.id)) next.add(group.id);
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const applySelection = async () => {
    if (!payload || selectedSectionCount === 0) return;

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
    <SectionSelectionProvider>
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
            <Button variant="outline" onClick={clearSelection} disabled={selectedSectionCount === 0}>
              {t("actions.clear")}
            </Button>
            <Button variant="outline" onClick={selectAll}>
              {t("actions.selectAll")}
            </Button>
            <Button onClick={applySelection} disabled={selectedSectionCount === 0 || submitting}>
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
              atsScoreOriginal={payload.review.ats_preview_json.before ?? 0}
              atsScoreOptimized={projectedAfter ?? 0}
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
                <CardTitle>{t("changes.title", { count: sectionGroups.length })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sectionGroups.map((group) => (
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

            {confirmGroups.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>{t("changes.confirm.badge")}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t("changes.confirm.intro")}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {confirmGroups.map((group) => (
                    <ConfirmClaimCard
                      key={group.id}
                      group={group}
                      confirmed={selectedIds.has(group.id)}
                      available={isConfirmAvailable(group)}
                      onToggle={toggleGroup}
                      labels={{
                        badge: t("changes.confirm.badge"),
                        question: t("changes.confirm.question"),
                        now: t("changes.confirm.now"),
                        nowEmpty: t("changes.confirm.nowEmpty"),
                        withLine: t("changes.confirm.withLine"),
                        gain: (points) => t("changes.confirm.gain", { points }),
                        add: t("changes.confirm.add"),
                        remove: t("changes.confirm.remove"),
                        needsSection: t("changes.confirm.needsSection", {
                          section: t(`changes.confirm.sections.${group.confirm?.requires ?? "experience"}`),
                        }),
                      }}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t("preview.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {selectedSectionCount > 0
                    ? t("preview.selected", { count: selectedSectionCount })
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
    </SectionSelectionProvider>
  );
}
