import type { OptimizedResume } from "@/lib/ai-optimizer";

export type ConfidenceLevel = "low" | "medium" | "high";

export enum ProposedChangeCategory {
  Content = "content",
  Structure = "structure",
  Formatting = "formatting",
  DataQuality = "data_quality",
  Compliance = "compliance",
}

export enum CoachingTone {
  Supportive = "supportive",
  Direct = "direct",
  Analytical = "analytical",
}

export enum CoachingFocusArea {
  Language = "language",
  Skills = "skills",
  Metrics = "metrics",
  Design = "design",
  Ats = "ats",
}

export interface LanguageDetection {
  lang: string;
  confidence: number;
  rtl: boolean;
  source?: "heuristic" | "model";
}

export interface ProposedChange {
  id: string;
  summary: string;
  scope: DiffScope;
  category: ProposedChangeCategory;
  confidence: ConfidenceLevel;
  rationale?: string;
  before?: string;
  after?: string;
  requires_human_review?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CoachingPayload {
  headline?: string;
  focus: CoachingFocusArea[];
  tone?: CoachingTone;
  guidance: string[];
  proposed_changes?: ProposedChange[];
  blockers?: string[];
  follow_up_questions?: string[];
  language?: LanguageDetection;
  metadata?: Record<string, unknown>;
}

export type Intent =
  | "rewrite"
  | "add_skills"
  | "design"
  | "layout"
  | "ats_optimize"
  | "export"
  | "undo"
  | "redo"
  | "compare"
  | "save_history"
  | "resume.guide.optimize";

export type DiffScope = "section" | "paragraph" | "bullet" | "style" | "layout";

export interface Diff {
  scope: DiffScope;
  before: string;
  after: string;
}

export interface AgentResult {
  intent: Intent;
  actions: { tool: string; args: Record<string, any>; rationale: string }[];
  diffs: Diff[];
  artifacts: AgentArtifacts;
  ats_report?: { score: number; missing_keywords: string[]; recommendations: string[] };
  history_record?: {
    resume_version_id: string;
    timestamp: string;
    job?: { title?: string; company?: string; contact_person?: string; apply_url?: string; apply_date?: string };
    ats_score?: number;
    notes?: string;
  };
  ui_prompts?: string[];
  proposed_changes?: ProposedChange[];
  coaching?: CoachingPayload;
  language?: LanguageDetection;
}

export interface RunInput {
  userId: string;
  command: string;
  resume_file_path?: string;
  resume_json: OptimizedResume | any;
  job_description?: string;
  job_url?: string;
  job_text?: string;
  design?: { font_family?: string; color_hex?: string; layout?: string; spacing?: string; density?: "compact" | "cozy" };
}

export interface ThemeOptions {
  font_family?: string;
  color_hex?: string;
  spacing?: string;
  density?: "compact" | "cozy";
  layout?: string;
}

export interface AgentArtifacts {
  resume_json?: OptimizedResume | any;
  preview_pdf_path?: string;
  export_files?: { type: "pdf" | "docx" | "json"; path: string }[];
}
