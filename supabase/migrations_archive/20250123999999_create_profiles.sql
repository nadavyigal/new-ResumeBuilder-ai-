create table if not exists
  public.profiles (
    id uuid,
    user_id uuid not null,
    full_name text,
    plan_type text default 'free',
    optimizations_used integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    constraint profiles_pkey primary key (id),
    constraint profiles_user_id_key unique (user_id),
    constraint profiles_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
  ) tablespace pg_default;
