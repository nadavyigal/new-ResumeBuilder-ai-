/**
 * GET /api/v1/optimizations/:id
 *
 * Returns the optimization's resume sections, ATS scores, and job context so
 * the iOS app can populate OptimizedResumeView when navigating from the
 * review-apply path (where the apply response contains only optimizationId,
 * not sections).
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { scoreOptimization } from "@/lib/ats/integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── types ────────────────────────────────────────────────────────────────────

interface IosSection {
  id: string;
  type: string;
  content: string; // iOS decodes this key as `body`
  status: string;
}

interface IosContact {
  name: string;
  email: string;
  phone: string;
  location: string;
  title?: string;
  linkedin?: string;
  portfolio?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function flattenSummary(data: OptimizedResume): string {
  return typeof data.summary === "string" ? data.summary.trim() : "";
}

function flattenSkills(data: OptimizedResume): string {
  const s = data.skills;
  if (!s) return "";
  const technical = Array.isArray(s.technical) ? s.technical : [];
  const soft = Array.isArray(s.soft) ? s.soft : [];
  return [...technical, ...soft].join("\n").trim();
}

function flattenExperience(data: OptimizedResume): string {
  if (!Array.isArray(data.experience)) return "";
  return data.experience
    .map((exp) => {
      const head = [exp.title, exp.company].filter(Boolean).join(" • ");
      const bullets = Array.isArray(exp.achievements)
        ? exp.achievements.map((a: string) => `• ${a}`)
        : [];
      return [head, ...bullets].join("\n");
    })
    .join("\n\n")
    .trim();
}

function flattenEducation(data: OptimizedResume): string {
  if (!Array.isArray(data.education)) return "";
  return data.education
    .map((edu) => {
      return [edu.degree, edu.institution, (edu as any).graduationDate]
        .filter(Boolean)
        .join(" • ");
    })
    .join("\n")
    .trim();
}

function flattenAdditional(data: OptimizedResume): string {
  const certs = Array.isArray(data.certifications) ? data.certifications : [];
  const projects = Array.isArray((data as any).projects)
    ? (data as any).projects.map((p: any) => p.name || "").filter(Boolean)
    : [];
  return [...certs, ...projects].join("\n").trim();
}

function rewriteDataToSections(data: OptimizedResume): IosSection[] {
  const sections: IosSection[] = [];

  const summary = flattenSummary(data);
  if (summary) sections.push({ id: "s_summary", type: "summary", content: summary, status: "optimized" });

  const experience = flattenExperience(data);
  if (experience) sections.push({ id: "s_experience", type: "experience", content: experience, status: "optimized" });

  const skills = flattenSkills(data);
  if (skills) sections.push({ id: "s_skills", type: "skills", content: skills, status: "optimized" });

  const education = flattenEducation(data);
  if (education) sections.push({ id: "s_education", type: "education", content: education, status: "optimized" });

  const additional = flattenAdditional(data);
  if (additional) sections.push({ id: "s_additional", type: "additional", content: additional, status: "optimized" });

  return sections;
}

function rewriteDataToContact(data: OptimizedResume): IosContact | null {
  const contact = data.contact;
  if (!contact) return null;

  const normalized: IosContact = {
    name: contact.name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    location: contact.location || "",
    title: contact.title || "",
    linkedin: contact.linkedin || "",
    portfolio: contact.portfolio || "",
  };

  const hasAnyValue = Object.values(normalized).some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
  return hasAnyValue ? normalized : null;
}

function toIntPercent(value: number | null | undefined): number | null {
  if (value == null) return null;
  const scaled = value <= 1 ? value * 100 : value;
  return Math.round(scaled);
}

// ─── handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase
    .from("optimizations")
    .select("rewrite_data, ats_score_original, ats_score_optimized, jd_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
  }

  const rewriteData = row.rewrite_data as OptimizedResume | null;
  const sections = rewriteData ? rewriteDataToSections(rewriteData) : [];
  const contact = rewriteData ? rewriteDataToContact(rewriteData) : null;

  let jobTitle: string | null = null;
  let company: string | null = null;

  if (row.jd_id) {
    const { data: jd } = await supabase
      .from("job_descriptions")
      .select("title, company")
      .eq("id", row.jd_id)
      .maybeSingle();
    jobTitle = jd?.title ?? null;
    company = jd?.company ?? null;
  }

  return NextResponse.json({
    sections,
    contact,
    jobTitle,
    job_title: jobTitle,
    company,
    atsScoreBefore: toIntPercent(row.ats_score_original),
    ats_score_before: toIntPercent(row.ats_score_original),
    atsScoreAfter: toIntPercent(row.ats_score_optimized),
    ats_score_after: toIntPercent(row.ats_score_optimized),
  });
}

// ─── PATCH handler ────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { rewrite_data?: OptimizedResume; changeSummary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rewriteData = body.rewrite_data;
  const changeSummary = body.changeSummary;

  if (!rewriteData) {
    return NextResponse.json({ error: "rewrite_data is required" }, { status: 400 });
  }

  try {
    const userId = user.id;

    const { data: currentOpt, error: currentOptErr } = await supabase
      .from("optimizations")
      .select("resume_id, jd_id, ats_score_original, ats_subscores_original")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (currentOptErr) {
      return NextResponse.json({ error: currentOptErr.message }, { status: 500 });
    }
    if (!currentOpt) {
      return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
    }

    const { data: jdRow } = await supabase
      .from("job_descriptions")
      .select("raw_text, clean_text, parsed_data")
      .eq("id", (currentOpt as any).jd_id)
      .maybeSingle();

    const { data: resumeRow } = await supabase
      .from("resumes")
      .select("raw_text")
      .eq("id", (currentOpt as any).resume_id)
      .maybeSingle();

    let atsResult: {
      ats_score_original: number | null;
      ats_score_optimized: number | null;
      subscores?: any;
      suggestions?: any;
      confidence?: any;
    } = {
      ats_score_original: (currentOpt as any).ats_score_original ?? null,
      ats_score_optimized: null,
    };

    try {
      const scored = await scoreOptimization({
        resumeOriginalText: (resumeRow as any)?.raw_text || "",
        resumeOptimizedJson: rewriteData,
        jobDescriptionText: (jdRow as any)?.clean_text || (jdRow as any)?.raw_text || "",
        jobExtractedJson: (jdRow as any)?.parsed_data || undefined,
      });
      atsResult = scored;
    } catch (scoringErr) {
      console.error("ATS scoring failed during manual edit:", scoringErr);
    }

    await supabase
      .from("optimizations")
      .update({
        rewrite_data: rewriteData,
        match_score: atsResult.ats_score_optimized ?? undefined,
        ats_score_optimized: atsResult.ats_score_optimized,
        ats_subscores: (atsResult as any).subscores ?? null,
        ats_suggestions: (atsResult as any).suggestions ?? null,
        ats_confidence: (atsResult as any).confidence ?? null,
      })
      .eq("id", id)
      .eq("user_id", userId);

    const { data: versions } = await supabase
      .from("resume_versions")
      .select("version_number")
      .eq("optimization_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = ((versions as any)?.version_number ?? 0) + 1;

    await supabase.from("resume_versions").insert({
      optimization_id: id,
      session_id: null,
      version_number: nextVersion,
      content: rewriteData,
      change_summary: changeSummary || "Manual edit",
    });

    return NextResponse.json({
      success: true,
      ats_score_original: atsResult.ats_score_original,
      ats_score_optimized: atsResult.ats_score_optimized,
    });
  } catch (err) {
    console.error("PATCH /api/v1/optimizations/:id error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
