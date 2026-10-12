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

/**
 * A job-post phrase the optimizer wrote and the guard held back, offered as
 * "Add only if true". Applied after its section's change, and only when that
 * section's change is approved too, because it edits the new text.
 */
export interface ReviewConfirmClaim {
  requires: ReviewSection;
  /** Role index (experience) or project index (projects); 0 for the summary. */
  index: number;
  /** Text now in the résumé in its place, or null when the whole item was held back. */
  kept: string | null;
  /** What the optimizer wrote; restored when the user confirms. */
  proposed: string;
  /** For a whole held-back item: the text it followed. Null = first. */
  after: string | null;
  /** The job-post words the résumé does not use. */
  terms: string[];
  /** Score points confirming adds, measured when the review was created. Null when not measured. */
  estimated_gain: number | null;
  /**
   * When the item is one clause of a line: the line's clauses as the optimizer
   * wrote them, the ones kept, and this one. Several confirmed clauses of the
   * same line are put back together, in their original order.
   */
  clauses?: string[];
  kept_clauses?: number[];
  clause?: number;
  /**
   * True when holding the phrase back left its section identical to the original,
   * so there is no section change to approve: the item then applies on its own.
   */
  standalone?: boolean;
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
  /** Present on "Add only if true" items, which carry no operations and are never pre-selected. */
  confirm?: ReviewConfirmClaim;
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
