import type { OptimizedResume } from '@/lib/ai-optimizer';

export type ExpertWorkflowType =
  | 'full_resume_rewrite'
  | 'achievement_quantifier'
  | 'ats_optimization_report'
  | 'professional_summary_lab';

export type ExpertWorkflowStatus = 'completed' | 'needs_user_input' | 'failed';

export interface ExpertWorkflowInput {
  optimization_id: string;
  workflow_type: ExpertWorkflowType;
  options?: Record<string, unknown>;
  evidence_inputs?: Record<string, unknown>;
}

export interface ExpertWorkflowContext {
  user_id: string;
  optimization_id: string;
  workflow_type: ExpertWorkflowType;
  options: Record<string, unknown>;
  evidence_inputs: Record<string, unknown>;
  resume_original_text: string;
  job_description_text: string;
  job_title: string;
  job_company: string;
  current_resume_json: OptimizedResume;
  current_ats_score_optimized: number | null;
  current_ats_score_original: number | null;
}

export interface ExpertRunResult {
  run_id: string;
  status: ExpertWorkflowStatus;
  output: Record<string, unknown>;
  needs_user_input: boolean;
  missing_evidence: string[];
}

export interface ExpertAtsImpact {
  before: number | null;
  after: number | null;
  delta: number | null;
}

export interface ExpertApplyResult {
  success: boolean;
  updated_fields: string[];
  ats_impact: ExpertAtsImpact;
  apply_mode: string;
  selection_index: number | null;
  new_ats_score?: number | null;
}

export interface ExpertReport {
  headline: string;
  executive_summary: string;
  priority_actions: string[];
  evidence_gaps: string[];
  ats_impact_estimate: {
    before: number | null;
    after: number | null;
    delta: number | null;
    confidence_note?: string;
  };
}

export interface ApplicationExpertReport {
  id: string;
  application_id: string;
  run_id: string;
  user_id: string;
  optimization_id: string;
  workflow_type: ExpertWorkflowType;
  report_title: string;
  report_summary: string;
  report_json: Record<string, unknown>;
  ats_score_before: number | null;
  ats_score_after: number | null;
  ats_score_delta: number | null;
  saved_at: string;
}

export interface PromptBundle {
  system: string;
  user: string;
  model: 'gpt-4o' | 'gpt-4o-mini';
  temperature: number;
  max_tokens: number;
}

export interface QuantifiedBulletRewrite {
  experience_index?: number;
  bullet_index?: number;
  original_bullet: string;
  optimized_bullet: string;
  evidence_used: string[];
  missing_evidence_questions: string[];
}

export interface SummaryOption {
  angle: 'leadership' | 'technical' | 'results' | 'industry' | 'vision';
  summary: string;
  rationale: string;
}
