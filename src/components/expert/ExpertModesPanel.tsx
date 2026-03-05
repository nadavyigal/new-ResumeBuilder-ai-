"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  TrendingUp,
  Target,
  PenLine,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  BookmarkCheck,
  Loader2,
  Lock,
  ArrowRight,
  FilePen,
  FileText,
} from "lucide-react";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";
import { posthog } from "@/lib/posthog";
import type { ExpertWorkflowType } from "@/lib/expert-workflows";

// ─── Types ───────────────────────────────────────────────────────────────────

type RunResponse = {
  run_id: string;
  status: "completed" | "needs_user_input" | "failed";
  output: Record<string, unknown>;
  needs_user_input: boolean;
  missing_evidence: string[];
};

type ApplyResult = {
  success: boolean;
  updated_fields: string[];
  ats_impact: { before: number | null; after: number | null; delta: number | null };
  apply_mode: string;
  selection_index: number | null;
  new_ats_score?: number | null;
};

type AtsImpact = {
  before: number | null;
  after: number | null;
  delta: number | null;
  confidence_note?: string;
};

type AppItem = {
  id: string;
  job_title: string;
  company_name: string;
};

type ExpertReport = {
  headline?: string;
  executive_summary?: string;
  priority_actions?: string[];
  evidence_gaps?: string[];
  ats_impact_estimate?: AtsImpact;
};

// ─── Workflow Config ──────────────────────────────────────────────────────────

const WORKFLOWS: Array<{
  type: ExpertWorkflowType;
  label: string;
  tagline: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  category: "resume" | "document";
}> = [
  {
    type: "full_resume_rewrite",
    label: "Strategic Rewrite",
    tagline: "Transform your entire resume for maximum role fit",
    description:
      "Generates a complete role-targeted rewrite with ATS-safe structure, stronger action verbs, and recruiter-optimized formatting. Best used when you want a major positioning shift.",
    Icon: Sparkles,
    category: "resume",
  },
  {
    type: "achievement_quantifier",
    label: "Impact Amplifier",
    tagline: "Upgrade weak bullets into evidence-backed achievements",
    description:
      "Converts vague duty bullets into quantified impact statements. Surfaces missing evidence you should add to make each bullet irresistible to hiring managers.",
    Icon: TrendingUp,
    category: "resume",
  },
  {
    type: "ats_optimization_report",
    label: "ATS Deep Scan",
    tagline: "Uncover keyword gaps and formatting issues blocking ATS",
    description:
      "Analyzes keyword density, section heading compliance, and formatting rules that ATS systems use to rank resumes. Delivers a prioritized fix list.",
    Icon: Target,
    category: "resume",
  },
  {
    type: "professional_summary_lab",
    label: "Summary Workshop",
    tagline: "Craft 5 compelling summary angles, choose your best",
    description:
      "Generates 5 summary directions — leadership, technical, results-driven, industry-specific, and visionary — then recommends the best fit for the target role.",
    Icon: PenLine,
    category: "resume",
  },
  {
    type: "cover_letter_architect",
    label: "Cover Letter",
    tagline: "3 tailored cover letter drafts, ready to send",
    description:
      "Generates three cover letter angles — concise, narrative, and impact-focused — each tailored to the job description. Pick your favorite and attach it to your application.",
    Icon: Mail,
    category: "document",
  },
  {
    type: "screening_answer_studio",
    label: "Screening Answers",
    tagline: "Smart answers to common screening questions",
    description:
      "Crafts confident, evidence-backed answers to the screening questions most likely asked for this role. Each answer draws from your actual resume experience.",
    Icon: MessageSquare,
    category: "document",
  },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function ATSImpactRow({
  impact,
  label,
  isEstimate = false,
}: {
  impact: AtsImpact;
  label: string;
  isEstimate?: boolean;
}) {
  const { before, after, delta, confidence_note } = impact;
  if (before === null && after === null && delta === null) return null;
  return (
    <div className="flex items-center flex-wrap gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {before !== null && <span className="font-medium">{Math.round(before)}</span>}
      {before !== null && after !== null && (
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
      )}
      {after !== null && <span className="font-semibold">{Math.round(after)}</span>}
      {delta !== null && (
        <Badge
          variant={delta > 0 ? "default" : delta < 0 ? "destructive" : "secondary"}
          className="text-xs"
        >
          {delta > 0 ? "+" : ""}
          {Math.round(delta)} pts
        </Badge>
      )}
      {isEstimate && confidence_note && (
        <span className="text-xs text-muted-foreground">({confidence_note})</span>
      )}
      {isEstimate && (
        <span className="text-xs text-muted-foreground italic">estimated</span>
      )}
    </div>
  );
}

function ReportDisplay({
  output,
  workflowType,
}: {
  output: Record<string, unknown>;
  workflowType: ExpertWorkflowType;
}) {
  const report = (output as any).report as ExpertReport | undefined;

  if (!report) {
    return (
      <pre className="text-xs bg-muted p-3 rounded-lg max-h-64 overflow-auto">
        {JSON.stringify(output, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline */}
      {report.headline && (
        <p className="text-base font-bold leading-snug">{report.headline}</p>
      )}

      {/* Executive Summary */}
      {report.executive_summary && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
            {report.executive_summary}
          </p>
        </div>
      )}

      {/* Priority Actions */}
      {report.priority_actions && report.priority_actions.length > 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-green-800 dark:text-green-200">
              Priority Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ol className="space-y-2">
              {report.priority_actions.map((action, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Evidence Gaps */}
      {report.evidence_gaps && report.evidence_gaps.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-amber-800 dark:text-amber-200">
              Information Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ul className="space-y-2">
              {report.evidence_gaps.map((gap, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ATS Estimate */}
      {report.ats_impact_estimate && (
        <div className="pt-1">
          <ATSImpactRow
            impact={report.ats_impact_estimate}
            label="Estimated ATS impact"
            isEstimate
          />
        </div>
      )}

      {/* Mode-specific: Achievement Quantifier bullet rewrites */}
      {workflowType === "achievement_quantifier" && (() => {
        const bullets = (output as any).bullet_rewrites as Array<{
          original_bullet: string;
          optimized_bullet: string;
        }> | undefined;
        if (!bullets?.length) return null;
        return (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Bullet Rewrites</p>
            {bullets.slice(0, 8).map((b, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground line-through">{b.original_bullet}</p>
                <p className="text-sm font-medium">{b.optimized_bullet}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Mode-specific: Screening Answer Studio */}
      {workflowType === "screening_answer_studio" && (() => {
        const answers = (output as any).screening_answers as Array<{
          question: string;
          answer: string;
          confidence_note?: string;
        }> | undefined;
        if (!answers?.length) return null;
        return (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Screening Answers</p>
            {answers.map((qa, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1.5">
                <p className="text-sm font-semibold">{qa.question}</p>
                <p className="text-sm">{qa.answer}</p>
                {qa.confidence_note && (
                  <p className="text-xs text-muted-foreground italic">{qa.confidence_note}</p>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Mode-specific: ATS Deep Scan keyword table */}
      {workflowType === "ats_optimization_report" && (() => {
        const atsReport = (output as any).ats_report as Record<string, unknown> | undefined;
        const keywords = (atsReport?.keyword_match_analysis as Array<{
          keyword: string;
          present: boolean;
          suggested_placement?: string;
        }>) || [];
        if (!keywords.length) return null;
        return (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Keyword Analysis</p>
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Keyword</th>
                    <th className="text-left px-3 py-2">Found</th>
                    <th className="text-left px-3 py-2">Suggestion</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{kw.keyword}</td>
                      <td className="px-3 py-2">
                        <Badge variant={kw.present ? "default" : "secondary"} className="text-xs">
                          {kw.present ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {kw.suggested_placement || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpertModesPanelProps {
  optimizationId: string;
  isPremium: boolean;
  onApplied?: () => void;
}

export function ExpertModesPanel({
  optimizationId,
  isPremium,
  onApplied,
}: ExpertModesPanelProps) {
  // Active tab
  const [activeTab, setActiveTab] = useState<ExpertWorkflowType>("full_resume_rewrite");

  // Per-tab persistent state
  const [results, setResults] = useState<Map<ExpertWorkflowType, RunResponse>>(
    () => new Map()
  );
  const [applyResults, setApplyResults] = useState<Map<ExpertWorkflowType, ApplyResult>>(
    () => new Map()
  );
  const [savedRuns, setSavedRuns] = useState<Set<string>>(() => new Set());
  const [selectionMap, setSelectionMap] = useState<Map<ExpertWorkflowType, number>>(
    () => new Map()
  );
  const [errorMap, setErrorMap] = useState<Map<ExpertWorkflowType, string>>(
    () => new Map()
  );

  // Per-tab transient loading state
  const [loadingTab, setLoadingTab] = useState<ExpertWorkflowType | null>(null);
  const [applyingTab, setApplyingTab] = useState<ExpertWorkflowType | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  // Save-report flow
  const [linkedApps, setLinkedApps] = useState<AppItem[] | null>(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [savingRunId, setSavingRunId] = useState<string | null>(null);
  const [savedAppId, setSavedAppId] = useState<string | null>(null);

  // Derived
  const activeWorkflow = useMemo(
    () => WORKFLOWS.find((w) => w.type === activeTab)!,
    [activeTab]
  );
  const activeResult = results.get(activeTab);
  const activeApplyResult = applyResults.get(activeTab);
  const activeError = errorMap.get(activeTab);
  const isRunning = loadingTab === activeTab;
  const isApplying = applyingTab === activeTab;

  const summaryOptions =
    activeTab === "professional_summary_lab" &&
    activeResult?.output &&
    Array.isArray((activeResult.output as any).summary_options)
      ? ((activeResult.output as any).summary_options as Array<{
          angle: string;
          summary: string;
          rationale: string;
        }>)
      : [];

  const coverLetterVariants =
    activeTab === "cover_letter_architect" &&
    activeResult?.output &&
    Array.isArray((activeResult.output as any).cover_letter_variants)
      ? ((activeResult.output as any).cover_letter_variants as Array<{
          angle: string;
          title: string;
          letter: string;
          rationale: string;
        }>)
      : [];

  useEffect(() => {
    posthog.capture("expert_mode_viewed", {
      optimization_id: optimizationId,
      is_premium: isPremium,
    });
  }, [optimizationId, isPremium]);

  const handleTabClick = (type: ExpertWorkflowType) => {
    setActiveTab(type);
    setLockedMessage(null);
  };

  const runWorkflow = async () => {
    setLoadingTab(activeTab);
    setErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(activeTab);
      return m;
    });
    setLockedMessage(null);

    try {
      const response = await fetch("/api/v1/expert-workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optimization_id: optimizationId,
          workflow_type: activeTab,
          options: {},
          evidence_inputs: {},
        }),
      });
      const payload = await response.json();

      if (response.status === 402) {
        setLockedMessage(
          payload.locked_preview || "Upgrade to Premium to unlock this Expert Mode."
        );
        posthog.capture("expert_mode_locked", {
          workflow_type: activeTab,
          optimization_id: optimizationId,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "Failed to run Expert Mode.");
      }

      const runPayload = payload as RunResponse;
      setResults((prev) => new Map(prev).set(activeTab, runPayload));

      if (
        activeTab === "professional_summary_lab" ||
        activeTab === "cover_letter_architect"
      ) {
        const recommendedIndex = Number((runPayload.output as any).recommended_index);
        if (!Number.isNaN(recommendedIndex)) {
          setSelectionMap((prev) => new Map(prev).set(activeTab, recommendedIndex));
        }
      }

      posthog.capture("expert_run_completed", {
        workflow_type: activeTab,
        optimization_id: optimizationId,
        run_id: runPayload.run_id,
      });
    } catch (err) {
      setErrorMap((prev) =>
        new Map(prev).set(
          activeTab,
          err instanceof Error ? err.message : "Failed to run workflow."
        )
      );
    } finally {
      setLoadingTab(null);
    }
  };

  const fetchLinkedApplications = useCallback(async () => {
    setLoadingApps(true);
    try {
      const res = await fetch(
        `/api/v1/applications?optimization_id=${encodeURIComponent(optimizationId)}&limit=20`
      );
      if (!res.ok) throw new Error("Failed to fetch applications.");
      const data = await res.json();
      const apps = (data.applications || []) as AppItem[];
      setLinkedApps(apps);
      if (apps.length === 1) setSelectedAppId(apps[0].id);
    } catch {
      setLinkedApps([]);
    } finally {
      setLoadingApps(false);
    }
  }, [optimizationId]);

  const applyResult = async () => {
    if (!activeResult?.run_id) return;
    setApplyingTab(activeTab);
    setErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(activeTab);
      return m;
    });

    try {
      const response = await fetch(
        `/api/v1/expert-workflows/runs/${activeResult.run_id}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apply_mode:
              activeTab === "ats_optimization_report" ? "skills_only" : "default",
            selection_index: selectionMap.get(activeTab) ?? undefined,
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to apply workflow output.");
      }

      const applyPayload = payload as ApplyResult;
      setApplyResults((prev) => new Map(prev).set(activeTab, applyPayload));

      // Eagerly fetch linked applications for the save flow
      fetchLinkedApplications();

      posthog.capture("expert_apply_clicked", {
        workflow_type: activeTab,
        optimization_id: optimizationId,
        run_id: activeResult.run_id,
      });

      if (onApplied) onApplied();
    } catch (err) {
      setErrorMap((prev) =>
        new Map(prev).set(
          activeTab,
          err instanceof Error ? err.message : "Failed to apply workflow."
        )
      );
    } finally {
      setApplyingTab(null);
    }
  };

  const saveReport = async () => {
    if (!selectedAppId || !activeResult?.run_id) return;
    setSavingRunId(activeResult.run_id);
    try {
      const res = await fetch(
        `/api/v1/applications/${selectedAppId}/expert-reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: activeResult.run_id }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save report.");
      }
      setSavedRuns((prev) => new Set(prev).add(activeResult.run_id));
      setSavedAppId(selectedAppId);
      posthog.capture("expert_report_saved", {
        workflow_type: activeTab,
        optimization_id: optimizationId,
        run_id: activeResult.run_id,
        application_id: selectedAppId,
      });
    } catch (err) {
      setErrorMap((prev) =>
        new Map(prev).set(
          activeTab,
          err instanceof Error ? err.message : "Failed to save report."
        )
      );
    } finally {
      setSavingRunId(null);
    }
  };

  const isAlreadySaved = activeResult ? savedRuns.has(activeResult.run_id) : false;

  return (
    <section className="space-y-4" dir="ltr">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Expert Command Center</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Run high-impact AI workflows, apply improvements, and save validated reports to your
            applications.
          </p>
        </div>
        <Badge
          variant={isPremium ? "default" : "secondary"}
          className="shrink-0 mt-1"
        >
          {isPremium ? "Premium Active" : "Premium"}
        </Badge>
      </div>

      {/* ── Tab Strip ── */}
      <div
        role="tablist"
        className="grid grid-cols-3 sm:grid-cols-6 gap-1 rounded-xl bg-muted p-1"
      >
        {WORKFLOWS.map(({ type, label, Icon, category }) => (
          <button
            key={type}
            role="tab"
            aria-selected={activeTab === type}
            onClick={() => handleTabClick(type)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm font-medium transition-all",
              activeTab === type
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate text-xs leading-none">{label}</span>
            <span
              className={cn(
                "hidden sm:flex items-center gap-0.5 text-[10px] font-normal leading-none",
                category === "resume"
                  ? "text-green-600 dark:text-green-400"
                  : "text-blue-500 dark:text-blue-400"
              )}
            >
              {category === "resume" ? (
                <><FilePen className="w-2.5 h-2.5" /> Resume</>
              ) : (
                <><FileText className="w-2.5 h-2.5" /> Document</>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ── Active Tab Panel ── */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <activeWorkflow.Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base">{activeWorkflow.label}</CardTitle>
              <p className="text-xs font-medium text-primary">{activeWorkflow.tagline}</p>
              <CardDescription className="text-sm">
                {activeWorkflow.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Error display ── */}
          {activeError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm text-red-800 dark:text-red-200">{activeError}</p>
            </div>
          )}

          {/* ── Locked (non-premium) message ── */}
          {lockedMessage && (
            <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-900 dark:text-amber-100">{lockedMessage}</p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    posthog.capture("upgrade_clicked_from_expert", {
                      workflow_type: activeTab,
                      optimization_id: optimizationId,
                    });
                    window.location.href = "/pricing";
                  }}
                >
                  Upgrade to Premium
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── No result yet: show run button ── */}
          {!activeResult && !lockedMessage && (
            <Button
              onClick={runWorkflow}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running workflow…
                </>
              ) : (
                <>
                  <activeWorkflow.Icon className="w-4 h-4 mr-2" />
                  {isPremium ? "Run Workflow" : "Preview & Unlock"}
                </>
              )}
            </Button>
          )}

          {/* ── Result view ── */}
          {activeResult && (
            <div className="space-y-4">
              {/* Status + run again */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge
                  variant={
                    activeResult.status === "completed"
                      ? "default"
                      : activeResult.status === "failed"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {activeResult.status.replace(/_/g, " ")}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runWorkflow}
                  disabled={isRunning || isApplying}
                  className="text-xs h-7"
                >
                  {isRunning ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : null}
                  Re-run
                </Button>
              </div>

              {/* Missing evidence */}
              {activeResult.missing_evidence.length > 0 && (
                <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm text-orange-800 dark:text-orange-200">
                      Missing Evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-1">
                    {activeResult.missing_evidence.map((item, i) => (
                      <p
                        key={`missing-${i}`}
                        className="text-sm text-orange-900 dark:text-orange-100"
                      >
                        • {item}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Structured report display */}
              <ReportDisplay output={activeResult.output} workflowType={activeTab} />

              {/* Summary Lab: radio options */}
              {summaryOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Choose a Summary Direction</p>
                  {summaryOptions.map((option, index) => (
                    <label
                      key={`summary-option-${index}`}
                      className={cn(
                        "block rounded-lg border p-3 cursor-pointer transition-colors",
                        selectionMap.get(activeTab) === index
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <input
                          type="radio"
                          name="summary-option"
                          checked={selectionMap.get(activeTab) === index}
                          onChange={() =>
                            setSelectionMap((prev) => new Map(prev).set(activeTab, index))
                          }
                          className="shrink-0"
                        />
                        <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                          {String(option.angle)}
                        </span>
                      </div>
                      <p className="text-sm">{option.summary}</p>
                      {option.rationale && (
                        <p className="text-xs text-muted-foreground mt-1">{option.rationale}</p>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {/* Cover Letter Architect: variant selector */}
              {coverLetterVariants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Pick a Cover Letter Version</p>
                  {coverLetterVariants.map((variant, index) => (
                    <label
                      key={`cl-variant-${index}`}
                      className={cn(
                        "block rounded-lg border p-3 cursor-pointer transition-colors",
                        selectionMap.get(activeTab) === index
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <input
                          type="radio"
                          name="cover-letter-variant"
                          checked={selectionMap.get(activeTab) === index}
                          onChange={() =>
                            setSelectionMap((prev) => new Map(prev).set(activeTab, index))
                          }
                          className="shrink-0"
                        />
                        <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                          {variant.angle}
                        </span>
                        {variant.title && (
                          <span className="text-xs font-medium truncate">{variant.title}</span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-line line-clamp-3">{variant.letter}</p>
                      {variant.rationale && (
                        <p className="text-xs text-muted-foreground mt-1">{variant.rationale}</p>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {/* ── Apply button (before applying) ── */}
              {!activeApplyResult && (
                <Button
                  onClick={applyResult}
                  disabled={isApplying}
                  className="w-full"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {activeTab === "cover_letter_architect" || activeTab === "screening_answer_studio"
                        ? "Saving output…"
                        : "Applying to resume…"}
                    </>
                  ) : activeTab === "cover_letter_architect" ? (
                    "Save Selected Cover Letter"
                  ) : activeTab === "screening_answer_studio" ? (
                    "Save Screening Answers"
                  ) : (
                    "Apply to Optimized Resume"
                  )}
                </Button>
              )}

              {/* ── Post-apply: ATS delta + save flow ── */}
              {activeApplyResult && (
                <div className="space-y-3 pt-1">
                  {/* Real ATS delta */}
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 space-y-1">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                      {activeTab === "cover_letter_architect"
                        ? "Cover letter saved"
                        : activeTab === "screening_answer_studio"
                        ? "Screening answers saved"
                        : "Applied to your resume"}
                    </p>
                    <ATSImpactRow
                      impact={activeApplyResult.ats_impact}
                      label="ATS score change"
                    />
                    {activeApplyResult.updated_fields.length > 0 && (
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Updated: {activeApplyResult.updated_fields.join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Save to application */}
                  {isAlreadySaved ? (
                    <div className="flex items-center flex-wrap gap-2 text-sm text-green-700 dark:text-green-400">
                      <BookmarkCheck className="w-4 h-4 shrink-0" />
                      <span>Report saved</span>
                      {savedAppId && (
                        <Link
                          href={`/dashboard/applications/${savedAppId}`}
                          className="underline underline-offset-2 hover:opacity-80 font-medium"
                        >
                          View on application page →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Save Report to Application</p>

                      {loadingApps && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading linked applications…
                        </p>
                      )}

                      {!loadingApps && linkedApps !== null && linkedApps.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No application linked yet. Use the{" "}
                          <span className="font-medium">Apply Now</span> button to save this
                          optimization as an application first.
                        </p>
                      )}

                      {!loadingApps && linkedApps && linkedApps.length > 1 && (
                        <Select
                          value={selectedAppId ?? ""}
                          onValueChange={setSelectedAppId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select application…" />
                          </SelectTrigger>
                          <SelectContent>
                            {linkedApps.map((app) => (
                              <SelectItem key={app.id} value={app.id}>
                                {app.job_title} — {app.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {!loadingApps && linkedApps && linkedApps.length >= 1 && (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={!selectedAppId || savingRunId !== null}
                          onClick={saveReport}
                        >
                          {savingRunId ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            <>
                              <BookmarkCheck className="w-4 h-4 mr-2" />
                              Save Report
                              {linkedApps.length === 1
                                ? ` — ${linkedApps[0].job_title}`
                                : ""}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
