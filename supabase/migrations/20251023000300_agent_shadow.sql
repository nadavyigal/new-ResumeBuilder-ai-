-- Agent SDK shadow logging table (idempotent)
CREATE TABLE IF NOT EXISTS public.agent_shadow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  intent text[],
  ats_before int,
  ats_after int,
  diff_count int,
  warnings text[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_shadow_user_created
  ON public.agent_shadow_logs(user_id, created_at DESC);

