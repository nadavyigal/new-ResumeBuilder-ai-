create table if not exists public.optimization_review_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  jd_id uuid not null references public.job_descriptions(id) on delete cascade,
  original_resume_json jsonb not null default '{}'::jsonb,
  optimized_resume_json jsonb not null default '{}'::jsonb,
  grouped_changes_json jsonb not null default '[]'::jsonb,
  ats_preview_json jsonb null,
  created_at timestamptz not null default now(),
  applied_at timestamptz null
);

create index if not exists idx_optimization_review_runs_user_created
  on public.optimization_review_runs (user_id, created_at desc);

create index if not exists idx_optimization_review_runs_resume
  on public.optimization_review_runs (resume_id, created_at desc);

create index if not exists idx_optimization_review_runs_jd
  on public.optimization_review_runs (jd_id, created_at desc);

alter table public.optimization_review_runs enable row level security;

drop policy if exists "optimization_review_runs_select_own" on public.optimization_review_runs;
create policy "optimization_review_runs_select_own"
  on public.optimization_review_runs
  for select
  using (user_id = auth.uid());

drop policy if exists "optimization_review_runs_insert_own" on public.optimization_review_runs;
create policy "optimization_review_runs_insert_own"
  on public.optimization_review_runs
  for insert
  with check (user_id = auth.uid());

drop policy if exists "optimization_review_runs_update_own" on public.optimization_review_runs;
create policy "optimization_review_runs_update_own"
  on public.optimization_review_runs
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
