"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { Sparkles, ShieldCheck } from "@/lib/icons";
import { posthog } from "@/lib/posthog";
import { ATS_CHECKER_EVENTS } from "@/lib/analytics/events";
import { UploadForm } from "@/components/landing/UploadForm";
import { LoadingState } from "@/components/landing/LoadingState";
import { ATSScoreDisplay } from "@/components/landing/ATSScoreDisplay";
import { RateLimitMessage } from "@/components/landing/RateLimitMessage";
import { Badge } from "@/components/ui/badge";

const SESSION_KEY = "ats_session_id";

type CheckerStep = "upload" | "processing" | "results" | "rate-limited";

export interface ATSIssue {
  id: string;
  text: string;
  estimated_gain?: number;
  category?: string;
  quick_win?: boolean;
  explanation?: string;
}

export interface ATSCheckerResponse {
  success: boolean;
  sessionId: string;
  score: {
    overall: number;
    timestamp: string;
  };
  preview: {
    topIssues: ATSIssue[];
    totalIssues: number;
    lockedCount: number;
  };
  quickWins?: Array<{
    id: string;
    original_text: string;
    optimized_text: string;
    improvement_type: string;
    estimated_impact: number;
    location: { section: string; subsection?: string };
    rationale: string;
    keywords_added: string[];
  }>;
  checksRemaining: number;
}

export function FreeATSChecker() {
  const [step, setStep] = useState<CheckerStep>("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ATSCheckerResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<Date | null>(null);
  const router = useRouter();
  const t = useTranslations("landing.atsChecker");

  const sanitizeUrlInput = (value: string) => {
    const cleaned = value
      .trim()
      // Strip directional marks or other invisible characters that can appear in mobile copy/paste.
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
    const match = cleaned.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|linkedin\.com\/[^\s<>"']+/i);
    if (!match) return cleaned;
    return match[0].replace(/[)\].,;:]+$/g, "");
  };

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSessionId(stored);
      return;
    }

    const freshId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, freshId);
    setSessionId(freshId);
  }, []);

  useEffect(() => {
    posthog.capture(ATS_CHECKER_EVENTS.VIEW);
  }, []);

  useEffect(() => {
    if (!scoreData) return;

    posthog.capture(ATS_CHECKER_EVENTS.SCORE_DISPLAYED, {
      score: scoreData.score.overall,
      totalIssues: scoreData.preview.totalIssues,
      sessionId: scoreData.sessionId,
    });
  }, [scoreData]);

  const checksRemainingLabel = useMemo(() => {
    if (!scoreData) return null;
    return t("checksRemaining", { count: scoreData.checksRemaining });
  }, [scoreData, t]);

  const handleFileSelected = (file: File) => {
    posthog.capture(ATS_CHECKER_EVENTS.FILE_UPLOADED, {
      fileSize: file.size,
      fileType: file.type || "unknown",
    });
  };

  const handleSubmit = async (
    file: File,
    input: { inputMode: "text" | "url"; jobDescription: string; jobDescriptionUrl: string }
  ) => {
    setErrorMessage(null);
    setStep("processing");

    const { inputMode, jobDescription, jobDescriptionUrl } = input;

    const activeSessionId = sessionId ?? crypto.randomUUID();
    if (!sessionId) {
      setSessionId(activeSessionId);
      localStorage.setItem(SESSION_KEY, activeSessionId);
    }

    let normalizedUrl = sanitizeUrlInput(jobDescriptionUrl);
    if (inputMode === "url" && normalizedUrl && !normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    posthog.capture(ATS_CHECKER_EVENTS.SUBMITTED, {
      sessionId: activeSessionId,
      input_mode: inputMode,
      jobDescriptionLength: inputMode === "text" ? jobDescription.length : 0,
      jobDescriptionUrlLength: inputMode === "url" ? normalizedUrl.length : 0,
    });

    const formData = new FormData();
    formData.append("resume", file);
    if (inputMode === "url") {
      formData.append("jobDescriptionUrl", normalizedUrl);
    } else {
      formData.append("jobDescription", jobDescription);
    }

    try {
      const response = await fetch("/api/public/ats-check", {
        method: "POST",
        headers: {
          "x-session-id": activeSessionId,
        },
        body: formData,
      });

      const payload = await response.json();

      if (response.status === 429) {
        posthog.capture(ATS_CHECKER_EVENTS.RATE_LIMITED, {
          checksUsed: 5,
          sessionId: activeSessionId,
        });
        setRateLimitResetAt(payload.resetAt ? new Date(payload.resetAt) : null);
        setStep("rate-limited");
        return;
      }

      if (!response.ok) {
        setErrorMessage(payload?.error || t("errors.generic"));
        setStep("upload");
        return;
      }

      const data = payload as ATSCheckerResponse;
      setScoreData(data);
      setSessionId(data.sessionId);
      localStorage.setItem(SESSION_KEY, data.sessionId);
      setStep("results");
    } catch (error) {
      console.error("ATS check failed:", error);
      setErrorMessage(t("errors.connection"));
      setStep("upload");
    }
  };

  const handleSignup = () => {
    if (scoreData) {
      posthog.capture(ATS_CHECKER_EVENTS.SIGNUP_CLICKED, {
        score: scoreData.score.overall,
        sessionId: scoreData.sessionId,
      });
    }

    router.push("/auth/signup");
  };

  return (
    <section
      data-testid="free-ats-checker"
      className="relative overflow-hidden bg-background pt-12 pb-16 md:pt-24 md:pb-32"
    >
      <div className="container px-4 mx-auto">
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
            <div className="space-y-6">
              <div
                data-testid="ats-checker-badge"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-mobile-cta/20 to-secondary/20 border-2 border-mobile-cta/30 backdrop-blur-sm"
              >
                <Sparkles className="w-4 h-4 text-mobile-cta" />
                <span className="text-sm font-semibold text-foreground">
                  {t("badge")}
                </span>
              </div>

              <div className="space-y-4">
                <h1
                  data-testid="ats-checker-heading"
                  className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.1] tracking-tight"
                >
                  {t("title")}
                </h1>
                <p className="text-lg md:text-xl text-foreground/70 leading-relaxed">
                  {t("description")}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {t("badges.atsSafe")}
                </Badge>
                <Badge variant="secondary">{t("badges.topFixes")}</Badge>
                <Badge variant="secondary">{t("badges.weeklyChecks")}</Badge>
              </div>

              <div className="space-y-3 text-sm text-foreground/70">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {t("bullets.v2Engine")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {t("bullets.hashPrivacy")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {t("bullets.unlockFixes")}
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-sm text-foreground/60">
                  {t("existingAccount")}{" "}
                  <Link
                    href="/auth/signin"
                    className="text-mobile-cta hover:underline font-semibold"
                  >
                    {t("loginLink")}
                  </Link>
                </p>
              </div>
            </div>

            <div className="rounded-3xl border-2 border-border bg-card p-6 md:p-8 shadow-2xl shadow-foreground/8">
              {step === "upload" && (
                <UploadForm
                  onSubmit={handleSubmit}
                  onFileSelected={handleFileSelected}
                  errorMessage={errorMessage}
                />
              )}
              {step === "processing" && <LoadingState />}
              {step === "results" && scoreData && (
                <ATSScoreDisplay
                  data={scoreData}
                  onSignup={handleSignup}
                  checksRemainingLabel={checksRemainingLabel}
                />
              )}
              {step === "rate-limited" && rateLimitResetAt && (
                <RateLimitMessage resetAt={rateLimitResetAt} />
              )}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
