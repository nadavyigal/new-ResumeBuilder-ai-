"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { posthog } from "@/lib/posthog";
import { AlertCircle, CheckCircle, Sparkles, Target, TrendingUp } from "@/lib/icons";
import type { ExpertWorkflowType } from "@/lib/expert-workflows";
import { useLocale, useTranslations } from "next-intl";

type WorkflowStatus = "completed" | "needs_user_input" | "failed";

type ReportEnvelope = {
  headline: string;
  executive_summary: string;
  priority_actions: string[];
  evidence_gaps: string[];
  ats_impact_estimate: {
    before: number | null;
    after: number | null;
    delta: number | null;
    confidence_note?: string;
  };
};

type RunResponse = {
  run_id: string;
  status: WorkflowStatus;
  output: Record<string, unknown>;
  needs_user_input: boolean;
  missing_evidence: string[];
};

type ApplyResponse = {
  success: boolean;
  updated_fields: string[];
  ats_impact: {
    before: number | null;
    after: number | null;
    delta: number | null;
  };
  apply_mode: string;
  selection_index: number | null;
  new_ats_score?: number | null;
};

type ApplicationOption = {
  id: string;
  job_title: string | null;
  company_name: string | null;
  applied_date: string | null;
};

interface ExpertModesPanelProps {
  optimizationId: string;
  isPremium: boolean;
  onApplied?: () => void;
  onAtsImpact?: (impact: { before: number | null; after: number | null; delta: number | null }) => void;
}

const WORKFLOWS: Array<{
  type: ExpertWorkflowType;
  icon: typeof Sparkles;
}> = [
  {
    type: "full_resume_rewrite",
    icon: Sparkles,
  },
  {
    type: "achievement_quantifier",
    icon: TrendingUp,
  },
  {
    type: "ats_optimization_report",
    icon: Target,
  },
  {
    type: "professional_summary_lab",
    icon: CheckCircle,
  },
];

function toReportEnvelope(value: unknown): ReportEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const report = value as Record<string, unknown>;
  const impact =
    report.ats_impact_estimate &&
    typeof report.ats_impact_estimate === "object" &&
    !Array.isArray(report.ats_impact_estimate)
      ? (report.ats_impact_estimate as Record<string, unknown>)
      : {};

  const priority = Array.isArray(report.priority_actions)
    ? report.priority_actions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const evidence = Array.isArray(report.evidence_gaps)
    ? report.evidence_gaps.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    headline: String(report.headline || "Expert report"),
    executive_summary: String(report.executive_summary || ""),
    priority_actions: priority,
    evidence_gaps: evidence,
    ats_impact_estimate: {
      before: typeof impact.before === "number" ? impact.before : null,
      after: typeof impact.after === "number" ? impact.after : null,
      delta: typeof impact.delta === "number" ? impact.delta : null,
      confidence_note: typeof impact.confidence_note === "string" ? impact.confidence_note : undefined,
    },
  };
}

function formatScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

export function ExpertModesPanel({
  optimizationId,
  isPremium,
  onApplied,
  onAtsImpact,
}: ExpertModesPanelProps) {
  const t = useTranslations("dashboard.optimization.expert");
  const locale = useLocale();

  const [activeWorkflow, setActiveWorkflow] = useState<ExpertWorkflowType>(WORKFLOWS[0].type);
  const [runLoading, setRunLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);
  const [selectionIndex, setSelectionIndex] = useState<number | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const workflowMeta = useMemo(() => {
    return WORKFLOWS.find((workflow) => workflow.type === activeWorkflow) || WORKFLOWS[0];
  }, [activeWorkflow]);

  const summaryOptions =
    activeWorkflow === "professional_summary_lab" &&
    runResult?.output &&
    Array.isArray((runResult.output as any).summary_options)
      ? ((runResult.output as any).summary_options as Array<Record<string, unknown>>)
      : [];

  const report = runResult ? toReportEnvelope((runResult.output as any).report) : null;

  useEffect(() => {
    posthog.capture("expert_mode_viewed", {
      optimization_id: optimizationId,
      is_premium: isPremium,
    });
  }, [optimizationId, isPremium]);

  const resetForMode = (workflowType: ExpertWorkflowType) => {
    setActiveWorkflow(workflowType);
    setRunResult(null);
    setApplyResult(null);
    setError(null);
    setLockedMessage(null);
    setSelectionIndex(null);
    setSaveSuccessMessage(null);
    posthog.capture("expert_mode_clicked", {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      is_premium: isPremium,
    });
  };

  const runWorkflow = async () => {
    setRunLoading(true);
    setError(null);
    setLockedMessage(null);
    setApplyResult(null);
    setSaveSuccessMessage(null);

    try {
      const response = await fetch("/api/v1/expert-workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optimization_id: optimizationId,
          workflow_type: activeWorkflow,
          options: {},
          evidence_inputs: {},
        }),
      });

      const payload = await response.json();

      if (response.status === 402) {
        setLockedMessage(payload.locked_preview || t("locked.default"));
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || t("errors.run"));
      }

      const runPayload = payload as RunResponse;
      setRunResult(runPayload);

      if (activeWorkflow === "professional_summary_lab") {
        const recommendedIndex = Number((runPayload.output as any).recommended_index);
        if (!Number.isNaN(recommendedIndex)) {
          setSelectionIndex(recommendedIndex);
        }
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : t("errors.run"));
    } finally {
      setRunLoading(false);
    }
  };

  const applyWorkflow = async () => {
    if (!runResult?.run_id) return;

    setApplyLoading(true);
    setError(null);
    setSaveSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/expert-workflows/runs/${runResult.run_id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apply_mode: activeWorkflow === "ats_optimization_report" ? "skills_only" : "default",
          selection_index: selectionIndex ?? undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || t("errors.apply"));
      }

      const applyPayload = payload as ApplyResponse;
      setApplyResult(applyPayload);

      if (onAtsImpact) {
        onAtsImpact(applyPayload.ats_impact);
      }

      if (onApplied) {
        onApplied();
      }
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : t("errors.apply"));
    } finally {
      setApplyLoading(false);
    }
  };

  const openSaveDialog = async () => {
    if (!runResult?.run_id || !applyResult?.success) return;

    setSaveDialogOpen(true);
    setError(null);
    setSaveSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/v1/applications?optimization_id=${encodeURIComponent(optimizationId)}&limit=50`,
        { cache: "no-store" }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || t("errors.loadApplications"));
      }

      const options = Array.isArray(payload.applications)
        ? (payload.applications as ApplicationOption[])
        : [];

      setApplications(options);
      setSelectedApplicationId(options[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("errors.loadApplications"));
      setApplications([]);
      setSelectedApplicationId("");
    }
  };

  const saveReportToApplication = async () => {
    if (!runResult?.run_id || !selectedApplicationId) return;

    setSaveLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/applications/${selectedApplicationId}/expert-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runResult.run_id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || t("errors.save"));
      }

      setSaveDialogOpen(false);
      setSaveSuccessMessage(t("save.success"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("errors.save"));
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <Card className="border border-border/70 bg-gradient-to-br from-card via-card to-muted/30">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl md:text-2xl">{t("title")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </div>
            <Badge variant={isPremium ? "default" : "secondary"}>
              {isPremium ? t("premium.active") : t("premium.locked")}
            </Badge>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            {WORKFLOWS.map((workflow) => {
              const Icon = workflow.icon;
              const isActive = workflow.type === activeWorkflow;
              return (
                <button
                  key={workflow.type}
                  onClick={() => resetForMode(workflow.type)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/70 bg-background hover:border-primary/40"
                  }`}
                  type="button"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`modes.${workflow.type}.label`)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{t(`modes.${workflow.type}.title`)}</p>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{t(`modes.${workflowMeta.type}.title`)}</p>
              <p className="text-sm text-muted-foreground">{t(`modes.${workflowMeta.type}.description`)}</p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t(`modes.${workflowMeta.type}.preview`)}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!isPremium ? (
                <>
                  <Button
                    onClick={() => {
                      posthog.capture("upgrade_clicked_from_expert", {
                        workflow_type: activeWorkflow,
                        optimization_id: optimizationId,
                      });
                      window.location.href = "/pricing";
                    }}
                  >
                    {t("actions.upgrade")}
                  </Button>
                  <Button variant="outline" onClick={runWorkflow} disabled={runLoading}>
                    {runLoading ? t("actions.running") : t("actions.preview")}
                  </Button>
                </>
              ) : (
                <Button onClick={runWorkflow} disabled={runLoading}>
                  {runLoading ? t("actions.running") : t("actions.run")}
                </Button>
              )}

              {runResult && (
                <Button onClick={applyWorkflow} disabled={applyLoading} variant="secondary">
                  {applyLoading ? t("actions.applying") : t("actions.apply")}
                </Button>
              )}

              {runResult && applyResult?.success && (
                <Button onClick={openSaveDialog} variant="outline">
                  {t("actions.save")}
                </Button>
              )}
            </div>

            {lockedMessage && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{lockedMessage}</p>
            )}
          </div>

          {runResult && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={runResult.status === "completed" ? "default" : "secondary"}>
                  {t(`status.${runResult.status}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">{t("runId")}: {runResult.run_id}</span>
              </div>

              {report ? (
                <Card className="border border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{report.headline}</CardTitle>
                    <CardDescription>{report.executive_summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold">{t("report.priorityActions")}</p>
                      {report.priority_actions.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {report.priority_actions.map((action, idx) => (
                            <li key={`priority-${idx}`} className="rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                              {action}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("report.none")}</p>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold">{t("report.evidenceGaps")}</p>
                      {report.evidence_gaps.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {report.evidence_gaps.map((item, idx) => (
                            <li key={`gap-${idx}`} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("report.none")}</p>
                      )}
                    </div>

                    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                      <p className="text-sm font-semibold">{t("report.estimatedImpact")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatScore(report.ats_impact_estimate.before)}
                        {" -> "}
                        {formatScore(report.ats_impact_estimate.after)}
                        {report.ats_impact_estimate.delta !== null ? ` (${report.ats_impact_estimate.delta >= 0 ? "+" : ""}${Math.round(report.ats_impact_estimate.delta)}%)` : ""}
                      </p>
                      {report.ats_impact_estimate.confidence_note && (
                        <p className="mt-1 text-xs text-muted-foreground">{report.ats_impact_estimate.confidence_note}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-dashed border-border/70">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{t("report.unavailable")}</p>
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">{t("report.debug")}</summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3">
                        {JSON.stringify(runResult.output, null, 2)}
                      </pre>
                    </details>
                  </CardContent>
                </Card>
              )}

              {summaryOptions.length > 0 && (
                <Card className="border border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("summaryOptions.title")}</CardTitle>
                    <CardDescription>{t("summaryOptions.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {summaryOptions.map((option, index) => (
                      <label
                        key={`summary-option-${index}`}
                        className="block cursor-pointer rounded-md border border-border/70 p-3 hover:bg-muted/40"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <input
                            type="radio"
                            name="summary-option"
                            checked={selectionIndex === index}
                            onChange={() => setSelectionIndex(index)}
                          />
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {String(option.angle || t("summaryOptions.defaultLabel"))}
                          </span>
                        </div>
                        <p className="text-sm">{String(option.summary || "")}</p>
                      </label>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {applyResult?.success && (
            <Card className="border border-emerald-300 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-emerald-900 dark:text-emerald-100">
                  {t("applied.title")}
                </CardTitle>
                <CardDescription className="text-emerald-800/80 dark:text-emerald-200/80">
                  {t("applied.description", { count: applyResult.updated_fields.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-emerald-900 dark:text-emerald-100">
                  {t("applied.impact")}: {formatScore(applyResult.ats_impact.before)}
                  {" -> "}
                  {formatScore(applyResult.ats_impact.after)}
                  {applyResult.ats_impact.delta !== null
                    ? ` (${applyResult.ats_impact.delta >= 0 ? "+" : ""}${Math.round(applyResult.ats_impact.delta)}%)`
                    : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {saveSuccessMessage && (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
              {saveSuccessMessage}
            </p>
          )}

          {error && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("save.title")}</DialogTitle>
            <DialogDescription>{t("save.description")}</DialogDescription>
          </DialogHeader>

          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("save.noApplications")}</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-auto">
              {applications.map((application) => {
                const company = application.company_name || t("save.unknownCompany");
                const title = application.job_title || t("save.unknownRole");
                const date = application.applied_date
                  ? new Date(application.applied_date).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")
                  : t("save.unknownDate");

                return (
                  <label
                    key={application.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-3"
                  >
                    <input
                      type="radio"
                      name="application-select"
                      checked={selectedApplicationId === application.id}
                      onChange={() => setSelectedApplicationId(application.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{company}</p>
                      <p className="text-xs text-muted-foreground">{date}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={saveReportToApplication}
              disabled={saveLoading || !selectedApplicationId}
            >
              {saveLoading ? t("actions.saving") : t("actions.confirmSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
