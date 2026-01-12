"use client";

import { Link } from "@/navigation";
import { Calendar, ExternalLink, Briefcase, TrendingUp, FileText, Check } from "@/lib/icons";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OptimizationHistoryEntry } from "@/types/history";
import { useLocale, useTranslations } from "next-intl";

// Get badge variant based on ATS score
function getScoreBadgeVariant(score: number): { bg: string; border: string; text: string } {
  if (score >= 0.9) return { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-500", text: "text-green-700 dark:text-green-400" };
  if (score >= 0.8) return { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-500", text: "text-blue-700 dark:text-blue-400" };
  if (score >= 0.7) return { bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-500", text: "text-yellow-700 dark:text-yellow-400" };
  return { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-500", text: "text-red-700 dark:text-red-400" };
}

interface HistoryCardProps {
  optimization: OptimizationHistoryEntry;
  onApplyNow?: (optimization: OptimizationHistoryEntry) => void;
  isApplying?: boolean;
}

export function HistoryCard({ optimization, onApplyNow, isApplying = false }: HistoryCardProps) {
  const t = useTranslations("dashboard.history.card");
  const locale = useLocale();
  const dateLocale = locale === "he" ? "he-IL" : "en-US";
  const scoreColors = getScoreBadgeVariant(optimization.matchScore);
  const scorePercent = Math.round(optimization.matchScore * 100);
  const displayDate = new Date(optimization.createdAt).toLocaleDateString(dateLocale);

  const companyName = optimization.company || t("unknownCompany");
  const jobTitle = optimization.jobTitle || t("untitledPosition");

  const handleApplyNow = () => {
    if (onApplyNow && !isApplying) {
      onApplyNow(optimization);
    }
  };

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
          <div className="shrink-0">
            <div
              className={cn(
                "flex flex-col items-center px-3 py-2 rounded-xl border-2",
                scoreColors.bg,
                scoreColors.border
              )}
            >
              <TrendingUp className={cn("w-4 h-4 mb-1", scoreColors.text)} />
              <span className={cn("text-lg font-bold leading-none", scoreColors.text)}>
                {scorePercent}
              </span>
              <span className="text-[10px] text-muted-foreground">{t("atsLabel")}</span>
            </div>
          </div>
        </div>

        {/* Metadata Row: Date & Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{displayDate}</span>
          </div>

          {/* Applied Badge */}
          {optimization.hasApplication && (
            <Badge variant="secondary" className="flex items-center gap-1 h-5 px-2">
              <Check className="w-3 h-3" />
              <span className="text-xs">{t("applied")}</span>
            </Badge>
          )}

          {/* Template Badge */}
          {optimization.templateKey && (
            <Badge variant="outline" className="h-5 px-2 text-xs">
              {optimization.templateKey}
            </Badge>
          )}
        </div>

        {/* Actions Row */}
        <div className="flex gap-2 pt-2">
          {/* View/Download Resume Button */}
          <Button
            asChild
            variant="default"
            className="flex-1 h-11 bg-mobile-cta hover:bg-mobile-cta-hover text-white font-medium"
          >
            <Link href={`/dashboard/optimizations/${optimization.id}`}>
              <FileText className="w-4 h-4 mr-2" />
              {t("viewResume")}
            </Link>
          </Button>

          {/* Apply Now Button (only if not applied) */}
          {!optimization.hasApplication && optimization.jobUrl && (
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={handleApplyNow}
              disabled={isApplying}
            >
              {isApplying ? t("applying") : t("applyNow")}
            </Button>
          )}

          {/* External Job Link */}
          {optimization.jobUrl && (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              <a
                href={optimization.jobUrl}
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
