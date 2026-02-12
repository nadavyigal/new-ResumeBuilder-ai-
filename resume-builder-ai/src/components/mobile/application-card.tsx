"use client";

import { useState } from "react";
import { Link } from "@/navigation";
import { Calendar, ExternalLink, Briefcase, TrendingUp } from "@/lib/icons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

// Helper function to clean job titles (remove company name and LinkedIn suffix)
function cleanJobTitle(title: string): string {
  if (!title) return title;
  let cleaned = title.replace(/\|\s*LinkedIn.*$/i, "").trim();
  const hiringMatch = cleaned.match(/^.+?\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
  if (hiringMatch && hiringMatch[1]) {
    cleaned = hiringMatch[1].trim();
  }
  return cleaned;
}

// Get badge variant based on ATS score
function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" | "success" {
  if (score >= 90) return "default"; // High score - green
  if (score >= 80) return "secondary"; // Good score - blue
  if (score >= 70) return "outline"; // OK score - outline
  return "destructive"; // Low score - red
}

interface ApplicationCardProps {
  application: {
    id: string;
    job_title: string;
    company_name: string;
    applied_date: string;
    apply_clicked_at?: string | null;
    ats_score: number | null;
    source_url?: string | null;
    optimization_id?: string | null;
    job_extraction?: {
      company_name?: string | null;
      job_title?: string | null;
      application_instructions?: string[] | null;
    } | null;
  };
  onMarkApplied?: () => void;
}

export function ApplicationCard({ application, onMarkApplied }: ApplicationCardProps) {
  const t = useTranslations("dashboard.applications.card");
  const locale = useLocale();
  const dateLocale = locale === "he" ? "he-IL" : "en-US";
  const [markingApplied, setMarkingApplied] = useState(false);

  const handleMarkApplied = async () => {
    setMarkingApplied(true);
    try {
      const res = await fetch(`/api/v1/applications/${application.id}/mark-applied`, {
        method: "POST",
      });
      if (res.ok && onMarkApplied) {
        onMarkApplied();
      }
    } finally {
      setMarkingApplied(false);
    }
  };

  const displayDate = application.apply_clicked_at
    ? new Date(application.apply_clicked_at).toLocaleDateString(dateLocale)
    : new Date(application.applied_date).toLocaleDateString(dateLocale);

  const companyName = application.job_extraction?.company_name || application.company_name || t("unknownCompany");
  const jobTitle = cleanJobTitle(application.job_extraction?.job_title || application.job_title);

  return (
    <Card className="p-4 mb-3 hover:shadow-lg transition-all duration-300 border-2 border-border">
      <div className="space-y-3">
        {/* Header Row: Company & ATS Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
              <h3 className="font-bold text-base line-clamp-1">{companyName}</h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
              {jobTitle}
            </p>
          </div>

          {/* ATS Score Badge */}
          {application.ats_score !== null && (
            <div className="shrink-0">
              <div
                className={cn(
                  "flex flex-col items-center px-3 py-2 rounded-xl border-2",
                  application.ats_score >= 90
                    ? "bg-green-50 border-green-500 dark:bg-green-900/20"
                    : application.ats_score >= 80
                    ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                    : application.ats_score >= 70
                    ? "bg-yellow-50 border-yellow-500 dark:bg-yellow-900/20"
                    : "bg-red-50 border-red-500 dark:bg-red-900/20"
                )}
              >
                <TrendingUp className="w-4 h-4 mb-1" />
                <span className="text-lg font-bold leading-none">
                  {Math.round(application.ats_score)}
                </span>
                <span className="text-[10px] text-muted-foreground">{t("atsLabel")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Row: Date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>{t("appliedDate", { date: displayDate })}</span>
        </div>

        {/* Actions Row */}
        <div className="flex gap-2 pt-2">
          {/* View Resume Button */}
          {application.optimization_id ? (
            <Button
              asChild
              variant="default"
              className="flex-1 h-11 bg-mobile-cta hover:bg-mobile-cta-hover text-white border-0 font-medium"
            >
              <Link href={`/dashboard/optimizations/${application.optimization_id}`}>
                {t("viewResume")}
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={handleMarkApplied}
              disabled={markingApplied}
            >
              {markingApplied ? t("marking") : t("markApplied")}
            </Button>
          )}

          {/* External Job Link */}
          {application.source_url && (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              <a
                href={application.source_url}
                target="_blank"
                rel="noopener noreferrer"
                title={t("openJobPosting")}
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
