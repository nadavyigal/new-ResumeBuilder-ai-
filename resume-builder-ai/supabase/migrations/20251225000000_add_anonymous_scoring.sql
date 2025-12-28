-- Anonymous ATS scoring + rate limiting tables

create table public.anonymous_ats_scores (
  id bigserial primary key,
  session_id text not null,
  ip_address text not null,
  ats_score integer not null,
  ats_subscores jsonb not null,
  ats_suggestions jsonb not null,
  resume_hash text not null,
  job_description_hash text not null,
  user_id uuid references auth.users (id) on delete set null,
  optimization_id uuid references public.optimizations (id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index idx_anon_scores_session on public.anonymous_ats_scores (session_id);
create index idx_anon_scores_ip on public.anonymous_ats_scores (ip_address, created_at);
create index idx_anon_scores_expiry on public.anonymous_ats_scores (expires_at);
create index idx_anon_scores_user on public.anonymous_ats_scores (user_id) where user_id is not null;

create table public.rate_limits (
  id bigserial primary key,
  identifier text not null,
  endpoint text not null,
  requests_count integer not null default 1,
  window_start timestamptz not null default now(),
  constraint rate_limits_unique unique (identifier, endpoint)
);

create index idx_rate_limits_lookup on public.rate_limits (identifier, endpoint, window_start);

alter table public.anonymous_ats_scores enable row level security;
create policy "Allow anonymous insert" on public.anonymous_ats_scores
  for insert with check (true);
create policy "Users can view converted scores" on public.anonymous_ats_scores
  for select using (user_id = auth.uid());
create policy "Users can attach scores" on public.anonymous_ats_scores
  for update using (user_id is null)
  with check (user_id = auth.uid());

alter table public.rate_limits enable row level security;
create policy "System can manage rate limits" on public.rate_limits
  for all using (true) with check (true);
