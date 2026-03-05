create table if not exists
  public.applications (
    id uuid,
    user_id uuid,
    optimization_id uuid,
    created_at timestamp with time zone default now(),
    constraint applications_pkey primary key (id)
  ) tablespace pg_default;
