import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { safeParseATSReport, safeParseOptimizedResume, ProposedChangeSchema } from "@/lib/agent/validators";
import { ResumeWriter } from "@/lib/agent/tools/resume-writer";
import { DesignOps } from "@/lib/agent/tools/design-ops";
import { LayoutEngine } from "@/lib/agent/tools/layout-engine";
import { ATS } from "@/lib/agent/tools/ats";
import { HistoryStore } from "@/lib/agent/tools/history-store";
import { Versioning } from "@/lib/agent/tools/versioning";
import { detectLanguage } from "@/lib/agent/utils/language";
import { extractResumeText } from "@/lib/ats";
import type { ThemeOptions } from "@/lib/agent/types";
import { getFallbackATS, getFallbackArtifacts } from "@/lib/agent/runtime/fallbacks";
import { recordTelemetryEvent } from "@/lib/telemetry";

const ThemeSchema = z
  .object({
    font_family: z.string().optional(),
    color_hex: z.string().optional(),
    spacing: z.string().optional(),
    density: z.enum(["compact", "cozy"]).optional(),
    layout: z.string().optional(),
    direction: z.enum(["ltr", "rtl"]).optional(),
  })
  .partial();

const ApplySchema = z.object({
  resume_json: z.any(),
  proposed_changes: z.array(ProposedChangeSchema).min(1, "proposed_changes must include at least one change"),
  job_text: z.string().optional(),
  design: ThemeSchema.optional(),
  baseline_scores: z
    .object({
      ats: z.number().min(0).max(100).nullable().optional(),
    })
    .optional(),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    const formatted = parsed.error.flatten();
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: formatted.fieldErrors,
      },
      { status: 400 }
    );
  }

  const { resume_json, proposed_changes, job_text, design, baseline_scores } = parsed.data;

  try {
    const originalResume = safeParseOptimizedResume(resume_json) as OptimizedResume;
    const appliedResume = ResumeWriter.applyProposedChanges(originalResume, proposed_changes);

    let resumeText = "";
    try {
      resumeText = extractResumeText(appliedResume as any);
    } catch {
      resumeText = JSON.stringify({ summary: appliedResume.summary ?? "" });
    }

    let language = { lang: "en", confidence: 0.5, rtl: false, source: "heuristic" as const };
    try {
      language = await detectLanguage(resumeText);
    } catch {
      // keep fallback language
    }

    const normalizedResume = safeParseOptimizedResume({
      ...(appliedResume as any),
      language,
    }) as OptimizedResume;

    const themeOptions: ThemeOptions = {
      ...(design ?? {}),
      language: language.lang,
      rtl: language.rtl,
    } as ThemeOptions;
    const theme = DesignOps.theme(themeOptions);

    let previewPath: string | undefined;
    try {
      const rendered = await LayoutEngine.render(normalizedResume, theme);
      previewPath = rendered.preview_pdf_path;
    } catch (error) {
      const fallback = getFallbackArtifacts();
      previewPath = fallback.preview_pdf_path ?? undefined;
    }

    let atsReport = safeParseATSReport(getFallbackATS());
    try {
      const scored = await ATS.score({ resume_json: normalizedResume as any, job_text });
      atsReport = safeParseATSReport(scored);
    } catch {
      atsReport = safeParseATSReport(getFallbackATS());
    }

    const beforeScore = baseline_scores?.ats ?? null;
    const afterScore = atsReport.score ?? 0;
    const delta = typeof beforeScore === "number" ? afterScore - beforeScore : null;

    const version = await Versioning.commit(user.id, normalizedResume as any);
    const history = await HistoryStore.save({
      user_id: user.id,
      resume_version_id: version.resume_version_id,
      ats_score: afterScore,
      artifacts: previewPath ? [{ type: "pdf", path: previewPath }] : [],
      proposed_changes,
    });

    const categoryCounts = proposed_changes.reduce<Record<string, number>>((acc, change) => {
      const category = change.category ?? "unknown";
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});

    const requiresReviewCount = proposed_changes.reduce(
      (count, change) => (change.requires_human_review ? count + 1 : count),
      0
    );

    const missingKeywords = atsReport.missing_keywords ?? [];

    await Promise.allSettled([
      recordTelemetryEvent(supabase, {
        name: "proposal_acceptance",
        userId: user.id,
        payload: {
          history_entry_id: history.id,
          resume_version_id: version.resume_version_id,
          proposed_change_count: proposed_changes.length,
          requires_review_count: requiresReviewCount,
          categories: categoryCounts,
          ats_after: afterScore,
          ats_before: beforeScore,
          ats_delta: delta,
        },
      }),
      recordTelemetryEvent(supabase, {
        name: "ats_delta",
        userId: user.id,
        payload: {
          before: beforeScore,
          after: afterScore,
          delta,
          missing_keyword_count: missingKeywords.length,
          top_missing_keywords: missingKeywords.slice(0, 5),
        },
      }),
      recordTelemetryEvent(supabase, {
        name: "language_distribution",
        userId: user.id,
        payload: {
          language: language.lang,
          confidence: language.confidence,
          rtl: language.rtl,
          source: language.source ?? "unknown",
        },
      }),
    ]);

    return NextResponse.json({
      resume_json: normalizedResume,
      preview_url: previewPath ?? null,
      after_scores: {
        ats: {
          score: afterScore,
          before: beforeScore,
          delta,
          missing_keywords: atsReport.missing_keywords ?? [],
          recommendations: atsReport.recommendations ?? [],
          languages: atsReport.languages ?? {},
        },
      },
      history_entry_id: history.id,
      language,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to apply changes", message: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

