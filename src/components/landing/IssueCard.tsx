import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ATSIssue } from "@/components/landing/FreeATSChecker";
import { localizeIssueText } from "@/lib/ats/suggestions/localize-issue-text";

interface IssueCardProps {
  issue: ATSIssue;
  rank: number;
}

export function IssueCard({ issue, rank }: IssueCardProps) {
  const t = useTranslations("landing.issueCard");
  const tIssueText = useTranslations("landing.issueCard.issueText");
  const locale = useLocale();
  // The API sends English text (iOS reads it as-is); other locales re-render it here.
  const issueText = locale === "en" ? issue.text : localizeIssueText(issue, tIssueText);
  const categoryKey = issue.category?.trim().toLowerCase();
  const categoryLabel =
    categoryKey && t.has(`categories.${categoryKey}`) ? t(`categories.${categoryKey}`) : issue.category;

  return (
    <div
      data-testid="issue-card"
      className="rounded-2xl border border-border bg-background px-4 py-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-mobile-cta/10 text-mobile-cta flex items-center justify-center font-semibold">
          {rank}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p dir="auto" className="break-words text-sm font-medium text-foreground">{issueText}</p>
          <div className="flex flex-wrap items-center gap-2">
            {categoryLabel && (
              <Badge variant="secondary" className="text-xs">
                {categoryLabel}
              </Badge>
            )}
            {typeof issue.estimated_gain === "number" && (
              <Badge variant="outline" className="text-xs">
                {t("points", { points: Math.round(issue.estimated_gain * 10) / 10 })}
              </Badge>
            )}
            {issue.quick_win && (
              <Badge variant="secondary" className="text-xs">
                {t("quickWin")}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}