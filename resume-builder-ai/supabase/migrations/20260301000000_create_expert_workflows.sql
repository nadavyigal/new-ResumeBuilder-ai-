-- Expert Workflows (Resume Core) tables
-- Adds run history and artifacts for advanced expert modes.

create table if not exists public.expert_workflow_runs (
  id uuid primary key default gen_random_uuid(),
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
  status text not null default 'completed' check (
    status in ('completed', 'needs_user_input', 'failed')
  ),
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  missing_evidence_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expert_workflow_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.expert_workflow_runs(id) on delete cascade,
  artifact_type text not null,
  artifact_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_expert_runs_user_created
  on public.expert_workflow_runs (user_id, created_at desc);

create index if not exists idx_expert_runs_optimization
  on public.expert_workflow_runs (optimization_id, created_at desc);

create index if not exists idx_expert_runs_workflow_type
  on public.expert_workflow_runs (workflow_type);

create index if not exists idx_expert_artifacts_run
  on public.expert_workflow_artifacts (run_id, created_at desc);

alter table public.expert_workflow_runs enable row level security;
alter table public.expert_workflow_artifacts enable row level security;

drop policy if exists "expert_runs_select_own" on public.expert_workflow_runs;
create policy "expert_runs_select_own"
  on public.expert_workflow_runs
  for select
  using (user_id = auth.uid());

drop policy if exists "expert_runs_insert_own" on public.expert_workflow_runs;
create policy "expert_runs_insert_own"
  on public.expert_workflow_runs
  for insert
  with check (user_id = auth.uid());

drop policy if exists "expert_runs_update_own" on public.expert_workflow_runs;
create policy "expert_runs_update_own"
  on public.expert_workflow_runs
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "expert_artifacts_select_own" on public.expert_workflow_artifacts;
create policy "expert_artifacts_select_own"
  on public.expert_workflow_artifacts
  for select
  using (
    exists (
      select 1
      from public.expert_workflow_runs r
      where r.id = expert_workflow_artifacts.run_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "expert_artifacts_insert_own" on public.expert_workflow_artifacts;
create policy "expert_artifacts_insert_own"
  on public.expert_workflow_artifacts
  for insert
  with check (
    exists (
      select 1
      from public.expert_workflow_runs r
      where r.id = expert_workflow_artifacts.run_id
        and r.user_id = auth.uid()
    )
  );

drop trigger if exists update_expert_workflow_runs_updated_at on public.expert_workflow_runs;
create trigger update_expert_workflow_runs_updated_at
  before update on public.expert_workflow_runs
  for each row
  execute function public.handle_updated_at();
