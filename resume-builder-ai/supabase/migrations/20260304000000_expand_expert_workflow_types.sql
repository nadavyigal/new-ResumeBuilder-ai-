-- Expand expert_workflow_runs.workflow_type CHECK constraint to include
-- cover_letter_architect, screening_answer_studio, recruiter_outreach_kit, interview_story_bank

alter table public.expert_workflow_runs
  drop constraint if exists expert_workflow_runs_workflow_type_check;

alter table public.expert_workflow_runs
  add constraint expert_workflow_runs_workflow_type_check
  check (
    workflow_type in (
      'full_resume_rewrite',
      'achievement_quantifier',
      'ats_optimization_report',
      'professional_summary_lab',
      'cover_letter_architect',
      'screening_answer_studio',
      'recruiter_outreach_kit',
      'interview_story_bank'
    )
  );
