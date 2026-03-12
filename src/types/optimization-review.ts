import type { OptimizedResume } from "@/lib/ai-optimizer";

export type ReviewSection =
  | "summary"
  | "contact"
  | "skills"
  | "experience"
  | "education"
  | "certifications"
  | "projects";

export type ReviewOperationType = "replace";

export interface ReviewModificationOperation {
  operation: ReviewOperationType;
  field_path: ReviewSection;
  old_value: unknown;
  new_value: unknown;
}

export interface ReviewChangeGroup {
  id: string;
  section: ReviewSection;
  title: string;
  summary: string;
  before_excerpt: string;
  after_excerpt: string;
  affected_fields: string[];
  operations: ReviewModificationOperation[];
  reason_tags: string[];
}

export interface ReviewATSPreview {
  before: number | null;
  after: number | null;
  delta: number | null;
  confidence: number | null;
  confidence_note?: string;
  suggestions?: unknown[];
}

export interface OptimizationReviewRun {
  id: string;
  user_id: string;
  resume_id: string;
  jd_id: string;
  original_resume_json: OptimizedResume;
  optimized_resume_json: OptimizedResume;
  grouped_changes_json: ReviewChangeGroup[];
  ats_preview_json: ReviewATSPreview | null;
  created_at: string;
  applied_at: string | null;
}
