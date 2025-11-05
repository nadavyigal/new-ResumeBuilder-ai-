import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { HistoryStore } from "@/lib/agent/tools/history-store";
import { safeParseOptimizedResume } from "@/lib/agent/validators";
import type { LanguageDetection } from "@/lib/agent/types";
import { recordTelemetryEvent } from "@/lib/telemetry";

export const runtime = "nodejs";

export type HistoryAction = "undo" | "redo";

type ResumeVersionRecord = {
  id: string;
  user_id: string;
  resume_json: unknown;
  created_at: string;
};

async function fetchResumeVersion(
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>,
  userId: string,
  resumeVersionId: string
): Promise<ResumeVersionRecord | null> {
  const query = supabase
    .from("resume_versions")
    .select("id, user_id, resume_json, created_at")
    .eq("id", resumeVersionId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? "Failed to load resume version");
  }
  return (data as ResumeVersionRecord | null) ?? null;
}

function buildLanguage(value: any): LanguageDetection {
  if (value && typeof value === "object") {
    const lang = (value as LanguageDetection).lang ?? "en";
    const confidence = (value as LanguageDetection).confidence ?? 0;
    const rtl = (value as LanguageDetection).rtl ?? false;
    const source = (value as LanguageDetection).source;
    return { lang, confidence, rtl, source };
  }
  return { lang: "en", confidence: 0, rtl: false, source: "heuristic" };
}

export async function handleHistoryNavigation(action: HistoryAction) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transition =
    action === "undo" ? await HistoryStore.undo(user.id) : await HistoryStore.redo(user.id);

  if (!transition.current) {
    const message =
      action === "undo"
        ? "No previous history entry to restore"
        : "No future history entry to restore";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const version = await fetchResumeVersion(supabase, user.id, transition.current.resume_version_id);
    if (!version) {
      return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
    }

    const resumeJson = safeParseOptimizedResume(version.resume_json);
    const language = buildLanguage((resumeJson as any)?.language);

    const previewArtifact = Array.isArray(transition.current.artifacts)
      ? transition.current.artifacts.find((artifact: any) => artifact?.type === "pdf")
      : null;

    const atsScore = typeof transition.current.ats_score === "number" ? transition.current.ats_score : null;

    const timeline = HistoryStore.getTimeline(user.id);

    if (action === "undo") {
      await recordTelemetryEvent(supabase, {
        name: "undo_usage",
        userId: user.id,
        payload: {
          restored_entry_id: transition.current.id,
          undone_entry_id: transition.moved?.id ?? null,
          timeline: {
            past: timeline.past.length,
            future: timeline.future.length,
          },
          ats_score: atsScore,
          language: language.lang,
        },
      });
    }

    return NextResponse.json({
      resume_json: resumeJson,
      preview_url: previewArtifact?.path ?? null,
      after_scores: {
        ats: {
          score: atsScore,
          before: null,
          delta: null,
          missing_keywords: [],
          recommendations: [],
          languages: {},
        },
      },
      history_entry_id: transition.current.id,
      language,
      timeline: {
        past: timeline.past.map((entry) => entry.id),
        future: timeline.future.map((entry) => entry.id),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to restore history entry", message: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return handleHistoryNavigation("undo");
}
