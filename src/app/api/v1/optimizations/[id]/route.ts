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
