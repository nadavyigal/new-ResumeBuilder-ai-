create table if not exists
  public.events (
    id uuid,
    user_id uuid not null,
    type text not null,
    payload_data jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    constraint events_pkey primary key (id),
    constraint events_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
  ) tablespace pg_default;
