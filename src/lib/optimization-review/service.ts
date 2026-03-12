import type { OptimizedResume } from "@/lib/ai-optimizer";
import { captureServerEvent } from "@/lib/posthog-server";
import { scoreOptimization } from "@/lib/ats/integration";
import {
  buildATSPreview,
  buildFinalResumeMetadata,
  buildResumeFromApprovedGroups,
  createReviewChangeGroups,
} from "@/lib/optimization-review";
import {
  normalizeOptimizedResume,
  parseResumeToCanonical,
} from "@/lib/resume/canonicalize";
import type {
  OptimizationReviewRun,
  ReviewATSPreview,
  ReviewChangeGroup,
} from "@/types/optimization-review";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ATSScoreOutput } from "@/lib/ats/types";

type AppSupabaseClient = SupabaseClient<Database>;

interface EnsureCanonicalResumeParams {
  supabase: AppSupabaseClient;
  resumeId: string;
  rawText: string;
  existingCanonical?: unknown;
}

interface CreateReviewRunParams {
  supabase: AppSupabaseClient;
  userId: string;
  resumeId: string;
  jobDescriptionId: string;
  resumeRawText: string;
  jobDescriptionText: string;
  jobTitle?: string | null;
  optimizedResume: OptimizedResume;
}

interface ApplyReviewRunParams {
  supabase: AppSupabaseClient;
  userId: string;
  reviewRun: OptimizationReviewRun;
  approvedGroupIds: string[];
}

function parseReviewRun(row: Record<string, unknown>): OptimizationReviewRun {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    resume_id: String(row.resume_id),
    jd_id: String(row.jd_id),
    original_resume_json: normalizeOptimizedResume(row.original_resume_json),
    optimized_resume_json: normalizeOptimizedResume(row.optimized_resume_json),
    grouped_changes_json: Array.isArray(row.grouped_changes_json)
      ? (row.grouped_changes_json as ReviewChangeGroup[])
      : [],
    ats_preview_json: (row.ats_preview_json as ReviewATSPreview | null) || null,
    created_at: String(row.created_at),
    applied_at: row.applied_at ? String(row.applied_at) : null,
  };
}

export async function ensureCanonicalResume({
  supabase,
  resumeId,
  rawText,
  existingCanonical,
}: EnsureCanonicalResumeParams): Promise<OptimizedResume> {
  const normalizedExisting = normalizeOptimizedResume(existingCanonical);
  const hasMeaningfulExisting =
    normalizedExisting.summary ||
    normalizedExisting.contact.name ||
    normalizedExisting.experience.length > 0 ||
    normalizedExisting.education.length > 0;

  if (hasMeaningfulExisting) {
    return normalizedExisting;
  }

  const canonicalResume = await parseResumeToCanonical(rawText);

  await supabase
    .from("resumes")
    .update({ canonical_data: canonicalResume })
    .eq("id", resumeId);

  return canonicalResume;
}

export async function createOptimizationReviewRun({
  supabase,
  userId,
  resumeId,
  jobDescriptionId,
  resumeRawText,
  jobDescriptionText,
  jobTitle,
  optimizedResume,
}: CreateReviewRunParams): Promise<{ reviewId: string; reviewRun: OptimizationReviewRun }> {
  const { data: resumeRow } = await supabase
    .from("resumes")
    .select("canonical_data")
    .eq("id", resumeId)
    .maybeSingle();

  const originalResume = await ensureCanonicalResume({
    supabase,
    resumeId,
    rawText: resumeRawText,
    existingCanonical: resumeRow?.canonical_data,
  });

  const normalizedOptimizedResume = normalizeOptimizedResume(optimizedResume, originalResume);
  const groupedChanges = createReviewChangeGroups(originalResume, normalizedOptimizedResume);
  const atsPreview = await buildATSPreview(normalizedOptimizedResume, {
    jobDescriptionText,
    jobTitle,
    resumeOriginalText: resumeRawText,
  });

  const { data: inserted, error } = await supabase
    .from("optimization_review_runs")
    .insert({
      user_id: userId,
      resume_id: resumeId,
      jd_id: jobDescriptionId,
      original_resume_json: originalResume,
      optimized_resume_json: normalizedOptimizedResume,
      grouped_changes_json: groupedChanges,
      ats_preview_json: atsPreview,
    })
    .select("*")
    .maybeSingle();

  if (error || !inserted) {
    throw new Error(error?.message || "Failed to create optimization review run.");
  }

  await captureServerEvent(userId, "optimization_review_created", {
    review_id: inserted.id,
    resume_id: resumeId,
    job_description_id: jobDescriptionId,
    projected_ats_after: atsPreview?.after ?? null,
    grouped_changes: groupedChanges.length,
  });

  return {
    reviewId: inserted.id,
    reviewRun: parseReviewRun(inserted as Record<string, unknown>),
  };
}

function filterApprovedGroups(
  reviewRun: OptimizationReviewRun,
  approvedGroupIds: string[]
): ReviewChangeGroup[] {
  const selected = new Set(approvedGroupIds);
  return reviewRun.grouped_changes_json.filter((group) => selected.has(group.id));
}

function stringifyValue(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

export async function applyOptimizationReviewRun({
  supabase,
  userId,
  reviewRun,
  approvedGroupIds,
}: ApplyReviewRunParams): Promise<{
  optimizationId: string;
  approvedCount: number;
  rejectedCount: number;
  atsImpact: { before: number | null; after: number | null; delta: number | null };
}> {
  const approvedGroups = filterApprovedGroups(reviewRun, approvedGroupIds);
  if (approvedGroups.length === 0) {
    throw new Error("Select at least one change before continuing.");
  }
  if (reviewRun.applied_at) {
    throw new Error("This review has already been applied.");
  }

  const { data: resumeRow, error: resumeError } = await supabase
    .from("resumes")
    .select("raw_text")
    .eq("id", reviewRun.resume_id)
    .maybeSingle();
  if (resumeError || !resumeRow) {
    throw new Error("Original resume not found for this review.");
  }

  const { data: jdRow, error: jdError } = await supabase
    .from("job_descriptions")
    .select("raw_text, clean_text, title")
    .eq("id", reviewRun.jd_id)
    .maybeSingle();
  if (jdError || !jdRow) {
    throw new Error("Job description not found for this review.");
  }

  let finalResume = buildResumeFromApprovedGroups(reviewRun.original_resume_json, approvedGroups);

  let finalATSPreview: ReviewATSPreview | null = null;
  let finalATSResult: ATSScoreOutput | null = null;
  try {
    const atsResult = await scoreOptimization({
      resumeOriginalText: resumeRow.raw_text || "",
      resumeOptimizedJson: finalResume,
      jobDescriptionText: jdRow.clean_text || jdRow.raw_text || "",
      jobTitle: jdRow.title || "Position",
    });
    finalATSResult = atsResult;

    finalATSPreview = {
      before: atsResult.ats_score_original,
      after: atsResult.ats_score_optimized,
      delta: Number((atsResult.ats_score_optimized - atsResult.ats_score_original).toFixed(2)),
      confidence: atsResult.confidence,
      suggestions: atsResult.suggestions,
    };
  } catch (error) {
    console.error("Failed to score approved review selection:", error);
  }

  finalResume = normalizeOptimizedResume(finalResume, buildFinalResumeMetadata(approvedGroups, finalATSPreview));

  const { data: optimization, error: optimizationError } = await supabase
    .from("optimizations")
    .insert({
      user_id: userId,
      resume_id: reviewRun.resume_id,
      jd_id: reviewRun.jd_id,
      match_score: finalATSPreview?.after ?? reviewRun.ats_preview_json?.after ?? finalResume.matchScore,
      gaps_data: {
        keyImprovements: finalResume.keyImprovements,
        missingKeywords: finalResume.missingKeywords,
      },
      rewrite_data: finalResume,
      template_key: "natural",
      status: "completed",
      ats_version: 2,
      ats_score_original: finalATSPreview?.before ?? reviewRun.ats_preview_json?.before ?? null,
      ats_score_optimized: finalATSPreview?.after ?? reviewRun.ats_preview_json?.after ?? null,
      ats_subscores: finalATSResult?.subscores ?? null,
      ats_subscores_original: finalATSResult?.subscores_original ?? null,
      ats_suggestions: finalATSPreview?.suggestions ?? reviewRun.ats_preview_json?.suggestions ?? null,
      ats_confidence: finalATSPreview?.confidence ?? reviewRun.ats_preview_json?.confidence ?? null,
    })
    .select("id")
    .maybeSingle();

  if (optimizationError || !optimization) {
    throw new Error(optimizationError?.message || "Failed to save approved optimization.");
  }

  const { error: versionError } = await supabase.from("resume_versions").insert({
    optimization_id: optimization.id,
    session_id: null,
    version_number: 1,
    content: finalResume,
    change_summary: approvedGroups.map((group) => group.title).join("; "),
  });
  if (versionError) {
    throw new Error(versionError.message || "Failed to save the initial resume version.");
  }

  const modificationRecords = approvedGroups.flatMap((group) =>
    group.operations.map((operation) => ({
      user_id: userId,
      optimization_id: optimization.id,
      operation_type: operation.operation,
      field_path: operation.field_path,
      old_value: stringifyValue(operation.old_value),
      new_value: stringifyValue(operation.new_value),
      ats_score_before: finalATSPreview?.before ?? reviewRun.ats_preview_json?.before ?? null,
      ats_score_after: finalATSPreview?.after ?? reviewRun.ats_preview_json?.after ?? null,
      suggestion_text: group.title,
    }))
  );

  if (modificationRecords.length > 0) {
    const { error: modificationError } = await supabase
      .from("content_modifications")
      .insert(modificationRecords);
    if (modificationError) {
      throw new Error(modificationError.message || "Failed to save approved content modifications.");
    }
  }

  const { error: reviewUpdateError } = await supabase
    .from("optimization_review_runs")
    .update({ applied_at: new Date().toISOString() })
    .eq("id", reviewRun.id)
    .eq("user_id", userId);
  if (reviewUpdateError) {
    throw new Error(reviewUpdateError.message || "Failed to mark the review as applied.");
  }

  await captureServerEvent(userId, "optimization_completed", {
    optimization_id: optimization.id,
    review_id: reviewRun.id,
    ats_score_original: finalATSPreview?.before ?? reviewRun.ats_preview_json?.before ?? null,
    ats_score_optimized: finalATSPreview?.after ?? reviewRun.ats_preview_json?.after ?? null,
    improvement:
      (finalATSPreview?.after ?? reviewRun.ats_preview_json?.after ?? 0) -
      (finalATSPreview?.before ?? reviewRun.ats_preview_json?.before ?? 0),
    approved_groups: approvedGroups.length,
  });

  return {
    optimizationId: optimization.id,
    approvedCount: approvedGroups.length,
    rejectedCount: Math.max(reviewRun.grouped_changes_json.length - approvedGroups.length, 0),
    atsImpact: {
      before: finalATSPreview?.before ?? reviewRun.ats_preview_json?.before ?? null,
      after: finalATSPreview?.after ?? reviewRun.ats_preview_json?.after ?? null,
      delta:
        finalATSPreview?.delta ??
        reviewRun.ats_preview_json?.delta ??
        null,
    },
  };
}

export async function getOptimizationReviewRun(
  supabase: AppSupabaseClient,
  reviewId: string,
  userId: string
): Promise<OptimizationReviewRun | null> {
  const { data, error } = await supabase
    .from("optimization_review_runs")
    .select("*")
    .eq("id", reviewId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return parseReviewRun(data as Record<string, unknown>);
}
