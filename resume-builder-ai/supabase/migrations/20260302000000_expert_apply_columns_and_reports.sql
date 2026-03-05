-- Expert Workflow: apply-phase columns + application_expert_reports table
-- Adds columns that track the result of applying a workflow run, and creates
-- the table used to save validated reports against a job application.

-- ── Step 1: Add missing apply-phase columns to expert_workflow_runs ──────────

ALTER TABLE public.expert_workflow_runs
  ADD COLUMN IF NOT EXISTS applied_at          timestamptz,
  ADD COLUMN IF NOT EXISTS ats_score_before    numeric(5,2),
  ADD COLUMN IF NOT EXISTS ats_score_after     numeric(5,2),
  ADD COLUMN IF NOT EXISTS updated_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS apply_mode          text,
  ADD COLUMN IF NOT EXISTS selection_index     integer;

-- ── Step 2: Create application_expert_reports table ──────────────────────────

CREATE TABLE IF NOT EXISTS public.application_expert_reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   uuid        NOT NULL REFERENCES public.applications(id)        ON DELETE CASCADE,
  run_id           uuid        NOT NULL REFERENCES public.expert_workflow_runs(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id)                 ON DELETE CASCADE,
  optimization_id  uuid        NOT NULL REFERENCES public.optimizations(id)       ON DELETE CASCADE,
  workflow_type    text        NOT NULL,
  report_title     text        NOT NULL DEFAULT '',
  report_summary   text        NOT NULL DEFAULT '',
  report_json      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ats_score_before numeric(5,2),
  ats_score_after  numeric(5,2),
  ats_score_delta  numeric(5,2),
  saved_at         timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Step 3: Unique constraint for upsert ─────────────────────────────────────

ALTER TABLE public.application_expert_reports
  DROP CONSTRAINT IF EXISTS uq_application_expert_reports_app_run;

ALTER TABLE public.application_expert_reports
  ADD CONSTRAINT uq_application_expert_reports_app_run
  UNIQUE (application_id, run_id);

-- ── Step 4: Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_app_expert_reports_app_saved
  ON public.application_expert_reports (application_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_expert_reports_user_saved
  ON public.application_expert_reports (user_id, saved_at DESC);

-- ── Step 5: Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.application_expert_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_expert_reports_select_own" ON public.application_expert_reports;
CREATE POLICY "app_expert_reports_select_own"
  ON public.application_expert_reports
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "app_expert_reports_insert_own" ON public.application_expert_reports;
CREATE POLICY "app_expert_reports_insert_own"
  ON public.application_expert_reports
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "app_expert_reports_update_own" ON public.application_expert_reports;
CREATE POLICY "app_expert_reports_update_own"
  ON public.application_expert_reports
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
