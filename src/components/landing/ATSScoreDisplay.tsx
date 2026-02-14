"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Sparkles } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/CountUp";
import { IssueCard } from "@/components/landing/IssueCard";
import { SocialShareButton } from "@/components/landing/SocialShareButton";
import { ContextualSignupPopup } from "@/components/landing/ContextualSignupPopup";
import { QuickWinsSection } from "@/components/ats/QuickWinsSection";
import { MainIssuesSummary } from "@/components/ats/MainIssuesSummary";
import type { ATSCheckerResponse } from "@/components/landing/FreeATSChecker";
import type { QuickWinSuggestion } from "@/lib/ats/types";
import { posthog } from "@/lib/posthog";

const POPUP_DISMISS_KEY = "resumely_signup_popup_dismissed_at";
const POPUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface ATSScoreDisplayProps {
  data: ATSCheckerResponse;
  onSignup: () => void;
  onCheckAnother?: () => void;
  checksRemainingLabel?: string | null;
}

export function ATSScoreDisplay({ data, onSignup, onCheckAnother, checksRemainingLabel }: ATSScoreDisplayProps) {
  const [showPopup, setShowPopup] = useState(false);
  const score = data.score.overall;
  const { preview } = data;
  const t = useTranslations("landing.score");
  const continueHandler = preview.lockedCount > 0 ? onSignup : undefined;

  const matchLabel =
    score >= 85 ? t("match.strong") : score >= 70 ? t("match.good") : t("match.needsImprovement");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (preview.lockedCount <= 0) return;

    const lastDismissedRaw = localStorage.getItem(POPUP_DISMISS_KEY);
    const lastDismissed = lastDismissedRaw ? Number(lastDismissedRaw) : 0;
    const isSuppressed = Number.isFinite(lastDismissed) && Date.now() - lastDismissed < POPUP_WINDOW_MS;
    if (isSuppressed) return;

    const timer = window.setTimeout(() => {
      setShowPopup(true);
      posthog.capture("signup_popup_viewed", {
        source: "ats-score-display",
        score
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [preview.lockedCount, score]);

  const handlePopupState = (nextOpen: boolean) => {
    setShowPopup(nextOpen);
    if (!nextOpen && typeof window !== "undefined") {
      localStorage.setItem(POPUP_DISMISS_KEY, String(Date.now()));
      posthog.capture("signup_popup_dismissed", {
        source: "ats-score-display",
        score
      });
    }
  };

  const handlePrimaryPopupAction = () => {
    posthog.capture("signup_popup_primary_clicked", {
      source: "ats-score-display",
      score
    });
    onSignup();
    handlePopupState(false);
  };

  return (
    <div data-testid="ats-score-display" className="space-y-6">
      <div className="text-center space-y-2">
        <div data-testid="ats-score" className="text-5xl font-bold text-foreground">
          <CountUp end={score} duration={2} />
          <span className="text-2xl text-foreground/60">/100</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/60 px-4 py-1 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-mobile-cta" />
          {matchLabel}
        </div>
        {checksRemainingLabel && (
          <div className="text-xs text-foreground/60">{checksRemainingLabel}</div>
        )}
      </div>

      <MainIssuesSummary
        items={preview.topIssues}
        baseKey="landing.score.mainIssues"
        onContinue={continueHandler}
      />

      <div data-testid="ats-issues-list" className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">{t("topIssues")}</h3>
        {preview.topIssues.map((issue, index) => (
          <IssueCard key={issue.id || index} issue={issue} rank={index + 1} />
        ))}
      </div>

      {/* Quick Wins Section */}
      {data.quickWins && data.quickWins.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <QuickWinsSection quickWins={data.quickWins as QuickWinSuggestion[]} />
        </div>
      )}

      {preview.lockedCount > 0 && (
        <div className="relative">
          <div
            data-testid="locked-issues-blur"
            className="space-y-2 blur-sm opacity-60 pointer-events-none"
          >
            {Array.from({ length: Math.max(3, preview.lockedCount) }).map((_, index) => (
              <div key={index} className="h-16 rounded-2xl border border-border bg-muted" />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl">
            <Card className="p-6 text-center max-w-sm">
              <Lock className="mx-auto h-10 w-10 mb-3 text-foreground" />
              <h3 className="text-lg font-bold mb-2">
                {t("lockedTitle", { count: preview.lockedCount })}
              </h3>
              <p className="text-sm text-foreground/70 mb-4">
                {t("lockedDescription")}
              </p>
              <Button className="w-full" data-testid="signup-cta" onClick={onSignup}>
                {t("lockedCta")}
              </Button>
            </Card>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <SocialShareButton platform="linkedin" score={score} />
        <SocialShareButton platform="twitter" score={score} />
        {onCheckAnother && (
          <Button variant="outline" onClick={onCheckAnother}>
            {t("checkAnother")}
          </Button>
        )}
      </div>
      <ContextualSignupPopup
        open={showPopup}
        onOpenChange={handlePopupState}
        onPrimaryAction={handlePrimaryPopupAction}
      />
    </div>
  );
}
