"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { posthog } from "@/lib/posthog";
import type { ExpertWorkflowType } from "@/lib/expert-workflows";

type RunResponse = {
  run_id: string;
  status: "completed" | "needs_user_input" | "failed";
  output: Record<string, unknown>;
  needs_user_input: boolean;
  missing_evidence: string[];
};

interface ExpertModesPanelProps {
  optimizationId: string;
  isPremium: boolean;
  onApplied?: () => void;
}

const WORKFLOWS: Array<{
  type: ExpertWorkflowType;
  title: string;
  description: string;
  preview: string;
}> = [
  {
    type: "full_resume_rewrite",
    title: "Full Resume Rewrite",
    description: "Role-targeted rewrite with ATS-safe structure and stronger action-oriented bullets.",
    preview: "Summary + experience rewritten for role fit with truth-first constraints.",
  },
  {
    type: "achievement_quantifier",
    title: "Achievement Quantifier",
    description: "Converts weak bullets into stronger, evidence-backed results statements.",
    preview: "Before/after bullet upgrades with missing-evidence prompts when needed.",
  },
  {
    type: "ats_optimization_report",
    title: "ATS Optimization Report",
    description: "Keyword placement strategy, heading compliance, and ATS formatting guidance.",
    preview: "Keyword match table + ATS-safe format recommendations.",
  },
  {
    type: "professional_summary_lab",
    title: "Professional Summary Lab",
    description: "Generates 5 summary options and recommends the best fit for the target role.",
    preview: "5 summary angles (leadership, technical, results, industry, vision).",
  },
];

function formatWorkflowType(type: ExpertWorkflowType): string {
  return type.replace(/_/g, " ");
}

export function ExpertModesPanel({ optimizationId, isPremium, onApplied }: ExpertModesPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<ExpertWorkflowType | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [selectionIndex, setSelectionIndex] = useState<number | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  const workflowMeta = useMemo(
    () => WORKFLOWS.find((workflow) => workflow.type === activeWorkflow) || null,
    [activeWorkflow]
  );

  useEffect(() => {
    posthog.capture("expert_mode_viewed", {
      optimization_id: optimizationId,
      is_premium: isPremium,
    });
  }, [optimizationId, isPremium]);

  const openWorkflow = (workflowType: ExpertWorkflowType) => {
    setActiveWorkflow(workflowType);
    setOpen(true);
    setResult(null);
    setError(null);
    setSelectionIndex(null);
    setLockedMessage(null);
    posthog.capture("expert_mode_clicked", {
      workflow_type: workflowType,
      optimization_id: optimizationId,
      is_premium: isPremium,
    });
  };

  const runWorkflow = async () => {
    if (!activeWorkflow) return;
    setLoading(true);
    setError(null);
    setLockedMessage(null);

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
        setLockedMessage(
          payload.locked_preview || "Premium is required for this Expert Mode."
        );
        posthog.capture("expert_mode_locked", {
          workflow_type: activeWorkflow,
          optimization_id: optimizationId,
        });
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "Failed to run Expert Mode.");
      }

      const runPayload = payload as RunResponse;
      setResult(runPayload);
      if (activeWorkflow === "professional_summary_lab") {
        const recommendedIndex = Number((runPayload.output as any).recommended_index);
        if (!Number.isNaN(recommendedIndex)) {
          setSelectionIndex(recommendedIndex);
        }
      }
      posthog.capture("expert_run_completed", {
        workflow_type: activeWorkflow,
        optimization_id: optimizationId,
        run_id: runPayload.run_id,
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to run workflow.");
    } finally {
      setLoading(false);
    }
  };

  const applyResult = async () => {
    if (!result?.run_id) return;
    setApplying(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/expert-workflows/runs/${result.run_id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apply_mode: activeWorkflow === "ats_optimization_report" ? "skills_only" : "default",
          selection_index: selectionIndex ?? undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to apply workflow output.");
      }

      posthog.capture("expert_apply_clicked", {
        workflow_type: activeWorkflow,
        optimization_id: optimizationId,
        run_id: result.run_id,
      });
      setOpen(false);
      if (onApplied) onApplied();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to apply workflow output.");
    } finally {
      setApplying(false);
    }
  };

  const summaryOptions =
    activeWorkflow === "professional_summary_lab" &&
    result?.output &&
    Array.isArray((result.output as any).summary_options)
      ? ((result.output as any).summary_options as Array<Record<string, unknown>>)
      : [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Expert Modes</h3>
          <p className="text-sm text-muted-foreground">
            Advanced workflows for interview-ready positioning.
          </p>
        </div>
        <Badge variant={isPremium ? "default" : "secondary"}>
          {isPremium ? "Premium Active" : "Premium"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {WORKFLOWS.map((workflow) => (
          <Card key={workflow.type} className="border border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{workflow.title}</CardTitle>
              <CardDescription>{workflow.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{workflow.preview}</p>
              <Button
                onClick={() => openWorkflow(workflow.type)}
                variant={isPremium ? "default" : "outline"}
                className="w-full"
              >
                {isPremium ? "Open Workflow" : "Preview & Unlock"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{workflowMeta?.title || "Expert Mode"}</DialogTitle>
            <DialogDescription>
              {workflowMeta?.description || formatWorkflowType(activeWorkflow || "full_resume_rewrite")}
            </DialogDescription>
          </DialogHeader>

          {!result && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {workflowMeta?.preview}
              </p>
              {lockedMessage && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm text-amber-900">{lockedMessage}</p>
                    <Button
                      className="w-full"
                      onClick={() => {
                        posthog.capture("upgrade_clicked_from_expert", {
                          workflow_type: activeWorkflow,
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
              {!lockedMessage && (
                <Button onClick={runWorkflow} disabled={loading} className="w-full">
                  {loading ? "Running workflow..." : "Run Expert Workflow"}
                </Button>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={result.status === "completed" ? "default" : "secondary"}>
                  {result.status.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">Run ID: {result.run_id}</span>
              </div>

              {result.missing_evidence.length > 0 && (
                <Card className="border-orange-300 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Missing Evidence Needed</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.missing_evidence.map((item, index) => (
                      <p key={`${item}-${index}`} className="text-sm text-orange-900">
                        • {item}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {summaryOptions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Summary Options</p>
                  {summaryOptions.map((option, index) => (
                    <label
                      key={`summary-option-${index}`}
                      className="block rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          name="summary-option"
                          checked={selectionIndex === index}
                          onChange={() => setSelectionIndex(index)}
                        />
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {String(option.angle || "option")}
                        </span>
                      </div>
                      <p className="text-sm">{String(option.summary || "")}</p>
                    </label>
                  ))}
                </div>
              ) : (
                <pre className="max-h-[320px] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(result.output, null, 2)}
                </pre>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <DialogFooter>
            {result ? (
              <Button onClick={applyResult} disabled={applying}>
                {applying ? "Applying..." : "Apply to Resume"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
