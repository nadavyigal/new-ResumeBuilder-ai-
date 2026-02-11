"use client";

import { useEffect, useState } from "react";
import { Link } from "@/navigation";
import { Search, ArrowLeft, Briefcase, FileText } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApplicationCard } from "@/components/mobile/application-card";
import { useTranslations } from "next-intl";

// Helper function to clean job titles (remove company name and LinkedIn suffix)
function cleanJobTitle(title: string): string {
  if (!title) return title;
  // Remove LinkedIn suffix pattern: "| LinkedIn"
  let cleaned = title.replace(/\|\s*LinkedIn.*$/i, "").trim();
  // Remove company hiring prefix pattern: "Company hiring JobTitle in Location"
  const hiringMatch = cleaned.match(/^.+?\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
  if (hiringMatch && hiringMatch[1]) {
    cleaned = hiringMatch[1].trim();
  }
  return cleaned;
}

// Helper function to detect if URL has easy apply
function hasEasyApply(url: string | null | undefined, applicationInstructions: string[] | null | undefined): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  // Check if URL contains easy apply indicators
  if (lowerUrl.includes("easyapply") || lowerUrl.includes("easy-apply") || lowerUrl.includes("easy_apply")) {
    return true;
  }
  // Check if application instructions indicate easy apply
  if (applicationInstructions && applicationInstructions.length > 0) {
    return true;
  }
  return false;
}

interface ApplicationItem {
  id: string;
  job_title: string;
  company_name: string;
  applied_date: string;
  apply_clicked_at?: string | null;
  ats_score: number | null;
  contact?: { name?: string; email?: string; phone?: string } | null;
  resume_html_path?: string | null;
  optimized_resume_url?: string | null;
  source_url?: string | null;
  optimization_id?: string | null;
  job_extraction?: {
    company_name?: string | null;
    job_title?: string | null;
    application_instructions?: string[] | null;
  } | null;
}

export default function ApplicationsPage() {
  const t = useTranslations("dashboard.applications");
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [createUrl, setCreateUrl] = useState("");

  const load = async () => {
    setLoading(true);
    const url = new URL(`/api/v1/applications`, window.location.origin);
    if (q) url.searchParams.set("q", q);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setItems(data.applications || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createFromUrl = async () => {
    if (!createUrl.trim()) return;

    try {
      const res = await fetch("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: createUrl.trim() })
      });

      if (res.ok) {
        setCreateUrl("");
        await load();
        // Show success feedback
        alert(t("alerts.addSuccess"));
      } else {
        const errorData = await res.json().catch(() => ({ error: t("alerts.addFailureFallback") }));
        alert(t("alerts.addFailure", { error: errorData.error || t("alerts.addFailureFallback") }));
      }
    } catch (error) {
      console.error("Error adding job from URL:", error);
      alert(t("alerts.addNetworkFailure"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sticky Header */}
      <div className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b-2 border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/dashboard" className="touch-target">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("total", { count: items.length })}</p>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("search.placeholderMobile")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="ps-10 h-11 bg-muted/80 border-2 border-border/70"
            />
          </div>
          {/* Add Job URL Input */}
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder={t("addUrl.placeholderMobile")}
              value={createUrl}
              onChange={(e) => setCreateUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFromUrl()}
              className="h-11 bg-muted/80 border-2 border-border/70 focus:border-mobile-cta transition-colors"
            />
            <Button
              onClick={createFromUrl}
              disabled={!createUrl.trim()}
              className="h-11 px-6 bg-mobile-cta hover:bg-mobile-cta-hover text-white disabled:opacity-50"
            >
              {t("addUrl.addButton")}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block p-6">
        <div className="mb-4">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            {t("navigation.backToDashboard")}
          </Link>
        </div>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Input
                placeholder={t("search.placeholderDesktop")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-muted/80 border-2 border-border/70"
              />
              <Button onClick={load} disabled={loading}>{t("search.button")}</Button>
            </div>
            {/* Add Job URL Input */}
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder={t("addUrl.placeholderDesktop")}
                value={createUrl}
                onChange={(e) => setCreateUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFromUrl()}
                className="border-2 border-border/70 bg-muted/80 focus:border-mobile-cta transition-colors"
              />
              <Button
                onClick={createFromUrl}
                disabled={!createUrl.trim()}
                className="bg-mobile-cta hover:bg-mobile-cta-hover text-white"
              >
                {t("addUrl.addJobButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden px-4 pb-24">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                  <div className="w-16 h-16 bg-muted rounded-xl" />
                </div>
                <div className="mt-3 h-8 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : items.length == 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Briefcase className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t("empty.title")}</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {t("empty.description")}
            </p>
            <Button asChild className="bg-mobile-cta hover:bg-mobile-cta-hover">
              <Link href="/dashboard/resume">{t("empty.cta")}</Link>
            </Button>
          </div>
        ) : (
          items.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onMarkApplied={load}
            />
          ))
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block px-6 pb-6">
        {loading ? (
          <div>{t("loading")}</div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-start border-b">
                      <th className="py-3">{t("table.headers.resume")}</th>
                      <th className="py-3">{t("table.headers.company")}</th>
                      <th className="py-3">{t("table.headers.jobTitle")}</th>
                      <th className="py-3">{t("table.headers.appliedDate")}</th>
                      <th className="py-3">{t("table.headers.atsScore")}</th>
                      <th className="py-3">{t("table.headers.easyApply")}</th>
                      <th className="py-3">{t("table.headers.jobUrl")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b">
                        <td className="py-3">
                          {it.optimization_id ? (
                            <Link href={`/dashboard/optimizations/${it.optimization_id}`} className="underline">{t("table.resumeLink")}</Link>
                          ) : (it.optimized_resume_url ? <a href={it.optimized_resume_url} target="_blank" className="underline">{t("table.openOptimized")}</a> : '-')}
                        </td>
                        <td className="py-3">{it.job_extraction?.company_name || it.company_name || '-'}</td>
                        <td className="py-3">{cleanJobTitle(it.job_extraction?.job_title || it.job_title)}</td>
                        <td className="py-3">
                          {it.apply_clicked_at ? new Date(it.apply_clicked_at).toLocaleDateString() : new Date(it.applied_date).toLocaleDateString()}
                          <span className="ms-2"><MarkAppliedButton id={it.id} onDone={load} /></span>
                        </td>
                        <td className="py-3">{it.ats_score != null ? Math.round(it.ats_score) : '-'}</td>
                        <td className="py-3">
                          {it.source_url ? (
                            <a
                              href={it.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors"
                            >
                              {t("table.applyButton")}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3">{it.source_url ? <a href={it.source_url} target="_blank" className="underline">{t("table.jobUrlLabel")}</a> : '-'}</td>
                      </tr>
                    ))}
                    {items.length == 0 && (
                      <tr>
                        <td className="py-6 text-muted-foreground" colSpan={8}>{t("table.empty")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function OpenResumeButton({ id }: { id: string }) {
  const t = useTranslations("dashboard.applications");
  const [loading, setLoading] = useState(false);
  const onOpen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/applications/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.htmlUrl) window.open(data.htmlUrl, "_blank");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" onClick={onOpen} disabled={loading}>
      {loading ? t("actions.opening") : t("actions.openResume")}
    </Button>
  );
}

function OpenOptimizedButton({ id, fallbackHtml }: { id: string; fallbackHtml?: boolean }) {
  const t = useTranslations("dashboard.applications");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const onOpen = async () => {
    setLoading(true);
    try {
      // Try open optimized resume first via details
      const res = await fetch(`/api/v1/applications/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.application?.optimized_resume_url) {
          window.open(data.application.optimized_resume_url, "_blank");
          return;
        }
        if (fallbackHtml && data.htmlUrl) {
          window.open(data.htmlUrl, "_blank");
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" onClick={onOpen} disabled={loading}>
      {loading ? t("actions.opening") : t("actions.openOptimized")}
    </Button>
  );
}

function OpenOptimizedCircle({ id, optimizationId }: { id: string; optimizationId: string | null }) {
  const t = useTranslations("dashboard.applications");
  const [loading, setLoading] = useState(false);
  const onOpen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/applications/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.application?.optimized_resume_url) {
          window.open(data.application.optimized_resume_url, "_blank");
          return;
        }
        if (data.htmlUrl) {
          window.open(data.htmlUrl, "_blank");
          return;
        }
      }
      if (optimizationId) {
        window.location.href = `/dashboard/optimizations/${optimizationId}`;
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={onOpen}
      disabled={loading}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black text-white hover:opacity-90"
      title={t("actions.openOptimizedTitle")}
    >
      {loading ? "..." : ">"}
    </button>
  );
}

function MarkAppliedButton({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations("dashboard.applications");
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/applications/${id}/mark-applied`, { method: "POST" });
      if (res.ok) onDone();
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={loading}>
      {loading ? t("actions.marking") : t("actions.markApplied")}
    </Button>
  );
}
