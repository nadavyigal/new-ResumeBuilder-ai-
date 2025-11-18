import type { OptimizedResume } from "@/lib/ai-optimizer";

export type Intent =
  | "rewrite"
  | "add_skills"
  | "design"
  | "layout"
  | "ats_optimize"
  | "optimize" // resume.guide.optimize workflow
  | "export"
  | "undo"
  | "redo"
  | "compare"
  | "save_history"
  | "tip_implementation"
  | "color_customization";

export type DiffScope = "section" | "paragraph" | "bullet" | "style" | "layout";

export interface Diff {
  scope: DiffScope;
  before: string;
  after: string;
}

// A structured proposal the agent can surface for user approval
export interface ProposedChange {
  id: string;
  section: string; // e.g., 'summary', 'experience[0]'
  field?: string; // e.g., 'bullet', 'title', 'skills'
  text: string; // proposed text or instruction
  rationale?: string;
  estimated_gain?: number; // e.g., ATS point estimate
}

export interface AgentResult {
  intent: Intent;
  actions: { tool: string; args: Record<string, any>; rationale: string }[];
  diffs: Diff[];
  artifacts: AgentArtifacts;
  ats_report?: { score: number; missing_keywords: string[]; recommendations: string[] };
  // Proposed changes allow UI to present actionable items for approval
  proposed_changes?: ProposedChange[];
  // Chosen target language and direction for rendering
  language?: { code: string; direction: 'ltr' | 'rtl' };
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
