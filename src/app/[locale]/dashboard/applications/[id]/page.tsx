"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Target,
  PenLine,
  Mail,
  MessageSquare,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApplicationDetail {
  id: string;
  job_title: string;
  company_name: string;
  applied_date: string;
  ats_score: number | null;
  contact: any | null;
}

interface ExpertReportItem {
  id: string;
  run_id: string;
  workflow_type: string;
  report_title: string;
  report_summary: string;
  report_json: Record<string, unknown>;
  ats_score_before: number | null;
  ats_score_after: number | null;
  ats_score_delta: number | null;
  saved_at: string;
}

// ─── Workflow display helpers ─────────────────────────────────────────────────

const WORKFLOW_META: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    Icon: React.ComponentType<{ className?: string }>;
    category: "resume" | "document";
  }
> = {
  full_resume_rewrite: { label: "Strategic Rewrite", variant: "default", Icon: Sparkles, category: "resume" },
  achievement_quantifier: { label: "Impact Amplifier", variant: "secondary", Icon: TrendingUp, category: "resume" },
  ats_optimization_report: { label: "ATS Deep Scan", variant: "outline", Icon: Target, category: "resume" },
  professional_summary_lab: { label: "Summary Workshop", variant: "secondary", Icon: PenLine, category: "resume" },
  cover_letter_architect: { label: "Cover Letter", variant: "secondary", Icon: Mail, category: "document" },
  screening_answer_studio: { label: "Screening Answers", variant: "secondary", Icon: MessageSquare, category: "document" },
};

// ─── ExpertReportCard ─────────────────────────────────────────────────────────

function ExpertReportCard({
  report,
  dateLocale,
}: {
  report: ExpertReportItem;
  dateLocale: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = WORKFLOW_META[report.workflow_type] ?? {
    label: report.workflow_type.replace(/_/g, " "),
    variant: "secondary" as const,
    Icon: Target,
    category: "resume" as const,
  };
  const delta = report.ats_score_delta;
  const reportData = (report.report_json || {}) as any;

  const headline =
    reportData.headline ||
    report.report_title ||
    meta.label;

  return (
    <Card className="border border-border/70">
      <CardContent className="pt-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <meta.Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  meta.category === "resume"
                    ? "text-green-600 dark:text-green-400"
                    : "text-blue-500 dark:text-blue-400"
                )}
              />
              <Badge variant={meta.variant} className="text-xs">
                {meta.label}
              </Badge>
            </div>
            <p className="font-semibold text-sm leading-snug">{headline}</p>
            <p className="text-xs text-muted-foreground">
              Saved {new Date(report.saved_at).toLocaleDateString(dateLocale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          {/* ATS delta */}
          {delta !== null && (
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <span className="text-xs text-muted-foreground">ATS:</span>
              {report.ats_score_before !== null && (
                <span className="text-xs font-medium">
                  {Math.round(report.ats_score_before)}
                </span>
              )}
              {report.ats_score_before !== null && report.ats_score_after !== null && (
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              )}
              {report.ats_score_after !== null && (
                <span className="text-xs font-semibold">
                  {Math.round(report.ats_score_after)}
                </span>
              )}
              <Badge
                variant={delta > 0 ? "default" : delta < 0 ? "destructive" : "secondary"}
                className="text-xs"
              >
                {delta > 0 ? "+" : ""}
                {Math.round(delta)} pts
              </Badge>
            </div>
          )}
        </div>

        {/* Summary excerpt */}
        {(report.report_summary || reportData.executive_summary) && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {report.report_summary || reportData.executive_summary}
          </p>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              View full report
            </>
          )}
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="space-y-3 border-t pt-3">
            {/* Executive summary (full) */}
            {reportData.executive_summary && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                  {reportData.executive_summary}
                </p>
              </div>
            )}

            {/* Priority Actions */}
            {Array.isArray(reportData.priority_actions) &&
              reportData.priority_actions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Priority Actions
                  </p>
                  <ul className="space-y-1.5">
                    {(reportData.priority_actions as string[]).map((action: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Evidence Gaps */}
            {Array.isArray(reportData.evidence_gaps) &&
              reportData.evidence_gaps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Information Gaps
                  </p>
                  <ul className="space-y-1.5">
                    {(reportData.evidence_gaps as string[]).map((gap: string, i: number) => (
                      <li
                        key={i}
                        className="flex gap-2 text-sm text-amber-800 dark:text-amber-300"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const params = useParams();
  const t = useTranslations("dashboard.applications.detail");
  const locale = useLocale();
  const dateLocale = locale === "he" ? "he-IL" : "en-US";

  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [jsonUrl, setJsonUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [expertReports, setExpertReports] = useState<ExpertReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setReportsLoading(true);
      setReportsError(null);

      // Parallel fetch
      const [appRes, reportsRes] = await Promise.all([
        fetch(`/api/v1/applications/${params.id}`, { cache: "no-store" }),
        fetch(`/api/v1/applications/${params.id}/expert-reports`, { cache: "no-store" }),
      ]);

      if (appRes.ok) {
        const data = await appRes.json();
        setItem(data.application);
        setHtmlUrl(data.htmlUrl);
        setJsonUrl(data.jsonUrl);
      }
      setLoading(false);

      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setExpertReports(data.reports || []);
      } else {
        const errData = await reportsRes.json().catch(() => ({}));
        setReportsError(errData.error || "Failed to load expert reports.");
      }
      setReportsLoading(false);
    };
    if (params.id) load();
  }, [params.id]);

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (!item) return <div className="p-6">{t("notFound")}</div>;

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard/applications" className="text-sm underline">
        {t("back")}
      </Link>

      {/* Application summary */}
      <div>
        <div className="text-xl font-semibold">{item.job_title}</div>
        <div className="text-muted-foreground">{item.company_name}</div>
        <div className="text-xs text-muted-foreground">
          {t("appliedDate", {
            date: new Date(item.applied_date).toLocaleString(dateLocale),
          })}
        </div>
        {item.ats_score !== null && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
            <span className="text-sm font-medium text-green-900 dark:text-green-100">
              {t("atsMatchLabel")}
            </span>
            <span className="text-sm font-bold text-green-700 dark:text-green-300">
              {item.ats_score}%
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {htmlUrl && (
          <a href={htmlUrl} target="_blank" rel="noreferrer" className="underline text-sm">
            {t("downloadHtml")}
          </a>
        )}
        {jsonUrl && (
          <a href={jsonUrl} target="_blank" rel="noreferrer" className="underline text-sm">
            {t("downloadJson")}
          </a>
        )}
      </div>

      {item.contact && (
        <pre className="bg-muted p-3 rounded text-sm overflow-auto max-h-80">
          {JSON.stringify(item.contact, null, 2)}
        </pre>
      )}

      {/* ── Expert Analysis Reports ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Expert Analysis Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI workflow reports saved from the optimization page.
          </p>
        </div>

        {reportsLoading ? (
          <p className="text-sm text-muted-foreground">Loading reports…</p>
        ) : reportsError ? (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-red-700 dark:text-red-300">{reportsError}</p>
            </CardContent>
          </Card>
        ) : expertReports.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                No expert reports saved yet. Run an Expert Mode from the optimization
                page, apply it to your resume, then save the report here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {expertReports.map((report) => (
              <ExpertReportCard
                key={report.id}
                report={report}
                dateLocale={dateLocale}
              />
            ))}
          </div>
        )}
      </div>

      {/* Resume HTML preview */}
      {htmlUrl && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Resume Snapshot</h2>
          <iframe src={htmlUrl} className="w-full h-[70vh] border rounded" />
        </div>
      )}
    </div>
  );
}
