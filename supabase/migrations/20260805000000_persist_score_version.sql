-- WP-69 story 6 — persist the scoring regime as stored text.
--
-- `optimizations.ats_version` is an INTEGER and every write site hardcodes it to 2, so
-- 90 days of rows all read `2` no matter which engine scored them. `anonymous_ats_scores`
-- carried no version at all. The regime discipline (WP-45 S9: scores are not comparable
-- across versions) therefore had to classify stored rows by `created_at`, which misbins
-- every row written near a regime change — and a regime change is exactly when the
-- classification matters.
--
-- NO BACKFILL, deliberately. A row whose scorer is unknown stays NULL rather than being
-- inferred from its timestamp. Inferring is the failure this column exists to remove;
-- doing it once here would bake that guess in permanently and make it look measured.

ALTER TABLE public.optimizations
  ADD COLUMN IF NOT EXISTS score_version TEXT;

ALTER TABLE public.anonymous_ats_scores
  ADD COLUMN IF NOT EXISTS score_version TEXT;

COMMENT ON COLUMN public.optimizations.score_version IS
  'SCORE_VERSION of the ATS engine that produced this row (src/lib/ats/core.ts). NULL means unknown — never infer it from created_at.';

COMMENT ON COLUMN public.anonymous_ats_scores.score_version IS
  'SCORE_VERSION of the ATS engine that produced this row (src/lib/ats/core.ts). NULL means unknown — never infer it from created_at.';

CREATE INDEX IF NOT EXISTS idx_optimizations_score_version
  ON public.optimizations(score_version);
