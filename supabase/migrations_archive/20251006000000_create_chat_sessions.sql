create table if not exists
  public.chat_sessions (
    id uuid,
    user_id uuid,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    constraint chat_sessions_pkey primary key (id)
  ) tablespace pg_default;
