-- Expert workflow apply metadata + application-saved expert reports

alter table public.expert_workflow_runs
  add column if not exists applied_at timestamptz null,
  add column if not exists ats_score_before numeric(5,2) null,
  add column if not exists ats_score_after numeric(5,2) null,
  add column if not exists updated_fields_json jsonb not null default '[]'::jsonb,
  add column if not exists apply_mode text null,
  add column if not exists selection_index integer null;

create table if not exists public.application_expert_reports (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  run_id uuid not null references public.expert_workflow_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  optimization_id uuid not null references public.optimizations(id) on delete cascade,
  workflow_type text not null check (
    workflow_type in (
      'full_resume_rewrite',
      'achievement_quantifier',
      'ats_optimization_report',
      'professional_summary_lab'
    )
  ),
  report_title text not null default '',
  report_summary text not null default '',
  report_json jsonb not null default '{}'::jsonb,
  ats_score_before numeric(5,2) null,
  ats_score_after numeric(5,2) null,
  ats_score_delta numeric(5,2) null,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_application_expert_reports_unique_app_run
  on public.application_expert_reports (application_id, run_id);

create index if not exists idx_application_expert_reports_application_saved
  on public.application_expert_reports (application_id, saved_at desc);

create index if not exists idx_application_expert_reports_user_saved
  on public.application_expert_reports (user_id, saved_at desc);

alter table public.application_expert_reports enable row level security;

drop policy if exists "application_expert_reports_select_own" on public.application_expert_reports;
create policy "application_expert_reports_select_own"
  on public.application_expert_reports
  for select
  using (user_id = auth.uid());

drop policy if exists "application_expert_reports_insert_own" on public.application_expert_reports;
create policy "application_expert_reports_insert_own"
  on public.application_expert_reports
  for insert
  with check (user_id = auth.uid());