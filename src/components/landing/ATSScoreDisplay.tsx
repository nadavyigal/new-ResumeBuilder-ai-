"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/CountUp";
import { IssueCard } from "@/components/landing/IssueCard";
import { SocialShareButton } from "@/components/landing/SocialShareButton";
import { QuickWinsSection } from "@/components/ats/QuickWinsSection";
import { MainIssuesSummary } from "@/components/ats/MainIssuesSummary";
import type { ATSCheckerResponse } from "@/components/landing/FreeATSChecker";
import type { QuickWinSuggestion } from "@/lib/ats/types";

interface ATSScoreDisplayProps {
  data: ATSCheckerResponse;
  onSignup: () => void;
  onCheckAnother?: () => void;
  checksRemainingLabel?: string | null;
}

export function ATSScoreDisplay({ data, onSignup, onCheckAnother, checksRemainingLabel }: ATSScoreDisplayProps) {
  const score = data.score.overall;
  const { preview } = data;
  const t = useTranslations("landing.score");
  // G1c-1 (2026-10-15): nothing here asks for an account first. Every issue is
  // listed, and saving the check is an optional link at the end. A sign-up
  // modal used to open 900 ms after the score, over a list with 7 of 10 issues
  // locked (production, 2026-10-15).
  const issues = [...preview.topIssues, ...(preview.moreIssues ?? [])];
  const fitTone = data.fit?.verdict === "Strong"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    : data.fit?.verdict === "Stretch"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
      : "border-rose-500/30 bg-rose-500/10 text-rose-700";

  // One label, from one scale. The verdict comes from the calibrated fit bands
  // (src/lib/ats/config/bands.ts). A second label from fixed 85/70 cut-offs used
  // to sit under the score and could say "Needs improvement" under a "Strong"
  // verdict. When the verdict is withheld (thin job extraction), no label shows.
  const verdict = data.fit?.verdict ?? null;

  return (
    <div data-testid="ats-score-display" className="space-y-6">
      <div className="text-center space-y-2">
        {verdict && (
          <div
            data-testid="fit-verdict"
            className={`mx-auto mb-3 max-w-sm rounded-2xl border px-4 py-3 ${fitTone}`}
          >
            <div className="text-xs font-semibold text-foreground/60">
              {t("fit.label")}
            </div>
            <div className="text-2xl font-bold text-foreground">{t(`fit.verdicts.${verdict}`)}</div>
            <p className="mt-1 text-xs text-foreground/60">{t("fit.note")}</p>
          </div>
        )}
        <div data-testid="ats-score" className="text-5xl font-bold text-foreground">
          <CountUp end={score} duration={2} />
          <span className="text-2xl text-foreground/60">/100</span>
        </div>
        {checksRemainingLabel && (
          <div className="text-xs text-foreground/60">{checksRemainingLabel}</div>
        )}
        <p className="mx-auto max-w-xs text-xs text-foreground/50">{t("explainer")}</p>
      </div>

      <MainIssuesSummary
        items={preview.topIssues}
        baseKey="landing.score.mainIssues"
      />

      <div data-testid="ats-issues-list" className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">{t("topIssues")}</h3>
        {issues.map((issue, index) => (
          <IssueCard key={issue.id || index} issue={issue} rank={index + 1} />
        ))}
      </div>

      {/* Quick Wins Section */}
      {data.quickWins && data.quickWins.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <QuickWinsSection quickWins={data.quickWins as QuickWinSuggestion[]} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center space-y-2">
        <h3 className="text-base font-semibold text-foreground">{t("saveTitle")}</h3>
        <p className="text-sm text-foreground/70">{t("saveDescription")}</p>
        <Button variant="outline" data-testid="save-check-cta" onClick={onSignup}>
          {t("saveCta")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <SocialShareButton platform="linkedin" score={score} />
        <SocialShareButton platform="twitter" score={score} />
        {onCheckAnother && (
          <Button variant="outline" onClick={onCheckAnother}>
            {t("checkAnother")}
          </Button>
        )}
      </div>
    </div>
  );
}
