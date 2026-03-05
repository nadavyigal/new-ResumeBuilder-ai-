-- Extend expert workflow types and persist selected workflow assets.

alter table public.expert_workflow_runs
  add column if not exists applied_assets_json jsonb null;

alter table public.application_expert_reports
  add column if not exists asset_type text null,
  add column if not exists asset_json jsonb null;

alter table public.application_expert_reports
  drop constraint if exists application_expert_reports_asset_type_check;

alter table public.application_expert_reports
  add constraint application_expert_reports_asset_type_check
  check (
    asset_type is null
    or asset_type in ('cover_letter', 'screening_answers', 'outreach_kit', 'story_bank')
  );

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

alter table public.application_expert_reports
  drop constraint if exists application_expert_reports_workflow_type_check;

alter table public.application_expert_reports
  add constraint application_expert_reports_workflow_type_check
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
