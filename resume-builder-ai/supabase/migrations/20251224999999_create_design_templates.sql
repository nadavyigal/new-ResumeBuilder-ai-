create table if not exists
  public.design_templates (
    slug text primary key,
    name text not null,
    description text,
    category text,
    file_path text,
    is_premium boolean default false,
    ats_compatibility_score integer,
    supported_customizations jsonb default '{}'::jsonb,
    default_config jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
  ) tablespace pg_default;
