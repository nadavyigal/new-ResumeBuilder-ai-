"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy } from "@/lib/icons";
import { useLocale, useTranslations } from "next-intl";

type ApplicationDetail = {
  id: string;
  job_title: string;
  company_name: string;
  applied_date: string;
  ats_score: number | null;
  contact: Record<string, unknown> | null;
  optimization_id?: string | null;
};

type SavedExpertReport = {
  id: string;
  application_id: string;
  run_id: string;
  workflow_type: string;
  report_title: string;
  report_summary: string;
  report_json: {
    headline?: string;
    executive_summary?: string;
    priority_actions?: string[];
    evidence_gaps?: string[];
    ats_impact_estimate?: {
      before?: number | null;
      after?: number | null;
      delta?: number | null;
      confidence_note?: string;
    };
  };
  asset_type: "cover_letter" | "screening_answers" | "outreach_kit" | "story_bank" | null;
  asset_json: Record<string, unknown> | null;
  ats_score_before: number | null;
  ats_score_after: number | null;
  ats_score_delta: number | null;
  saved_at: string;
};

function formatScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

function workflowLabel(t: ReturnType<typeof useTranslations>, workflowType: string): string {
  const key = `workflow.${workflowType}`;
  const value = t(key);
  return value === key ? workflowType.replace(/_/g, " ") : value;
}

function assetTypeLabel(
  t: ReturnType<typeof useTranslations>,
  assetType: SavedExpertReport["asset_type"]
): string {
  if (!assetType) return t("assets.unknown");
  const key = `assets.type.${assetType}`;
  const value = t(key);
  return value === key ? assetType.replace(/_/g, " ") : value;
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const t = useTranslations("dashboard.applications.detail");
  const locale = useLocale();
  const dateLocale = locale === "he" ? "he-IL" : "en-US";

  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [jsonUrl, setJsonUrl] = useState<string | null>(null);
  const [reports, setReports] = useState<SavedExpertReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [appRes, reportsRes] = await Promise.all([
          fetch(`/api/v1/applications/${params.id}`, { cache: "no-store" }),
          fetch(`/api/v1/applications/${params.id}/expert-reports`, { cache: "no-store" }),
        ]);

        const appPayload = await appRes.json().catch(() => ({}));
        const reportsPayload = await reportsRes.json().catch(() => ({}));

        if (!appRes.ok) {
          throw new Error(appPayload.error || t("loadError"));
        }

        setItem(appPayload.application);
        setHtmlUrl(appPayload.htmlUrl || null);
        setJsonUrl(appPayload.jsonUrl || null);

        if (reportsRes.ok && Array.isArray(reportsPayload.reports)) {
          setReports(reportsPayload.reports);
        } else {
          setReports([]);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      load();
    }
  }, [params.id, t]);

  const latestReport = useMemo(() => reports[0] || null, [reports]);
  const assetReports = useMemo(
    () => reports.filter((report) => report.asset_type && report.asset_json),
    [reports]
  );

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy asset text:", error);
    }
  };

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!item) return <div className="p-6">{t("notFound")}</div>;

  return (
    <div className="space-y-6 p-6">
      <Link href="/dashboard/applications" className="text-sm underline">
        {t("back")}
      </Link>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle className="text-2xl">{item.job_title}</CardTitle>
          <CardDescription>{item.company_name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("appliedDate", { date: new Date(item.applied_date).toLocaleString(dateLocale) })}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{t("cumulativeAts")}</Badge>
            <span className="text-lg font-semibold">{formatScore(item.ats_score)}</span>
          </div>

          {latestReport && latestReport.ats_score_delta !== null && (
            <p className="text-sm text-muted-foreground">
              {t("latestDelta", {
                delta:
                  latestReport.ats_score_delta > 0
                    ? `+${Math.round(latestReport.ats_score_delta)}`
                    : `${Math.round(latestReport.ats_score_delta)}`,
              })}
            </p>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            {htmlUrl && (
              <a href={htmlUrl} target="_blank" rel="noreferrer" className="underline">
                {t("downloadHtml")}
              </a>
            )}
            {jsonUrl && (
              <a href={jsonUrl} target="_blank" rel="noreferrer" className="underline">
                {t("downloadJson")}
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>{t("reports.title")}</CardTitle>
          <CardDescription>{t("reports.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("reports.empty")}</p>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => {
                const priorityActions = Array.isArray(report.report_json?.priority_actions)
                  ? report.report_json.priority_actions
                  : [];
                const evidenceGaps = Array.isArray(report.report_json?.evidence_gaps)
                  ? report.report_json.evidence_gaps
                  : [];

                return (
                  <Card key={report.id} className="border border-border/60 bg-muted/20">
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {report.report_title || t("reports.fallbackTitle")}
                          </CardTitle>
                          <CardDescription>{workflowLabel(t, report.workflow_type)}</CardDescription>
                        </div>
                        <Badge variant="outline">
                          {new Date(report.saved_at).toLocaleDateString(dateLocale)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{report.report_summary}</p>

                      <div className="rounded-md border border-border/70 bg-background/70 p-3 text-sm">
                        <p>
                          {t("reports.atsImpact")}: {formatScore(report.ats_score_before)} -{" "}
                          {formatScore(report.ats_score_after)}
                          {report.ats_score_delta !== null
                            ? ` (${report.ats_score_delta > 0 ? "+" : ""}${Math.round(
                                report.ats_score_delta
                              )}%)`
                            : ""}
                        </p>
                      </div>

                      <details className="rounded-md border border-border/60 bg-background p-3 text-sm">
                        <summary className="cursor-pointer font-medium">{t("reports.expand")}</summary>
                        <div className="mt-3 space-y-3">
                          {priorityActions.length > 0 && (
                            <div>
                              <p className="mb-2 font-semibold">{t("reports.priorityActions")}</p>
                              <ul className="space-y-1">
                                {priorityActions.map((action, idx) => (
                                  <li key={`${report.id}-action-${idx}`} className="text-muted-foreground">
                                    - {action}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {evidenceGaps.length > 0 && (
                            <div>
                              <p className="mb-2 font-semibold">{t("reports.evidenceGaps")}</p>
                              <ul className="space-y-1">
                                {evidenceGaps.map((gap, idx) => (
                                  <li key={`${report.id}-gap-${idx}`} className="text-muted-foreground">
                                    - {gap}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>{t("assets.title")}</CardTitle>
          <CardDescription>{t("assets.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {assetReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("assets.empty")}</p>
          ) : (
            <div className="space-y-4">
              {assetReports.map((report) => {
                const assetJson =
                  report.asset_json && typeof report.asset_json === "object"
                    ? (report.asset_json as Record<string, unknown>)
                    : {};

                const coverLetter =
                  report.asset_type === "cover_letter" &&
                  assetJson.selected_variant &&
                  typeof assetJson.selected_variant === "object"
                    ? (assetJson.selected_variant as Record<string, unknown>)
                    : null;

                const screeningAnswers =
                  report.asset_type === "screening_answers" &&
                  Array.isArray(assetJson.selected_answers)
                    ? (assetJson.selected_answers as Array<Record<string, unknown>>)
                    : [];

                return (
                  <Card key={`asset-${report.id}`} className="border border-border/60 bg-muted/20">
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {report.report_title || t("reports.fallbackTitle")}
                          </CardTitle>
                          <CardDescription>{assetTypeLabel(t, report.asset_type)}</CardDescription>
                        </div>
                        <Badge variant="outline">
                          {new Date(report.saved_at).toLocaleDateString(dateLocale)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {report.asset_type === "cover_letter" && coverLetter && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{t("assets.coverLetter")}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyText(String(coverLetter.letter || ""))}
                            >
                              <Copy className="mr-1 h-4 w-4" />
                              {t("assets.copy")}
                            </Button>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {String(coverLetter.letter || "")}
                          </p>
                        </div>
                      )}

                      {report.asset_type === "screening_answers" && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{t("assets.screeningAnswers")}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                copyText(
                                  screeningAnswers
                                    .map(
                                      (answer) =>
                                        `Q: ${String(answer.question || "")}\nA: ${String(answer.answer || "")}`
                                    )
                                    .join("\n\n")
                                )
                              }
                            >
                              <Copy className="mr-1 h-4 w-4" />
                              {t("assets.copy")}
                            </Button>
                          </div>
                          {screeningAnswers.map((answer, index) => (
                            <details
                              key={`asset-answer-${report.id}-${index}`}
                              className="rounded-md border border-border/60 bg-background p-3"
                            >
                              <summary className="cursor-pointer font-medium">
                                {String(answer.question || t("assets.unknownQuestion"))}
                              </summary>
                              <p className="mt-2 leading-relaxed">{String(answer.answer || "")}</p>
                            </details>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {item.contact && (
        <Card>
          <CardHeader>
            <CardTitle>{t("contactTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-sm">
              {JSON.stringify(item.contact, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {htmlUrl && <iframe src={htmlUrl} className="h-[70vh] w-full rounded border" />}
    </div>
  );
}
