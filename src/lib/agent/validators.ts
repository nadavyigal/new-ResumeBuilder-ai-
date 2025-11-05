import { z } from "zod";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import type { AgentArtifacts, AgentResult, Diff, RunInput } from "./types";
import type { SubScores } from "@/lib/ats/types";

const DIFF_SCOPES = ["section", "paragraph", "bullet", "style", "layout"] as const;
const PROPOSED_CHANGE_CATEGORIES = ["content", "structure", "formatting", "data_quality", "compliance"] as const;
const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
const COACHING_TONES = ["supportive", "direct", "analytical"] as const;
const COACHING_FOCUS = ["language", "skills", "metrics", "design", "ats"] as const;
const LANGUAGE_SOURCES = ["heuristic", "model"] as const;

// Core schemas
export const DiffSchema = z.object({
  scope: z.enum(DIFF_SCOPES).default("paragraph"),
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

export const LanguageDetectionSchema = z.object({
  lang: z.string(),
  confidence: z.number().min(0).max(1),
  rtl: z.boolean(),
  source: z.enum(LANGUAGE_SOURCES).optional(),
});

export const ProposedChangeSchema = z.object({
  id: z.string(),
  summary: z.string(),
  scope: z.enum(DIFF_SCOPES),
  category: z.enum(PROPOSED_CHANGE_CATEGORIES),
  confidence: z.enum(CONFIDENCE_LEVELS),
  rationale: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  requires_human_review: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const CoachingPayloadSchema = z.object({
  headline: z.string().optional(),
  focus: z.array(z.enum(COACHING_FOCUS)).default([]),
  tone: z.enum(COACHING_TONES).optional(),
  guidance: z.array(z.string()).default([]),
  proposed_changes: z.array(ProposedChangeSchema).optional(),
  blockers: z.array(z.string()).optional(),
  follow_up_questions: z.array(z.string()).optional(),
  language: LanguageDetectionSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

const SubScoreSchema = z
  .object({
    keyword_exact: z.number().min(0).max(100).default(0),
    keyword_phrase: z.number().min(0).max(100).default(0),
    semantic_relevance: z.number().min(0).max(100).default(0),
    title_alignment: z.number().min(0).max(100).default(0),
    metrics_presence: z.number().min(0).max(100).default(0),
    section_completeness: z.number().min(0).max(100).default(0),
    format_parseability: z.number().min(0).max(100).default(0),
    recency_fit: z.number().min(0).max(100).default(0),
  })
  .default({
    keyword_exact: 0,
    keyword_phrase: 0,
    semantic_relevance: 0,
    title_alignment: 0,
    metrics_presence: 0,
    section_completeness: 0,
    format_parseability: 0,
    recency_fit: 0,
  } satisfies SubScores);

export const ATSReportSchema = z.object({
  score: z.number().min(0).max(100).default(0),
  missing_keywords: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  languages: z
    .record(
      z.object({
        score: z.number().min(0).max(100).default(0),
        rtl: z.boolean().default(false),
        subscores: SubScoreSchema,
        missing_keywords: z.array(z.string()).default([]),
        gaps: z.array(z.string()).default([]),
      })
    )
    .default({}),
});

const BaseRunInputSchema = z.object({
  userId: z.string(),
  command: z.string(),
  resume_file_path: z.string().optional(),
  resume_json: z.any(),
  job_url: z.string().url().optional(),
  job_description: z.string().trim().min(1).optional(),
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

export const RunInputSchema: z.ZodType<RunInput> = BaseRunInputSchema.superRefine((value, ctx) => {
  if (!value.job_description && !value.job_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide job_description or job_url",
      path: ["job_description"],
    });
  }
}).transform((value) => {
  return {
    ...value,
    job_text: value.job_description ?? value.job_text,
  };
}) as unknown as z.ZodType<RunInput>;

export const AgentResultSchema: z.ZodType<AgentResult> = z.object({
  intent: z.enum([
    "rewrite",
    "add_skills",
    "design",
    "layout",
    "ats_optimize",
    "export",
    "undo",
    "redo",
    "compare",
    "save_history",
    "resume.guide.optimize",
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
  proposed_changes: z.array(ProposedChangeSchema).optional(),
  coaching: CoachingPayloadSchema.optional(),
  language: LanguageDetectionSchema.optional(),
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
  return parsed.success
    ? parsed.data
    : { score: 0, missing_keywords: [], recommendations: [], languages: {} };
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

