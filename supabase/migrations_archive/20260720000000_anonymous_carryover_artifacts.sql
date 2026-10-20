-- WP-49 / WP-29 S5: carry the anonymous ATS check artifacts through signup.
--
-- Before this migration anonymous_ats_scores stored only resume_hash and
-- job_description_hash, so a converted session could surface the score but the
-- user still had to re-upload the same PDF and re-paste the same job
-- description. These columns hold the parsed text long enough to materialize
-- owned resumes / job_descriptions rows at conversion time.
--
-- Retention: the carried text is cleared as soon as it has been copied into the
-- user's own rows (see src/lib/anonymous-carryover.ts), and unconverted rows
-- still fall under the table's existing 7-day expires_at.

alter table public.anonymous_ats_scores
  add column if not exists resume_text text,
  add column if not exists job_description_text text,
  add column if not exists job_title text,
  add column if not exists job_source_url text,
  add column if not exists resume_id uuid references public.resumes (id) on delete set null,
  add column if not exists job_description_id uuid references public.job_descriptions (id) on delete set null;

comment on column public.anonymous_ats_scores.resume_text is
  'Parsed anonymous resume text, retained only until the session converts or expires.';
comment on column public.anonymous_ats_scores.job_description_text is
  'Anonymous job description text, retained only until the session converts or expires.';
