-- Down migration for Agent SDK tables and columns (idempotent)
-- Drops: history, resume_versions, agent_shadow_logs, and profile columns

-- Drop history first (depends on resume_versions)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'history'
  ) THEN
    DROP TABLE public.history;
  END IF;
END $$;

-- Drop resume_versions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'resume_versions'
  ) THEN
    DROP TABLE public.resume_versions;
  END IF;
END $$;

-- Drop agent_shadow_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_shadow_logs'
  ) THEN
    DROP TABLE public.agent_shadow_logs;
  END IF;
END $$;

-- Remove columns from profiles if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'credit_balance'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN credit_balance;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'welcome_credit_applied'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN welcome_credit_applied;
  END IF;
END $$;

