"use client";

import { Lock, Sparkles } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/CountUp";
import { IssueCard } from "@/components/landing/IssueCard";
import { SocialShareButton } from "@/components/landing/SocialShareButton";
import { QuickWinsSection } from "@/components/ats/QuickWinsSection";
import type { ATSCheckerResponse } from "@/components/landing/FreeATSChecker";
import type { QuickWinSuggestion } from "@/lib/ats/types";

interface ATSScoreDisplayProps {
  data: ATSCheckerResponse;
  onSignup: () => void;
  checksRemainingLabel?: string | null;
}

export function ATSScoreDisplay({ data, onSignup, checksRemainingLabel }: ATSScoreDisplayProps) {
  const score = data.score.overall;
  const { preview } = data;

  return (
    <div data-testid="ats-score-display" className="space-y-6">
      <div className="text-center space-y-2">
        <div data-testid="ats-score" className="text-5xl font-bold text-foreground">
          <CountUp end={score} duration={2} />
          <span className="text-2xl text-foreground/60">/100</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/60 px-4 py-1 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-mobile-cta" />
          {score >= 85 ? "Strong ATS match" : score >= 70 ? "Good ATS match" : "Needs improvement"}
        </div>
        {checksRemainingLabel && (
          <div className="text-xs text-foreground/60">{checksRemainingLabel}</div>
        )}
      </div>

      <div data-testid="ats-issues-list" className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Top critical issues</h3>
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
                {preview.lockedCount} more issues to fix
              </h3>
              <p className="text-sm text-foreground/70 mb-4">
                Sign up free to unlock every issue and get AI-powered fixes.
              </p>
              <Button className="w-full" data-testid="signup-cta" onClick={onSignup}>
                Sign Up Free
              </Button>
            </Card>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <SocialShareButton platform="linkedin" score={score} />
        <SocialShareButton platform="twitter" score={score} />
      </div>
    </div>
  );
}
