-- Agent SDK integration migration (idempotent)
-- Adds profile fields, resume_versions, and history tables

-- profiles additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'credit_balance'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN credit_balance DECIMAL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'welcome_credit_applied'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN welcome_credit_applied BOOLEAN DEFAULT false;
  END IF;
END $$;

-- resume_versions table
CREATE TABLE IF NOT EXISTS public.resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user_created ON public.resume_versions(user_id, created_at DESC);

-- history table
CREATE TABLE IF NOT EXISTS public.history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_version_id uuid NOT NULL REFERENCES public.resume_versions(id) ON DELETE CASCADE,
  job jsonb,
  ats_score int,
  artifacts jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  apply_date timestamptz
);

CREATE INDEX IF NOT EXISTS idx_history_user_created ON public.history(user_id, created_at DESC);

