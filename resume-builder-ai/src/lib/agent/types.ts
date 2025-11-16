import type { OptimizedResume } from "@/lib/ai-optimizer";

export type Intent =
  | "tip_implementation"  // New: Spec 008 - implement tip 1, 2, etc.
  | "color_customization" // New: Spec 008 - change background to blue, etc.
  | "rewrite"
  | "add_skills"
  | "design"
  | "layout"
  | "ats_optimize"
  | "export"
  | "undo"
  | "redo"
  | "compare"
  | "save_history";

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
}

export interface RunInput {
  userId: string;
  command: string;
  resume_file_path?: string;
  resume_json?: OptimizedResume | any;
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
