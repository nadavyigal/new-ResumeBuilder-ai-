import { z } from "zod";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import type { AgentArtifacts, AgentResult, Diff, RunInput } from "./types";

// Core schemas
export const DiffSchema = z.object({
  scope: z.enum(["section", "paragraph", "bullet", "style", "layout"]).default("paragraph"),
  before: z.string().default(""),
  after: z.string().default(""),
});

export const AgentArtifactsSchema = z.object({
  resume_json: z.any().optional(),
  preview_pdf_path: z.string().optional(),
  export_files: z
    .array(
      z.object({
        type: z.enum(["pdf", "docx", "json"]).default("pdf"),
        path: z.string(),
      })
    )
    .optional()
    .default([]),
});

export const OptimizedResumeSchema: z.ZodType<OptimizedResume> = z.any();

export const ATSReportSchema = z.object({
  score: z.number().min(0).max(100).default(0),
  missing_keywords: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

export const RunInputSchema: z.ZodType<RunInput> = z.object({
  userId: z.string(),
  command: z.string(),
  resume_file_path: z.string().optional(),
  resume_json: z.any().optional(),
  job_url: z.string().optional(),
  job_text: z.string().optional(),
  design: z
    .object({
      font_family: z.string().optional(),
      color_hex: z.string().optional(),
      layout: z.string().optional(),
      spacing: z.string().optional(),
      density: z.enum(["compact", "cozy"]).optional(),
    })
    .optional(),
});

export const AgentResultSchema: z.ZodType<AgentResult> = z.object({
  intent: z.enum([
    "rewrite",
    "add_skills",
    "design",
    "layout",
    "ats_optimize",
    "optimize",
    "export",
    "undo",
    "redo",
    "compare",
    "save_history",
  ]),
  actions: z.array(
    z.object({
      tool: z.string(),
      args: z.record(z.any()).default({}),
      rationale: z.string().default(""),
    })
  ),
  diffs: z.array(DiffSchema).default([]),
  artifacts: AgentArtifactsSchema,
  ats_report: ATSReportSchema.optional(),
  proposed_changes: z
    .array(
      z.object({
        id: z.string(),
        section: z.string(),
        field: z.string().optional(),
        text: z.string(),
        rationale: z.string().optional(),
        estimated_gain: z.number().optional(),
      })
    )
    .optional(),
  language: z
    .object({ code: z.string(), direction: z.enum(["ltr", "rtl"]) })
    .optional(),
  history_record: z
    .object({
      resume_version_id: z.string(),
      timestamp: z.string(),
      job: z
        .object({
          title: z.string().optional(),
          company: z.string().optional(),
          contact_person: z.string().optional(),
          apply_url: z.string().optional(),
          apply_date: z.string().optional(),
        })
        .optional(),
      ats_score: z.number().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  ui_prompts: z.array(z.string()).optional(),
});

// Safe parse helpers (coerce or default)
export function safeParseDiffs(value: unknown): Diff[] {
  const arr = z.array(DiffSchema).safeParse(value);
  return arr.success ? arr.data : [];
}

export function safeParseAgentArtifacts(value: unknown): AgentArtifacts {
  const parsed = AgentArtifactsSchema.safeParse(value);
  return parsed.success ? parsed.data : { export_files: [] };
}

export function safeParseATSReport(value: unknown) {
  const parsed = ATSReportSchema.safeParse(value);
  return parsed.success ? parsed.data : { score: 0, missing_keywords: [], recommendations: [] };
}

export function safeParseOptimizedResume(value: unknown): OptimizedResume | any {
  // For v1, accept any and rely on downstream rendering; fallback minimal shape
  const fallback: OptimizedResume | any = {
    summary: "",
    contact: { name: "", email: "", phone: "", location: "" },
    skills: { technical: [], soft: [] },
    experience: [],
    education: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
  };
  try {
    // If it's an object with at least summary/skills/experience, accept
    if (value && typeof value === "object") return value as any;
    return fallback;
  } catch {
    return fallback;
  }
}

export function safeParseRunInput(value: unknown): RunInput | null {
  const parsed = RunInputSchema.safeParse(value);
  return parsed.success ? (parsed.data as RunInput) : null;
}

export function safeParseAgentResult(value: unknown): AgentResult | null {
  const parsed = AgentResultSchema.safeParse(value);
  return parsed.success ? (parsed.data as AgentResult) : null;
}

