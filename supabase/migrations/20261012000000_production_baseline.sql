-- Production baseline, 2026-10-13.
--
-- Replaces the 45 earlier migrations (moved to supabase/migrations_archive/,
-- kept for history, no longer replayed). Those files could not rebuild a
-- fresh database: 20250915000002 and 20251025080000 had statements Postgres
-- rejects, and the 2026-01-04 remote_schema dumps fail on replay. The repo
-- and production histories had also drifted (several repo versions differ
-- from production's supabase_migrations.schema_migrations).
--
-- Part 1 is `supabase db dump --linked` of production (schema only, CLI
-- 2.114.0). Part 2 adds what that dump leaves out: the auth.users trigger,
-- storage buckets and policies, and the two template catalogs, each copied
-- from production with read-only queries.
--
-- Production already has all of this. After merge, production's history is
-- repaired to mark this version applied (see the PR); it is never run there.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."conversation_role" AS ENUM (
    'user',
    'assistant',
    'system'
);


ALTER TYPE "public"."conversation_role" OWNER TO "postgres";


CREATE TYPE "public"."experience_level" AS ENUM (
    'beginner',
    'intermediate',
    'advanced'
);


ALTER TYPE "public"."experience_level" OWNER TO "postgres";


CREATE TYPE "public"."goal_type" AS ENUM (
    'habit',
    'distance',
    'speed'
);


ALTER TYPE "public"."goal_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."applications_update_search"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.search := to_tsvector('simple', coalesce(NEW.job_title,'') || ' ' || coalesce(NEW.company_name,''));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."applications_update_search"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."applications_update_search"() IS 'Updates full-text search vector. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."assign_default_template"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  default_template_id UUID;
BEGIN
  -- Get the default template (highest ATS score)
  SELECT id INTO default_template_id
  FROM design_templates
  ORDER BY ats_compatibility_score DESC, created_at ASC
  LIMIT 1;

  -- Only insert if we found a template
  IF default_template_id IS NOT NULL THEN
    INSERT INTO resume_design_assignments (
      user_id,
      optimization_id,
      template_id,
      original_template_id,
      is_active
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      default_template_id,
      default_template_id,
      true
    )
    ON CONFLICT (optimization_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_default_template"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_default_template"() IS 'Automatically assigns the default template (highest ATS score) to new optimizations';



CREATE OR REPLACE FUNCTION "public"."check_subscription_limit"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Check subscription limit (currently disabled - returns TRUE)
    -- Future: Implement actual check against profiles.plan_type
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_subscription_limit"("user_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_subscription_limit"("user_uuid" "uuid") IS 'Checks if user has remaining optimizations. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_files"("bucket_name" "text", "days_old" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE 
    deleted_count INTEGER := 0; 
BEGIN 
    -- Function body preserved as-is
    RETURN deleted_count; 
END; 
$$;


ALTER FUNCTION "public"."cleanup_old_files"("bucket_name" "text", "days_old" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_files"("bucket_name" "text", "days_old" integer) IS 'Cleanup old files from storage bucket - search_path explicitly set for security';



CREATE OR REPLACE FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_reason" "text" DEFAULT 'usage'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_remaining integer;
begin
  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 3)
  on conflict (user_id) do nothing;

  update public.profiles
  set credit_balance = credit_balance - 1,
      updated_at = now()
  where user_id = p_user_id
    and credit_balance > 0
  returning credit_balance into v_remaining;

  if not found then
    return null;
  end if;

  insert into public.credit_transactions (user_id, delta, reason, source)
  values (p_user_id, -1, coalesce(nullif(trim(p_reason), ''), 'usage'), 'usage');

  return v_remaining;
end;
$$;


ALTER FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_file_path"("user_uuid" "uuid", "filename" "text", "file_type" "text" DEFAULT 'upload'::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE 
  clean_filename TEXT; 
  timestamp_suffix TEXT; 
  file_extension TEXT; 
BEGIN
  file_extension := lower(split_part(filename, '.', -1));
  clean_filename := regexp_replace(split_part(filename, '.', 1), '[^a-zA-Z0-9_-]', '_', 'g');
  timestamp_suffix := extract(epoch from now())::text;
  RETURN user_uuid::text || '/' || file_type || '_' || clean_filename || '_' || timestamp_suffix || '.' || file_extension;
END;
$$;


ALTER FUNCTION "public"."generate_file_path"("user_uuid" "uuid", "filename" "text", "file_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_file_path"("user_uuid" "uuid", "filename" "text", "file_type" "text") IS 'Generates unique file path. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_ats_improvement"("optimization_id" "uuid") RETURNS real
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_original REAL;
  v_optimized REAL;
BEGIN
  SELECT ats_score_original, ats_score_optimized
  INTO v_original, v_optimized
  FROM optimizations
  WHERE id = optimization_id;

  IF v_original IS NULL OR v_optimized IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_optimized - v_original;
END;
$$;


ALTER FUNCTION "public"."get_ats_improvement"("optimization_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ats_improvement"("optimization_id" "uuid") IS 'Gets ATS score improvement. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."grant_apple_credits"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source" "text", "p_apple_transaction_id" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_remaining integer;
  v_rows integer;
begin
  if p_delta <= 0 then
    raise exception 'p_delta must be positive';
  end if;

  if p_apple_transaction_id is null or length(trim(p_apple_transaction_id)) = 0 then
    raise exception 'p_apple_transaction_id is required';
  end if;

  insert into public.profiles (id, user_id, plan_type, optimizations_used, credit_balance)
  values (gen_random_uuid(), p_user_id, 'free', 0, 3)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (
    user_id,
    delta,
    reason,
    source,
    apple_transaction_id
  )
  values (
    p_user_id,
    p_delta,
    coalesce(nullif(trim(p_reason), ''), 'iap_purchase'),
    coalesce(nullif(trim(p_source), ''), 'apple_iap'),
    trim(p_apple_transaction_id)
  )
  on conflict (apple_transaction_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.profiles
    set credit_balance = credit_balance + p_delta,
        updated_at = now()
    where user_id = p_user_id
    returning credit_balance into v_remaining;
  else
    select credit_balance
      into v_remaining
    from public.profiles
    where user_id = p_user_id;
  end if;

  return coalesce(v_remaining, 0);
end;
$$;


ALTER FUNCTION "public"."grant_apple_credits"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source" "text", "p_apple_transaction_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_optimization_usage"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Increment optimization usage (currently disabled - returns TRUE)
    -- Future: Implement actual increment
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."increment_optimization_usage"("user_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_optimization_usage"("user_uuid" "uuid") IS 'Increments optimization usage counter (currently disabled). Uses SET search_path for security.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text",
    "role" "text",
    "plan_type" "text" DEFAULT 'free'::"text",
    "optimizations_used" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "name" "text",
    "goal" "text",
    "experience" "text",
    "preferred_times" "text"[] DEFAULT '{}'::"text"[],
    "days_per_week" integer DEFAULT 3,
    "consents" "jsonb" DEFAULT '{"data": false, "gdpr": false, "push": false}'::"jsonb",
    "onboarding_complete" boolean DEFAULT false,
    "timezone" "text" DEFAULT 'UTC'::"text",
    "motivations" "text"[] DEFAULT '{}'::"text"[],
    "barriers" "text"[] DEFAULT '{}'::"text"[],
    "coaching_style" "text",
    "goal_inferred" boolean DEFAULT false,
    "credit_balance" integer DEFAULT 3 NOT NULL,
    CONSTRAINT "profiles_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['free'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_optimizations_used"("user_id_param" "uuid", "max_allowed" integer) RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  updated_profile profiles;
BEGIN
  -- Atomic update: only increment if under quota
  -- This prevents race conditions where multiple requests could bypass the limit
  UPDATE profiles
  SET
    optimizations_used = optimizations_used + 1,
    updated_at = NOW()
  WHERE
    user_id = user_id_param
    AND plan_type = 'free'
    AND optimizations_used < max_allowed
  RETURNING * INTO updated_profile;

  -- Return the updated profile (NULL if no row was updated)
  RETURN updated_profile;
END;
$$;


ALTER FUNCTION "public"."increment_optimizations_used"("user_id_param" "uuid", "max_allowed" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_optimizations_used"("user_id_param" "uuid", "max_allowed" integer) IS 'Atomically increments optimizations_used for free tier users. Returns NULL if quota exceeded or user is not on free plan.';



CREATE OR REPLACE FUNCTION "public"."increment_rate_limit"("p_identifier" "text", "p_endpoint" "text", "p_window_ms" bigint) RETURNS TABLE("requests_count" integer, "window_start" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_now timestamptz := now();
  v_requests_count integer;
  v_window_start timestamptz;
begin
  insert into public.rate_limits (identifier, endpoint, requests_count, window_start)
  values (p_identifier, p_endpoint, 1, v_now)
  on conflict (identifier, endpoint) do update
    set
      window_start = case
        when public.rate_limits.window_start < v_now - (p_window_ms * interval '1 millisecond')
          then v_now
        else public.rate_limits.window_start
      end,
      requests_count = case
        when public.rate_limits.window_start < v_now - (p_window_ms * interval '1 millisecond')
          then 1
        else public.rate_limits.requests_count + 1
      end
  returning public.rate_limits.requests_count, public.rate_limits.window_start
  into v_requests_count, v_window_start;

  return query select v_requests_count, v_window_start;
end;
$$;


ALTER FUNCTION "public"."increment_rate_limit"("p_identifier" "text", "p_endpoint" "text", "p_window_ms" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_ats_v2"("optimization_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_version INTEGER;
BEGIN
  SELECT ats_version INTO v_version
  FROM optimizations
  WHERE id = optimization_id;

  RETURN COALESCE(v_version, 1) >= 2;
END;
$$;


ALTER FUNCTION "public"."is_ats_v2"("optimization_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_ats_v2"("optimization_id" "uuid") IS 'Checks if optimization uses ATS v2. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."update_applications_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_applications_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_applications_updated_at"() IS 'Trigger to update updated_at timestamp. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."update_session_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE chat_sessions
  SET last_activity_at = NOW(), updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_session_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_shadow_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "intent" "text"[],
    "ats_before" integer,
    "ats_after" integer,
    "diff_count" integer,
    "warnings" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_shadow_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "openai_thread_id" character varying(255) NOT NULL,
    "openai_assistant_id" character varying(255),
    "status" character varying(50) DEFAULT 'active'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone,
    CONSTRAINT "ai_threads_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'archived'::character varying, 'error'::character varying])::"text"[])))
);


ALTER TABLE "public"."ai_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amendment_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "target_section" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "rejection_reason" "text",
    CONSTRAINT "amendment_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'applied'::"text", 'rejected'::"text", 'needs_clarification'::"text"]))),
    CONSTRAINT "amendment_requests_type_check" CHECK (("type" = ANY (ARRAY['add'::"text", 'modify'::"text", 'remove'::"text", 'clarify'::"text"])))
);


ALTER TABLE "public"."amendment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anonymous_ats_scores" (
    "id" bigint NOT NULL,
    "session_id" "text" NOT NULL,
    "ip_address" "text" NOT NULL,
    "ats_score" integer NOT NULL,
    "ats_subscores" "jsonb" NOT NULL,
    "ats_suggestions" "jsonb" NOT NULL,
    "resume_hash" "text" NOT NULL,
    "job_description_hash" "text" NOT NULL,
    "user_id" "uuid",
    "optimization_id" "uuid",
    "converted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "ats_quick_wins" "jsonb" DEFAULT '[]'::"jsonb",
    "resume_text" "text",
    "job_description_text" "text",
    "job_title" "text",
    "job_source_url" "text",
    "resume_id" "uuid",
    "job_description_id" "uuid"
);


ALTER TABLE "public"."anonymous_ats_scores" OWNER TO "postgres";


COMMENT ON COLUMN "public"."anonymous_ats_scores"."ats_quick_wins" IS 'AI-generated quick win suggestions with before/after text improvements';



COMMENT ON COLUMN "public"."anonymous_ats_scores"."resume_text" IS 'Parsed anonymous resume text, retained only until the session converts or expires.';



COMMENT ON COLUMN "public"."anonymous_ats_scores"."job_description_text" IS 'Anonymous job description text, retained only until the session converts or expires.';



CREATE SEQUENCE IF NOT EXISTS "public"."anonymous_ats_scores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."anonymous_ats_scores_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."anonymous_ats_scores_id_seq" OWNED BY "public"."anonymous_ats_scores"."id";



CREATE TABLE IF NOT EXISTS "public"."application_expert_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "run_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "workflow_type" "text" NOT NULL,
    "report_title" "text" DEFAULT ''::"text" NOT NULL,
    "report_summary" "text" DEFAULT ''::"text" NOT NULL,
    "report_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ats_score_before" numeric(5,2),
    "ats_score_after" numeric(5,2),
    "ats_score_delta" numeric(5,2),
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asset_type" "text",
    "asset_json" "jsonb",
    CONSTRAINT "application_expert_reports_asset_type_check" CHECK ((("asset_type" IS NULL) OR ("asset_type" = ANY (ARRAY['cover_letter'::"text", 'screening_answers'::"text", 'outreach_kit'::"text", 'story_bank'::"text"])))),
    CONSTRAINT "application_expert_reports_workflow_type_check" CHECK (("workflow_type" = ANY (ARRAY['full_resume_rewrite'::"text", 'achievement_quantifier'::"text", 'ats_optimization_report'::"text", 'professional_summary_lab'::"text", 'cover_letter_architect'::"text", 'screening_answer_studio'::"text", 'recruiter_outreach_kit'::"text", 'interview_story_bank'::"text"])))
);


ALTER TABLE "public"."application_expert_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid",
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "applied_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_title" "text",
    "company_name" "text",
    "job_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resume_html_path" "text",
    "resume_json_path" "text",
    "ats_score" numeric,
    "contact" "jsonb",
    "search" "tsvector",
    "source_url" "text",
    "job_extraction" "jsonb",
    "apply_clicked_at" timestamp with time zone,
    "optimized_resume_id" "uuid",
    "optimized_resume_url" "text"
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "extensions"."citext" NOT NULL,
    "experience_level" "text",
    "goals" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "referral_source" "text",
    "accepted_terms" boolean DEFAULT false NOT NULL,
    "accepted_privacy" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "waitlist_position" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beta_signups" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."beta_signups_waitlist_position_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."beta_signups_waitlist_position_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."beta_signups_waitlist_position_seq" OWNED BY "public"."beta_signups"."waitlist_position";



CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb",
    CONSTRAINT "chat_messages_sender_check" CHECK (("sender" = ANY (ARRAY['user'::"text", 'ai'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context" "jsonb",
    "thread_id" "text",
    "assistant_id" "text",
    "resume_context" "jsonb" DEFAULT '{}'::"jsonb",
    "openai_thread_id" character varying(255),
    CONSTRAINT "chat_sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."chat_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_sessions" IS 'Chat sessions with OpenAI Assistants API integration for resume editing';



COMMENT ON COLUMN "public"."chat_sessions"."thread_id" IS 'OpenAI Assistants API thread ID for conversation persistence';



COMMENT ON COLUMN "public"."chat_sessions"."assistant_id" IS 'OpenAI Assistants API assistant ID';



COMMENT ON COLUMN "public"."chat_sessions"."resume_context" IS 'Resume state and changes made during this session';



CREATE TABLE IF NOT EXISTS "public"."content_modifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "message_id" "uuid",
    "operation" character varying(50) NOT NULL,
    "field_path" character varying(500) NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "reason" "text",
    "intent" character varying(100),
    "ats_score_before" numeric(5,2),
    "ats_score_after" numeric(5,2),
    "score_change" numeric(5,2) GENERATED ALWAYS AS (("ats_score_after" - "ats_score_before")) STORED,
    "applied_by" character varying(50) DEFAULT 'ai_assistant'::character varying,
    "is_reverted" boolean DEFAULT false,
    "reverted_at" timestamp with time zone,
    "reverted_by_modification_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_modifications_applied_by_check" CHECK ((("applied_by")::"text" = ANY ((ARRAY['ai_assistant'::character varying, 'user'::character varying, 'system'::character varying])::"text"[]))),
    CONSTRAINT "content_modifications_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['replace'::character varying, 'prefix'::character varying, 'suffix'::character varying, 'append'::character varying, 'insert'::character varying, 'remove'::character varying])::"text"[]))),
    CONSTRAINT "valid_score_range" CHECK (((("ats_score_before" IS NULL) OR (("ats_score_before" >= (0)::numeric) AND ("ats_score_before" <= (100)::numeric))) AND (("ats_score_after" IS NULL) OR (("ats_score_after" >= (0)::numeric) AND ("ats_score_after" <= (100)::numeric)))))
);


ALTER TABLE "public"."content_modifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "token_count" integer,
    "ai_context" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversation_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."conversation_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "title" "text",
    "context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "delta" integer NOT NULL,
    "reason" "text" NOT NULL,
    "source" "text" DEFAULT 'system'::"text" NOT NULL,
    "apple_transaction_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "customization" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."design_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."design_assignments" IS 'Stores color/font customizations for optimizations (Spec 008)';



COMMENT ON COLUMN "public"."design_assignments"."customization" IS 'JSONB storing colors, fonts, spacing: {"colors": {"background": "#fff", "primary": "#000"}, "fonts": {"heading": "Arial"}}';



CREATE TABLE IF NOT EXISTS "public"."design_customizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "color_scheme" "jsonb" DEFAULT '{"accent": "#0ea5e9", "primary": "#2563eb", "secondary": "#64748b"}'::"jsonb" NOT NULL,
    "font_family" "jsonb" DEFAULT '{"body": "Arial", "headings": "Arial"}'::"jsonb" NOT NULL,
    "spacing" "jsonb" DEFAULT '{"compact": false, "lineHeight": 1.5}'::"jsonb" NOT NULL,
    "layout_variant" character varying(100),
    "custom_css" "text",
    "is_ats_safe" boolean DEFAULT true NOT NULL,
    "ats_validation_errors" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."design_customizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "category" character varying(50) NOT NULL,
    "description" "text" NOT NULL,
    "file_path" character varying(500) NOT NULL,
    "preview_thumbnail_url" "text",
    "is_premium" boolean DEFAULT false NOT NULL,
    "ats_compatibility_score" integer DEFAULT 100 NOT NULL,
    "supported_customizations" "jsonb" DEFAULT '{"fonts": true, "colors": true, "layout": true}'::"jsonb" NOT NULL,
    "default_config" "jsonb" DEFAULT '{"font_family": {"body": "Arial", "headings": "Arial"}, "color_scheme": {"accent": "#0ea5e9", "primary": "#2563eb", "secondary": "#64748b"}, "spacing_settings": {"compact": false, "lineHeight": 1.5}}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "design_templates_ats_compatibility_score_check" CHECK ((("ats_compatibility_score" >= 0) AND ("ats_compatibility_score" <= 100))),
    CONSTRAINT "design_templates_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['modern'::character varying, 'traditional'::character varying, 'creative'::character varying, 'corporate'::character varying])::"text"[])))
);


ALTER TABLE "public"."design_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "apns_token" "text" NOT NULL,
    "platform" "text" DEFAULT 'ios'::"text" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "payload_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expert_workflow_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "artifact_type" "text" NOT NULL,
    "artifact_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expert_workflow_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expert_workflow_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "workflow_type" "text" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "input_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "missing_evidence_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_at" timestamp with time zone,
    "ats_score_before" numeric(5,2),
    "ats_score_after" numeric(5,2),
    "updated_fields_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "apply_mode" "text",
    "selection_index" integer,
    "applied_assets_json" "jsonb",
    CONSTRAINT "expert_workflow_runs_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'needs_user_input'::"text", 'failed'::"text"]))),
    CONSTRAINT "expert_workflow_runs_workflow_type_check" CHECK (("workflow_type" = ANY (ARRAY['full_resume_rewrite'::"text", 'achievement_quantifier'::"text", 'ats_optimization_report'::"text", 'professional_summary_lab'::"text", 'cover_letter_architect'::"text", 'screening_answer_studio'::"text", 'recruiter_outreach_kit'::"text", 'interview_story_bank'::"text"])))
);


ALTER TABLE "public"."expert_workflow_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."idempotency_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "operation_type" "text" NOT NULL,
    "result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL
);


ALTER TABLE "public"."idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_descriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "source_url" "text",
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "raw_text" "text" NOT NULL,
    "clean_text" "text" NOT NULL,
    "parsed_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "embeddings" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_descriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "subscribed_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "newsletter_subscribers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'unsubscribed'::"text"])))
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."optimization_review_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "resume_id" "uuid" NOT NULL,
    "jd_id" "uuid" NOT NULL,
    "original_resume_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "optimized_resume_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "grouped_changes_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ats_preview_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_at" timestamp with time zone
);


ALTER TABLE "public"."optimization_review_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."optimizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "resume_id" "uuid",
    "jd_id" "uuid",
    "match_score" numeric(5,2) NOT NULL,
    "gaps_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rewrite_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "template_key" "text" NOT NULL,
    "output_paths" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'processing'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resume_text" "text",
    "jd_text" "text",
    "ats_score_original" real,
    "ats_score_optimized" real,
    "ats_subscores" "jsonb",
    "ats_suggestions" "jsonb",
    "ats_confidence" real,
    "ats_version" integer DEFAULT 2,
    "ats_subscores_original" "jsonb",
    "ai_modification_count" integer DEFAULT 0,
    "language_preference" "text" DEFAULT 'auto'::"text",
    CONSTRAINT "check_ats_confidence_range" CHECK ((("ats_confidence" IS NULL) OR (("ats_confidence" >= (0)::double precision) AND ("ats_confidence" <= (1)::double precision)))),
    CONSTRAINT "check_ats_score_optimized_range" CHECK ((("ats_score_optimized" IS NULL) OR (("ats_score_optimized" >= (0)::double precision) AND ("ats_score_optimized" <= (100)::double precision)))),
    CONSTRAINT "check_ats_score_original_range" CHECK ((("ats_score_original" IS NULL) OR (("ats_score_original" >= (0)::double precision) AND ("ats_score_original" <= (100)::double precision)))),
    CONSTRAINT "optimizations_language_preference_check" CHECK (("language_preference" = ANY (ARRAY['auto'::"text", 'hebrew'::"text", 'english'::"text"]))),
    CONSTRAINT "optimizations_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."optimizations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."optimizations"."ats_score_original" IS 'ATS match score for original resume (0-100). Version 2+ only.';



COMMENT ON COLUMN "public"."optimizations"."ats_score_optimized" IS 'ATS match score for optimized resume (0-100). Version 2+ only.';



COMMENT ON COLUMN "public"."optimizations"."ats_subscores" IS 'JSON object containing all 8 sub-scores: keyword_exact, keyword_phrase, semantic_relevance, title_alignment, metrics_presence, section_completeness, format_parseability, recency_fit';



COMMENT ON COLUMN "public"."optimizations"."ats_suggestions" IS 'JSON array of actionable suggestions to improve ATS score. Each suggestion has: id, text, estimated_gain, targets, quick_win, category';



COMMENT ON COLUMN "public"."optimizations"."ats_confidence" IS 'Confidence in the ATS score (0.0-1.0). Lower when data quality is poor.';



COMMENT ON COLUMN "public"."optimizations"."ats_version" IS 'Scoring system version: 1 = legacy single score, 2 = multi-dimensional scoring';



COMMENT ON COLUMN "public"."optimizations"."ats_subscores_original" IS 'JSON object containing all 8 sub-scores for the original (unoptimized) resume';



CREATE OR REPLACE VIEW "public"."optimizations_with_ats_v2" WITH ("security_invoker"='true') AS
 SELECT "id",
    "user_id",
    "resume_id",
    "jd_id",
    "created_at",
    "status",
    "template_key",
    "match_score" AS "legacy_score",
    "ats_version",
    "ats_score_original",
    "ats_score_optimized",
        CASE
            WHEN (("ats_score_original" IS NOT NULL) AND ("ats_score_optimized" IS NOT NULL)) THEN ("ats_score_optimized" - "ats_score_original")
            ELSE NULL::real
        END AS "ats_score_improvement",
    ("ats_subscores" -> 'keyword_exact'::"text") AS "subscore_keyword_exact",
    ("ats_subscores" -> 'keyword_phrase'::"text") AS "subscore_keyword_phrase",
    ("ats_subscores" -> 'semantic_relevance'::"text") AS "subscore_semantic_relevance",
    ("ats_subscores" -> 'title_alignment'::"text") AS "subscore_title_alignment",
    ("ats_subscores" -> 'metrics_presence'::"text") AS "subscore_metrics_presence",
    ("ats_subscores" -> 'section_completeness'::"text") AS "subscore_section_completeness",
    ("ats_subscores" -> 'format_parseability'::"text") AS "subscore_format_parseability",
    ("ats_subscores" -> 'recency_fit'::"text") AS "subscore_recency_fit",
    "ats_subscores",
    "ats_suggestions",
    "ats_confidence"
   FROM "public"."optimizations" "o";


ALTER VIEW "public"."optimizations_with_ats_v2" OWNER TO "postgres";


COMMENT ON VIEW "public"."optimizations_with_ats_v2" IS 'ATS scoring view with security_invoker=true to use querying user permissions and respect RLS';



CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "total_weeks" integer NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "plan_type" "text" DEFAULT 'basic'::"text" NOT NULL,
    "complexity_level" "text" DEFAULT 'basic'::"text",
    "complexity_score" integer DEFAULT 0,
    "target_distance" numeric,
    "target_time" integer,
    "fitness_level" "text",
    "training_days_per_week" integer,
    "peak_weekly_volume" numeric,
    "created_in_timezone" "text" DEFAULT 'UTC'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plans_complexity_level_check" CHECK (("complexity_level" = ANY (ARRAY['basic'::"text", 'standard'::"text", 'advanced'::"text"]))),
    CONSTRAINT "plans_complexity_score_check" CHECK ((("complexity_score" >= 0) AND ("complexity_score" <= 100))),
    CONSTRAINT "plans_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['basic'::"text", 'advanced'::"text", 'periodized'::"text"]))),
    CONSTRAINT "plans_training_days_per_week_check" CHECK ((("training_days_per_week" >= 1) AND ("training_days_per_week" <= 7)))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" bigint NOT NULL,
    "identifier" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "requests_count" integer DEFAULT 1 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rate_limits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rate_limits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rate_limits_id_seq" OWNED BY "public"."rate_limits"."id";



CREATE TABLE IF NOT EXISTS "public"."resume_design_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "customization_id" "uuid",
    "previous_customization_id" "uuid",
    "original_template_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "finalized_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resume_design_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resume_versions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "version_number" integer NOT NULL,
    "content" "jsonb" NOT NULL,
    "change_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resume_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resumes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "filename" "text" NOT NULL,
    "storage_path" "text",
    "raw_text" "text",
    "canonical_data" "jsonb" DEFAULT '{}'::"jsonb",
    "embeddings" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."resumes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_resumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid",
    "filename" "text" NOT NULL,
    "display_name" "text",
    "size_bytes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_resumes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."style_customization_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "optimization_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "message_id" "uuid",
    "customization_type" character varying(50) NOT NULL,
    "changes" "jsonb" NOT NULL,
    "previous_customization" "jsonb",
    "request_text" "text",
    "applied_by" character varying(50) DEFAULT 'ai_assistant'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "style_customization_history_customization_type_check" CHECK ((("customization_type")::"text" = ANY ((ARRAY['color'::character varying, 'font'::character varying, 'spacing'::character varying, 'layout'::character varying, 'mixed'::character varying])::"text"[])))
);


ALTER TABLE "public"."style_customization_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "family" "text" NOT NULL,
    "config_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "templates_family_check" CHECK (("family" = ANY (ARRAY['ats'::"text", 'modern'::"text"])))
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "week" integer NOT NULL,
    "day" "text" NOT NULL,
    "type" "text" NOT NULL,
    "distance" numeric NOT NULL,
    "duration" integer,
    "pace" integer,
    "intensity" "text",
    "training_phase" "text",
    "workout_structure" "jsonb",
    "notes" "text",
    "completed" boolean DEFAULT false NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workouts_day_check" CHECK (("day" = ANY (ARRAY['Mon'::"text", 'Tue'::"text", 'Wed'::"text", 'Thu'::"text", 'Fri'::"text", 'Sat'::"text", 'Sun'::"text"]))),
    CONSTRAINT "workouts_intensity_check" CHECK (("intensity" = ANY (ARRAY['easy'::"text", 'moderate'::"text", 'threshold'::"text", 'vo2max'::"text", 'anaerobic'::"text"]))),
    CONSTRAINT "workouts_training_phase_check" CHECK (("training_phase" = ANY (ARRAY['base'::"text", 'build'::"text", 'peak'::"text", 'taper'::"text"]))),
    CONSTRAINT "workouts_type_check" CHECK (("type" = ANY (ARRAY['easy'::"text", 'tempo'::"text", 'intervals'::"text", 'long'::"text", 'time-trial'::"text", 'hill'::"text", 'rest'::"text", 'race-pace'::"text", 'recovery'::"text", 'fartlek'::"text"])))
);


ALTER TABLE "public"."workouts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."anonymous_ats_scores" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."anonymous_ats_scores_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."beta_signups" ALTER COLUMN "waitlist_position" SET DEFAULT "nextval"('"public"."beta_signups_waitlist_position_seq"'::"regclass");



ALTER TABLE ONLY "public"."rate_limits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rate_limits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agent_shadow_logs"
    ADD CONSTRAINT "agent_shadow_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_openai_thread_id_key" UNIQUE ("openai_thread_id");



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amendment_requests"
    ADD CONSTRAINT "amendment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anonymous_ats_scores"
    ADD CONSTRAINT "anonymous_ats_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_expert_reports"
    ADD CONSTRAINT "application_expert_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_signups"
    ADD CONSTRAINT "beta_signups_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."beta_signups"
    ADD CONSTRAINT "beta_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_openai_thread_id_key" UNIQUE ("openai_thread_id");



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_modifications"
    ADD CONSTRAINT "content_modifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_apple_transaction_id_key" UNIQUE ("apple_transaction_id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_assignments"
    ADD CONSTRAINT "design_assignments_optimization_id_key" UNIQUE ("optimization_id");



ALTER TABLE ONLY "public"."design_assignments"
    ADD CONSTRAINT "design_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_customizations"
    ADD CONSTRAINT "design_customizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_templates"
    ADD CONSTRAINT "design_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."design_templates"
    ADD CONSTRAINT "design_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_templates"
    ADD CONSTRAINT "design_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_apns_token_key" UNIQUE ("user_id", "apns_token");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expert_workflow_artifacts"
    ADD CONSTRAINT "expert_workflow_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expert_workflow_runs"
    ADD CONSTRAINT "expert_workflow_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_descriptions"
    ADD CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."optimization_review_runs"
    ADD CONSTRAINT "optimization_review_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."optimizations"
    ADD CONSTRAINT "optimizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_unique" UNIQUE ("identifier", "endpoint");



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_optimization_id_key" UNIQUE ("optimization_id");



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resume_versions"
    ADD CONSTRAINT "resume_versions_optimization_version_unique" UNIQUE ("optimization_id", "version_number");



COMMENT ON CONSTRAINT "resume_versions_optimization_version_unique" ON "public"."resume_versions" IS 'Ensures unique version numbers per optimization (prevents duplicate versions)';



ALTER TABLE ONLY "public"."resume_versions"
    ADD CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_resumes"
    ADD CONSTRAINT "saved_resumes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."style_customization_history"
    ADD CONSTRAINT "style_customization_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_active_session" ON "public"."chat_sessions" USING "btree" ("user_id", "optimization_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_agent_shadow_user_created" ON "public"."agent_shadow_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_ai_threads_openai_thread_id" ON "public"."ai_threads" USING "btree" ("openai_thread_id");



CREATE INDEX "idx_ai_threads_optimization_id" ON "public"."ai_threads" USING "btree" ("optimization_id");



CREATE INDEX "idx_ai_threads_session_id" ON "public"."ai_threads" USING "btree" ("session_id");



CREATE INDEX "idx_ai_threads_status" ON "public"."ai_threads" USING "btree" ("status");



CREATE INDEX "idx_ai_threads_user_id" ON "public"."ai_threads" USING "btree" ("user_id");



CREATE INDEX "idx_amendment_requests_message_id" ON "public"."amendment_requests" USING "btree" ("message_id");



CREATE INDEX "idx_amendment_requests_session_id_fk" ON "public"."amendment_requests" USING "btree" ("session_id");



CREATE INDEX "idx_anon_scores_expiry" ON "public"."anonymous_ats_scores" USING "btree" ("expires_at");



CREATE INDEX "idx_anon_scores_ip" ON "public"."anonymous_ats_scores" USING "btree" ("ip_address", "created_at");



CREATE INDEX "idx_anon_scores_session" ON "public"."anonymous_ats_scores" USING "btree" ("session_id");



CREATE INDEX "idx_anon_scores_user" ON "public"."anonymous_ats_scores" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_application_expert_reports_application_saved" ON "public"."application_expert_reports" USING "btree" ("application_id", "saved_at" DESC);



CREATE UNIQUE INDEX "idx_application_expert_reports_unique_app_run" ON "public"."application_expert_reports" USING "btree" ("application_id", "run_id");



CREATE INDEX "idx_application_expert_reports_user_saved" ON "public"."application_expert_reports" USING "btree" ("user_id", "saved_at" DESC);



CREATE INDEX "idx_applications_applied_date" ON "public"."applications" USING "btree" ("applied_date" DESC);



CREATE INDEX "idx_applications_optimization_id" ON "public"."applications" USING "btree" ("optimization_id");



CREATE INDEX "idx_applications_optimized_resume_id" ON "public"."applications" USING "btree" ("optimized_resume_id");



CREATE INDEX "idx_applications_search" ON "public"."applications" USING "gin" ("search");



CREATE INDEX "idx_applications_source_url" ON "public"."applications" USING "btree" ("source_url");



CREATE INDEX "idx_applications_status" ON "public"."applications" USING "btree" ("status");



CREATE INDEX "idx_applications_user_id" ON "public"."applications" USING "btree" ("user_id");



CREATE INDEX "idx_beta_signups_created_at" ON "public"."beta_signups" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_beta_signups_waitlist_position" ON "public"."beta_signups" USING "btree" ("waitlist_position");



CREATE INDEX "idx_chat_messages_session_id" ON "public"."chat_messages" USING "btree" ("session_id");



CREATE UNIQUE INDEX "idx_chat_sessions_active_unique" ON "public"."chat_sessions" USING "btree" ("user_id", "optimization_id") WHERE ("status" = 'active'::"text");



COMMENT ON INDEX "public"."idx_chat_sessions_active_unique" IS 'Ensures only one active chat session per user+optimization pair';



CREATE INDEX "idx_chat_sessions_assistant_id" ON "public"."chat_sessions" USING "btree" ("assistant_id") WHERE ("assistant_id" IS NOT NULL);



CREATE INDEX "idx_chat_sessions_openai_thread_id" ON "public"."chat_sessions" USING "btree" ("openai_thread_id");



CREATE INDEX "idx_chat_sessions_optimization_id_fk" ON "public"."chat_sessions" USING "btree" ("optimization_id");



CREATE INDEX "idx_chat_sessions_thread_id" ON "public"."chat_sessions" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);



CREATE INDEX "idx_chat_sessions_user_id" ON "public"."chat_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_content_modifications_message_id" ON "public"."content_modifications" USING "btree" ("message_id");



CREATE INDEX "idx_content_modifications_reverted_by_modification_id" ON "public"."content_modifications" USING "btree" ("reverted_by_modification_id");



CREATE INDEX "idx_content_mods_created_at" ON "public"."content_modifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_content_mods_field_path" ON "public"."content_modifications" USING "btree" ("field_path");



CREATE INDEX "idx_content_mods_is_reverted" ON "public"."content_modifications" USING "btree" ("is_reverted") WHERE ("is_reverted" = false);



CREATE INDEX "idx_content_mods_optimization_id" ON "public"."content_modifications" USING "btree" ("optimization_id");



CREATE INDEX "idx_content_mods_session_id" ON "public"."content_modifications" USING "btree" ("session_id");



CREATE INDEX "idx_content_mods_user_id" ON "public"."content_modifications" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_messages_conversation_id" ON "public"."conversation_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_messages_created_at" ON "public"."conversation_messages" USING "btree" ("created_at");



CREATE INDEX "idx_conversations_profile_id" ON "public"."conversations" USING "btree" ("profile_id");



CREATE INDEX "idx_credit_transactions_user_created_at" ON "public"."credit_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_design_assignments_optimization_id" ON "public"."design_assignments" USING "btree" ("optimization_id");



CREATE INDEX "idx_design_assignments_template_id" ON "public"."design_assignments" USING "btree" ("template_id");



CREATE INDEX "idx_design_assignments_user_id" ON "public"."design_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_design_customizations_template_id_fk" ON "public"."design_customizations" USING "btree" ("template_id");



CREATE INDEX "idx_design_templates_category" ON "public"."design_templates" USING "btree" ("category");



CREATE INDEX "idx_device_tokens_user_last_seen" ON "public"."device_tokens" USING "btree" ("user_id", "last_seen_at" DESC);



CREATE INDEX "idx_events_user_id_fk" ON "public"."events" USING "btree" ("user_id");



CREATE INDEX "idx_expert_artifacts_run" ON "public"."expert_workflow_artifacts" USING "btree" ("run_id", "created_at" DESC);



CREATE INDEX "idx_expert_runs_optimization" ON "public"."expert_workflow_runs" USING "btree" ("optimization_id", "created_at" DESC);



CREATE INDEX "idx_expert_runs_user_created" ON "public"."expert_workflow_runs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_expert_runs_workflow_type" ON "public"."expert_workflow_runs" USING "btree" ("workflow_type");



CREATE INDEX "idx_idempotency_keys_expires_at" ON "public"."idempotency_keys" USING "btree" ("expires_at");



CREATE INDEX "idx_idempotency_keys_key" ON "public"."idempotency_keys" USING "btree" ("key");



CREATE INDEX "idx_job_descriptions_user_id_fk" ON "public"."job_descriptions" USING "btree" ("user_id");



CREATE INDEX "idx_newsletter_subscribers_email" ON "public"."newsletter_subscribers" USING "btree" ("email");



CREATE INDEX "idx_newsletter_subscribers_status" ON "public"."newsletter_subscribers" USING "btree" ("status");



CREATE INDEX "idx_optimization_review_runs_jd" ON "public"."optimization_review_runs" USING "btree" ("jd_id", "created_at" DESC);



CREATE INDEX "idx_optimization_review_runs_resume" ON "public"."optimization_review_runs" USING "btree" ("resume_id", "created_at" DESC);



CREATE INDEX "idx_optimization_review_runs_user_created" ON "public"."optimization_review_runs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_optimizations_ats_score_optimized" ON "public"."optimizations" USING "btree" ("ats_score_optimized") WHERE ("ats_score_optimized" IS NOT NULL);



CREATE INDEX "idx_optimizations_ats_subscores_gin" ON "public"."optimizations" USING "gin" ("ats_subscores");



CREATE INDEX "idx_optimizations_ats_subscores_original_gin" ON "public"."optimizations" USING "gin" ("ats_subscores_original");



CREATE INDEX "idx_optimizations_ats_suggestions_gin" ON "public"."optimizations" USING "gin" ("ats_suggestions");



CREATE INDEX "idx_optimizations_ats_version" ON "public"."optimizations" USING "btree" ("ats_version");



CREATE INDEX "idx_optimizations_created_at" ON "public"."optimizations" USING "btree" ("created_at");



CREATE INDEX "idx_optimizations_jd_id" ON "public"."optimizations" USING "btree" ("jd_id");



CREATE INDEX "idx_optimizations_jd_id_fk" ON "public"."optimizations" USING "btree" ("jd_id");



CREATE INDEX "idx_optimizations_modification_count" ON "public"."optimizations" USING "btree" ("ai_modification_count");



CREATE INDEX "idx_optimizations_resume_id_fk" ON "public"."optimizations" USING "btree" ("resume_id");



CREATE INDEX "idx_optimizations_score" ON "public"."optimizations" USING "btree" ("match_score") WHERE ("match_score" IS NOT NULL);



CREATE INDEX "idx_optimizations_user_created" ON "public"."optimizations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_optimizations_user_id" ON "public"."optimizations" USING "btree" ("user_id");



CREATE INDEX "idx_plans_is_active" ON "public"."plans" USING "btree" ("is_active");



CREATE INDEX "idx_plans_profile_id" ON "public"."plans" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "idx_plans_single_active" ON "public"."plans" USING "btree" ("profile_id") WHERE ("is_active" = true);



CREATE INDEX "idx_profiles_auth_user_id" ON "public"."profiles" USING "btree" ("auth_user_id");



CREATE INDEX "idx_profiles_onboarding_complete" ON "public"."profiles" USING "btree" ("onboarding_complete");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limits_lookup" ON "public"."rate_limits" USING "btree" ("identifier", "endpoint", "window_start");



CREATE INDEX "idx_resume_design_assignments_customization_id_fk" ON "public"."resume_design_assignments" USING "btree" ("customization_id");



CREATE INDEX "idx_resume_design_assignments_optimization_id" ON "public"."resume_design_assignments" USING "btree" ("optimization_id");



CREATE INDEX "idx_resume_design_assignments_original_template_id_performance" ON "public"."resume_design_assignments" USING "btree" ("original_template_id");



COMMENT ON INDEX "public"."idx_resume_design_assignments_original_template_id_performance" IS 'Performance index for template history tracking queries. Addresses Supabase advisor warning about missing foreign key index.';



CREATE INDEX "idx_resume_design_assignments_previous_customization_id_fk" ON "public"."resume_design_assignments" USING "btree" ("previous_customization_id");



CREATE INDEX "idx_resume_design_assignments_template_id_performance" ON "public"."resume_design_assignments" USING "btree" ("template_id");



COMMENT ON INDEX "public"."idx_resume_design_assignments_template_id_performance" IS 'Performance index for JOIN operations between assignments and templates. Addresses Supabase advisor warning about missing foreign key index.';



CREATE INDEX "idx_resume_design_assignments_user_id_fk" ON "public"."resume_design_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_resume_design_assignments_user_optimization" ON "public"."resume_design_assignments" USING "btree" ("user_id", "optimization_id");



COMMENT ON INDEX "public"."idx_resume_design_assignments_user_optimization" IS 'Speeds up queries filtering by both user_id and optimization_id';



CREATE INDEX "idx_resume_versions_session_id_fk" ON "public"."resume_versions" USING "btree" ("session_id");



CREATE INDEX "idx_resumes_user_id_fk" ON "public"."resumes" USING "btree" ("user_id");



CREATE INDEX "idx_session_messages" ON "public"."chat_messages" USING "btree" ("session_id", "created_at");



CREATE INDEX "idx_style_customization_history_message_id" ON "public"."style_customization_history" USING "btree" ("message_id");



CREATE INDEX "idx_style_customization_history_session_id" ON "public"."style_customization_history" USING "btree" ("session_id");



CREATE INDEX "idx_style_history_created_at" ON "public"."style_customization_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_style_history_optimization_id" ON "public"."style_customization_history" USING "btree" ("optimization_id");



CREATE INDEX "idx_style_history_type" ON "public"."style_customization_history" USING "btree" ("customization_type");



CREATE INDEX "idx_style_history_user_id" ON "public"."style_customization_history" USING "btree" ("user_id");



CREATE INDEX "idx_user_sessions" ON "public"."chat_sessions" USING "btree" ("user_id", "last_activity_at" DESC);



CREATE UNIQUE INDEX "idx_version_number" ON "public"."resume_versions" USING "btree" ("optimization_id", "version_number");



CREATE INDEX "idx_workouts_plan_id" ON "public"."workouts" USING "btree" ("plan_id");



CREATE INDEX "idx_workouts_scheduled_date" ON "public"."workouts" USING "btree" ("scheduled_date");



CREATE INDEX "saved_resumes_created_at_idx" ON "public"."saved_resumes" USING "btree" ("created_at" DESC);



CREATE INDEX "saved_resumes_user_id_idx" ON "public"."saved_resumes" USING "btree" ("user_id");



CREATE UNIQUE INDEX "unique_active_thread_per_optimization" ON "public"."ai_threads" USING "btree" ("optimization_id", "status") WHERE (("status")::"text" = 'active'::"text");



CREATE OR REPLACE TRIGGER "applications_update_search_trigger" BEFORE INSERT OR UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."applications_update_search"();



CREATE OR REPLACE TRIGGER "on_message_created" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_activity"();



CREATE OR REPLACE TRIGGER "trigger_assign_default_template" AFTER INSERT ON "public"."optimizations" FOR EACH ROW EXECUTE FUNCTION "public"."assign_default_template"();



COMMENT ON TRIGGER "trigger_assign_default_template" ON "public"."optimizations" IS 'Assigns default design template when optimization is created';



CREATE OR REPLACE TRIGGER "trigger_update_session_activity" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_activity"();



CREATE OR REPLACE TRIGGER "update_applications_updated_at_trigger" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_applications_updated_at"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_design_assignments_updated_at" BEFORE UPDATE ON "public"."design_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_design_templates_updated_at" BEFORE UPDATE ON "public"."design_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expert_workflow_runs_updated_at" BEFORE UPDATE ON "public"."expert_workflow_runs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_job_descriptions_updated_at" BEFORE UPDATE ON "public"."job_descriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_newsletter_subscribers_updated_at" BEFORE UPDATE ON "public"."newsletter_subscribers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_optimizations_updated_at" BEFORE UPDATE ON "public"."optimizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_resume_design_assignments_updated_at" BEFORE UPDATE ON "public"."resume_design_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_resumes_updated_at" BEFORE UPDATE ON "public"."resumes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_templates_updated_at" BEFORE UPDATE ON "public"."templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workouts_updated_at" BEFORE UPDATE ON "public"."workouts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."amendment_requests"
    ADD CONSTRAINT "amendment_requests_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."amendment_requests"
    ADD CONSTRAINT "amendment_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anonymous_ats_scores"
    ADD CONSTRAINT "anonymous_ats_scores_job_description_id_fkey" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."anonymous_ats_scores"
    ADD CONSTRAINT "anonymous_ats_scores_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."anonymous_ats_scores"
    ADD CONSTRAINT "anonymous_ats_scores_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."anonymous_ats_scores"
    ADD CONSTRAINT "anonymous_ats_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_expert_reports"
    ADD CONSTRAINT "application_expert_reports_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_expert_reports"
    ADD CONSTRAINT "application_expert_reports_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_expert_reports"
    ADD CONSTRAINT "application_expert_reports_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."expert_workflow_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_expert_reports"
    ADD CONSTRAINT "application_expert_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_optimized_resume_id_fkey" FOREIGN KEY ("optimized_resume_id") REFERENCES "public"."optimizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_modifications"
    ADD CONSTRAINT "content_modifications_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_modifications"
    ADD CONSTRAINT "content_modifications_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_modifications"
    ADD CONSTRAINT "content_modifications_reverted_by_modification_id_fkey" FOREIGN KEY ("reverted_by_modification_id") REFERENCES "public"."content_modifications"("id");



ALTER TABLE ONLY "public"."content_modifications"
    ADD CONSTRAINT "content_modifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_modifications"
    ADD CONSTRAINT "content_modifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_assignments"
    ADD CONSTRAINT "design_assignments_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_assignments"
    ADD CONSTRAINT "design_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."design_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."design_assignments"
    ADD CONSTRAINT "design_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_customizations"
    ADD CONSTRAINT "design_customizations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."design_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expert_workflow_artifacts"
    ADD CONSTRAINT "expert_workflow_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."expert_workflow_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expert_workflow_runs"
    ADD CONSTRAINT "expert_workflow_runs_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expert_workflow_runs"
    ADD CONSTRAINT "expert_workflow_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_descriptions"
    ADD CONSTRAINT "job_descriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."optimization_review_runs"
    ADD CONSTRAINT "optimization_review_runs_jd_id_fkey" FOREIGN KEY ("jd_id") REFERENCES "public"."job_descriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."optimization_review_runs"
    ADD CONSTRAINT "optimization_review_runs_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."optimization_review_runs"
    ADD CONSTRAINT "optimization_review_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."optimizations"
    ADD CONSTRAINT "optimizations_jd_id_fkey" FOREIGN KEY ("jd_id") REFERENCES "public"."job_descriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."optimizations"
    ADD CONSTRAINT "optimizations_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."optimizations"
    ADD CONSTRAINT "optimizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_customization_id_fkey" FOREIGN KEY ("customization_id") REFERENCES "public"."design_customizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_original_template_id_fkey" FOREIGN KEY ("original_template_id") REFERENCES "public"."design_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_previous_customization_id_fkey" FOREIGN KEY ("previous_customization_id") REFERENCES "public"."design_customizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."design_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."resume_design_assignments"
    ADD CONSTRAINT "resume_design_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_versions"
    ADD CONSTRAINT "resume_versions_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_versions"
    ADD CONSTRAINT "resume_versions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_resumes"
    ADD CONSTRAINT "saved_resumes_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."saved_resumes"
    ADD CONSTRAINT "saved_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."style_customization_history"
    ADD CONSTRAINT "style_customization_history_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."style_customization_history"
    ADD CONSTRAINT "style_customization_history_optimization_id_fkey" FOREIGN KEY ("optimization_id") REFERENCES "public"."optimizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."style_customization_history"
    ADD CONSTRAINT "style_customization_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."style_customization_history"
    ADD CONSTRAINT "style_customization_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anonymous insert" ON "public"."anonymous_ats_scores" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert beta signup" ON "public"."beta_signups" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("accepted_terms" = true) AND ("accepted_privacy" = true) AND ("email" IS NOT NULL)));



CREATE POLICY "Anyone can subscribe to newsletter" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Assignments deletable by owner" ON "public"."resume_design_assignments" FOR DELETE USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "Assignments deletable by owner" ON "public"."resume_design_assignments" IS 'Users can only delete their own design assignments. Maintains user data isolation.';



CREATE POLICY "Authenticated users can view templates" ON "public"."templates" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Customizations deletable by assignment owner" ON "public"."design_customizations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."resume_design_assignments" "rda"
  WHERE ((("rda"."customization_id" = "design_customizations"."id") OR ("rda"."previous_customization_id" = "design_customizations"."id")) AND ("rda"."user_id" = "auth"."uid"())))));



COMMENT ON POLICY "Customizations deletable by assignment owner" ON "public"."design_customizations" IS 'Users can only delete customizations that are currently or previously assigned to their optimizations. Ensures ownership through assignments.';



CREATE POLICY "Customizations insertable by assignment owner" ON "public"."design_customizations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."resume_design_assignments" "rda"
  WHERE (("rda"."template_id" = "design_customizations"."template_id") AND ("rda"."user_id" = "auth"."uid"())))));



COMMENT ON POLICY "Customizations insertable by assignment owner" ON "public"."design_customizations" IS 'Users can only create customizations for templates they have assigned to their optimizations. Prevents unauthorized customization creation.';



CREATE POLICY "Customizations updatable by assignment owner" ON "public"."design_customizations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."resume_design_assignments" "rda"
  WHERE ((("rda"."customization_id" = "design_customizations"."id") OR ("rda"."previous_customization_id" = "design_customizations"."id")) AND ("rda"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."resume_design_assignments" "rda"
  WHERE ((("rda"."customization_id" = "design_customizations"."id") OR ("rda"."previous_customization_id" = "design_customizations"."id")) AND ("rda"."user_id" = "auth"."uid"())))));



COMMENT ON POLICY "Customizations updatable by assignment owner" ON "public"."design_customizations" IS 'Users can only update customizations that are currently or previously assigned to their optimizations. Ensures ownership through assignments.';



CREATE POLICY "Service role can manage all events" ON "public"."events" TO "service_role" USING (true);



CREATE POLICY "Service role can manage templates" ON "public"."templates" TO "service_role" USING (true);



CREATE POLICY "System can manage rate limits" ON "public"."rate_limits" USING (true) WITH CHECK (true);



CREATE POLICY "Templates deletable by service role" ON "public"."design_templates" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Templates insertable by service role" ON "public"."design_templates" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Templates updatable by service role" ON "public"."design_templates" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Templates viewable by authenticated or service role" ON "public"."design_templates" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = ANY (ARRAY['authenticated'::"text", 'service_role'::"text"])));



CREATE POLICY "Users can attach scores" ON "public"."anonymous_ats_scores" FOR UPDATE USING (("user_id" IS NULL)) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create own modifications" ON "public"."content_modifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own style history" ON "public"."style_customization_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own threads" ON "public"."ai_threads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own applications" ON "public"."applications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own conversation messages" ON "public"."conversation_messages" FOR DELETE USING (("conversation_id" IN ( SELECT "c"."id"
   FROM ("public"."conversations" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "c"."profile_id")))
  WHERE (("p"."auth_user_id" = "auth"."uid"()) OR ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own conversations" ON "public"."conversations" FOR DELETE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own design assignments" ON "public"."design_assignments" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own device tokens" ON "public"."device_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own idempotency keys" ON "public"."idempotency_keys" FOR DELETE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own plans" ON "public"."plans" FOR DELETE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own threads" ON "public"."ai_threads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own workouts" ON "public"."workouts" FOR DELETE USING (("plan_id" IN ( SELECT "p"."id"
   FROM ("public"."plans" "p"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."profile_id")))
  WHERE (("pr"."auth_user_id" = "auth"."uid"()) OR ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own job descriptions" ON "public"."job_descriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own optimizations" ON "public"."optimizations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own resumes" ON "public"."resumes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own agent shadow logs" ON "public"."agent_shadow_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own conversation messages" ON "public"."conversation_messages" FOR INSERT WITH CHECK (("conversation_id" IN ( SELECT "c"."id"
   FROM ("public"."conversations" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "c"."profile_id")))
  WHERE (("p"."auth_user_id" = "auth"."uid"()) OR ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own design assignments" ON "public"."design_assignments" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own events" ON "public"."events" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can insert own idempotency keys" ON "public"."idempotency_keys" FOR INSERT WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own plans" ON "public"."plans" FOR INSERT WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own workouts" ON "public"."workouts" FOR INSERT WITH CHECK (("plan_id" IN ( SELECT "p"."id"
   FROM ("public"."plans" "p"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."profile_id")))
  WHERE (("pr"."auth_user_id" = "auth"."uid"()) OR ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own events" ON "public"."events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own job descriptions" ON "public"."job_descriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own optimizations" ON "public"."optimizations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own resumes" ON "public"."resumes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own saved resumes" ON "public"."saved_resumes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own conversation messages" ON "public"."conversation_messages" FOR UPDATE USING (("conversation_id" IN ( SELECT "c"."id"
   FROM ("public"."conversations" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "c"."profile_id")))
  WHERE (("p"."auth_user_id" = "auth"."uid"()) OR ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own conversations" ON "public"."conversations" FOR UPDATE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own design assignments" ON "public"."design_assignments" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own idempotency keys" ON "public"."idempotency_keys" FOR UPDATE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own modifications" ON "public"."content_modifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own plans" ON "public"."plans" FOR UPDATE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own threads" ON "public"."ai_threads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own workouts" ON "public"."workouts" FOR UPDATE USING (("plan_id" IN ( SELECT "p"."id"
   FROM ("public"."plans" "p"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."profile_id")))
  WHERE (("pr"."auth_user_id" = "auth"."uid"()) OR ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can upsert own device tokens" ON "public"."device_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view converted scores" ON "public"."anonymous_ats_scores" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own agent shadow logs" ON "public"."agent_shadow_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own conversation messages" ON "public"."conversation_messages" FOR SELECT USING (("conversation_id" IN ( SELECT "c"."id"
   FROM ("public"."conversations" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "c"."profile_id")))
  WHERE (("p"."auth_user_id" = "auth"."uid"()) OR ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own credit transactions" ON "public"."credit_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own design assignments" ON "public"."design_assignments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own device tokens" ON "public"."device_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own events" ON "public"."events" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can view own idempotency keys" ON "public"."idempotency_keys" FOR SELECT USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own modifications" ON "public"."content_modifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own plans" ON "public"."plans" FOR SELECT USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "auth_user_id")));



CREATE POLICY "Users can view own style history" ON "public"."style_customization_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own threads" ON "public"."ai_threads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own workouts" ON "public"."workouts" FOR SELECT USING (("plan_id" IN ( SELECT "p"."id"
   FROM ("public"."plans" "p"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."profile_id")))
  WHERE (("pr"."auth_user_id" = "auth"."uid"()) OR ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own events" ON "public"."events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own job descriptions" ON "public"."job_descriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own optimizations" ON "public"."optimizations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own resumes" ON "public"."resumes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription" ON "public"."newsletter_subscribers" FOR SELECT USING ((("auth"."jwt"() ->> 'email'::"text") = "email"));



ALTER TABLE "public"."agent_shadow_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."amendment_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "amendment_requests_insert_own" ON "public"."amendment_requests" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "amendment_requests"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "amendment_requests_select_own" ON "public"."amendment_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "amendment_requests"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "amendment_requests_service_role" ON "public"."amendment_requests" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "amendment_requests_update_own" ON "public"."amendment_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "amendment_requests"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "amendment_requests"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."anonymous_ats_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_expert_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "application_expert_reports_insert_own" ON "public"."application_expert_reports" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "application_expert_reports_select_own" ON "public"."application_expert_reports" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applications_insert_own" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "applications_select_own" ON "public"."applications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "applications_service_role" ON "public"."applications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "applications_update_own" ON "public"."applications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."beta_signups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_messages_insert_own" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "chat_messages_select_own" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "chat_messages_service_role" ON "public"."chat_messages" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."chat_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_sessions_insert_own" ON "public"."chat_sessions" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."optimizations"
  WHERE (("optimizations"."id" = "chat_sessions"."optimization_id") AND ("optimizations"."user_id" = "auth"."uid"()))))));



CREATE POLICY "chat_sessions_select_own" ON "public"."chat_sessions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "chat_sessions_service_role" ON "public"."chat_sessions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "chat_sessions_update_own" ON "public"."chat_sessions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."content_modifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_customizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "design_customizations_insert_authenticated" ON "public"."design_customizations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "design_customizations_select_own" ON "public"."design_customizations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."resume_design_assignments" "rda"
  WHERE ((("rda"."customization_id" = "design_customizations"."id") OR ("rda"."previous_customization_id" = "design_customizations"."id")) AND ("rda"."user_id" = "auth"."uid"())))));



CREATE POLICY "design_customizations_service_role" ON "public"."design_customizations" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."design_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "design_templates_select_authenticated" ON "public"."design_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "design_templates_service_role" ON "public"."design_templates" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."device_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expert_artifacts_insert_own" ON "public"."expert_workflow_artifacts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."expert_workflow_runs" "r"
  WHERE (("r"."id" = "expert_workflow_artifacts"."run_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "expert_artifacts_select_own" ON "public"."expert_workflow_artifacts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."expert_workflow_runs" "r"
  WHERE (("r"."id" = "expert_workflow_artifacts"."run_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "expert_runs_insert_own" ON "public"."expert_workflow_runs" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "expert_runs_select_own" ON "public"."expert_workflow_runs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "expert_runs_update_own" ON "public"."expert_workflow_runs" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."expert_workflow_artifacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expert_workflow_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."idempotency_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_descriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_descriptions_delete_own" ON "public"."job_descriptions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "job_descriptions_insert_own" ON "public"."job_descriptions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "job_descriptions_select_own" ON "public"."job_descriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "job_descriptions_service_role" ON "public"."job_descriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "job_descriptions_update_own" ON "public"."job_descriptions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."optimization_review_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "optimization_review_runs_insert_own" ON "public"."optimization_review_runs" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "optimization_review_runs_select_own" ON "public"."optimization_review_runs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "optimization_review_runs_update_own" ON "public"."optimization_review_runs" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."optimizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "optimizations_delete_own" ON "public"."optimizations" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "optimizations_insert_own" ON "public"."optimizations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "optimizations_select_own" ON "public"."optimizations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "optimizations_service_role" ON "public"."optimizations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "optimizations_update_own" ON "public"."optimizations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_service_role" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resume_design_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resume_design_assignments_insert_own" ON "public"."resume_design_assignments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "resume_design_assignments_select_own" ON "public"."resume_design_assignments" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "resume_design_assignments_service_role" ON "public"."resume_design_assignments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "resume_design_assignments_update_own" ON "public"."resume_design_assignments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."resume_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resume_versions_insert_own" ON "public"."resume_versions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."optimizations"
  WHERE (("optimizations"."id" = "resume_versions"."optimization_id") AND ("optimizations"."user_id" = "auth"."uid"())))));



CREATE POLICY "resume_versions_select_own" ON "public"."resume_versions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."optimizations"
  WHERE (("optimizations"."id" = "resume_versions"."optimization_id") AND ("optimizations"."user_id" = "auth"."uid"())))));



CREATE POLICY "resume_versions_service_role" ON "public"."resume_versions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."resumes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resumes_delete_own" ON "public"."resumes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "resumes_insert_own" ON "public"."resumes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "resumes_select_own" ON "public"."resumes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "resumes_service_role" ON "public"."resumes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "resumes_update_own" ON "public"."resumes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."saved_resumes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."style_customization_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workouts" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";















GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";









GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";






GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";








































































































































































































































































GRANT ALL ON FUNCTION "public"."applications_update_search"() TO "anon";
GRANT ALL ON FUNCTION "public"."applications_update_search"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."applications_update_search"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_default_template"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_default_template"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_default_template"() TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_subscription_limit"("user_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_subscription_limit"("user_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_files"("bucket_name" "text", "days_old" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_files"("bucket_name" "text", "days_old" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_credit"("p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_file_path"("user_uuid" "uuid", "filename" "text", "file_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_file_path"("user_uuid" "uuid", "filename" "text", "file_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_ats_improvement"("optimization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ats_improvement"("optimization_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_apple_credits"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source" "text", "p_apple_transaction_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_apple_credits"("p_user_id" "uuid", "p_delta" integer, "p_reason" "text", "p_source" "text", "p_apple_transaction_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_optimization_usage"("user_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_optimization_usage"("user_uuid" "uuid") TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_optimizations_used"("user_id_param" "uuid", "max_allowed" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_optimizations_used"("user_id_param" "uuid", "max_allowed" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_rate_limit"("p_identifier" "text", "p_endpoint" "text", "p_window_ms" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_rate_limit"("p_identifier" "text", "p_endpoint" "text", "p_window_ms" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_ats_v2"("optimization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_ats_v2"("optimization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_applications_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_applications_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_applications_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";


















GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."agent_shadow_logs" TO "anon";
GRANT ALL ON TABLE "public"."agent_shadow_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_shadow_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_threads" TO "anon";
GRANT ALL ON TABLE "public"."ai_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_threads" TO "service_role";



GRANT ALL ON TABLE "public"."amendment_requests" TO "anon";
GRANT ALL ON TABLE "public"."amendment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."amendment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."anonymous_ats_scores" TO "anon";
GRANT ALL ON TABLE "public"."anonymous_ats_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."anonymous_ats_scores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."anonymous_ats_scores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."anonymous_ats_scores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."anonymous_ats_scores_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."application_expert_reports" TO "anon";
GRANT ALL ON TABLE "public"."application_expert_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."application_expert_reports" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."beta_signups" TO "anon";
GRANT ALL ON TABLE "public"."beta_signups" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_signups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."beta_signups_waitlist_position_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."beta_signups_waitlist_position_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."beta_signups_waitlist_position_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."content_modifications" TO "anon";
GRANT ALL ON TABLE "public"."content_modifications" TO "authenticated";
GRANT ALL ON TABLE "public"."content_modifications" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_messages" TO "anon";
GRANT ALL ON TABLE "public"."conversation_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_messages" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."credit_transactions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."design_assignments" TO "anon";
GRANT ALL ON TABLE "public"."design_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."design_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."design_customizations" TO "anon";
GRANT ALL ON TABLE "public"."design_customizations" TO "authenticated";
GRANT ALL ON TABLE "public"."design_customizations" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."design_templates" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."design_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."design_templates" TO "service_role";



GRANT ALL ON TABLE "public"."device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."expert_workflow_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."expert_workflow_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."expert_workflow_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."expert_workflow_runs" TO "anon";
GRANT ALL ON TABLE "public"."expert_workflow_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."expert_workflow_runs" TO "service_role";



GRANT ALL ON TABLE "public"."idempotency_keys" TO "anon";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "service_role";



GRANT ALL ON TABLE "public"."job_descriptions" TO "anon";
GRANT ALL ON TABLE "public"."job_descriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."job_descriptions" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."optimization_review_runs" TO "anon";
GRANT ALL ON TABLE "public"."optimization_review_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."optimization_review_runs" TO "service_role";



GRANT ALL ON TABLE "public"."optimizations" TO "anon";
GRANT ALL ON TABLE "public"."optimizations" TO "authenticated";
GRANT ALL ON TABLE "public"."optimizations" TO "service_role";



GRANT ALL ON TABLE "public"."optimizations_with_ats_v2" TO "anon";
GRANT ALL ON TABLE "public"."optimizations_with_ats_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."optimizations_with_ats_v2" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rate_limits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rate_limits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rate_limits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."resume_design_assignments" TO "anon";
GRANT ALL ON TABLE "public"."resume_design_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."resume_design_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."resume_versions" TO "anon";
GRANT ALL ON TABLE "public"."resume_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."resume_versions" TO "service_role";



GRANT ALL ON TABLE "public"."resumes" TO "anon";
GRANT ALL ON TABLE "public"."resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."resumes" TO "service_role";



GRANT ALL ON TABLE "public"."saved_resumes" TO "anon";
GRANT ALL ON TABLE "public"."saved_resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_resumes" TO "service_role";



GRANT ALL ON TABLE "public"."style_customization_history" TO "anon";
GRANT ALL ON TABLE "public"."style_customization_history" TO "authenticated";
GRANT ALL ON TABLE "public"."style_customization_history" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT ALL ON TABLE "public"."workouts" TO "anon";
GRANT ALL ON TABLE "public"."workouts" TO "authenticated";
GRANT ALL ON TABLE "public"."workouts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































-- =====================================================================
-- Objects `supabase db dump` leaves out, copied from production
-- (read-only queries, 2026-10-13). The dump covers app schemas only;
-- these live in Supabase-managed schemas (auth, storage) or are catalog
-- rows that old migrations seeded. Without them a fresh database has no
-- profile-on-signup trigger, no upload buckets or upload policies, and
-- an empty template catalog.
-- =====================================================================

-- auth: create a profile for every new user
CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- storage: buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('applications', 'applications', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('resume-exports', 'resume-exports', false, 10485760, '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('resume-uploads', 'resume-uploads', false, 10485760, '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword}'::text[]) on conflict (id) do nothing;

-- storage: policies on storage.objects
create policy "Service role can create exports" on storage.objects as PERMISSIVE for INSERT to service_role with check ((bucket_id = 'resume-exports'::text));
create policy "Users can delete own resume exports" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'resume-exports'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1))));
create policy "Users can delete own resume uploads" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'resume-uploads'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1))));
create policy "Users can update own resume exports" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'resume-exports'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1))));
create policy "Users can update own resume uploads" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'resume-uploads'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1))));
create policy "Users can upload own resume exports" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'resume-exports'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1)) AND (lower(reverse(split_part(reverse(name), '.'::text, 1))) = ANY (ARRAY['pdf'::text, 'docx'::text]))));
create policy "Users can upload own resume files" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'resume-uploads'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1)) AND (lower(reverse(split_part(reverse(name), '.'::text, 1))) = ANY (ARRAY['pdf'::text, 'docx'::text, 'doc'::text]))));
create policy "Users can view own resume exports" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'resume-exports'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1))));
create policy "Users can view own resume uploads" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'resume-uploads'::text) AND ((auth.uid())::text = split_part(name, '/'::text, 1))));

-- catalog rows (no user data)
insert into public.templates (key, name, family, config_data) values ('ats-safe', 'ATS-Safe Professional', 'ats', '{"fonts": ["Arial", "Calibri", "Times New Roman"], "colors": ["#000000", "#333333"], "layout": "single-column", "sections": ["header", "summary", "experience", "education", "skills"], "description": "Clean, professional template optimized for ATS systems"}'::jsonb) on conflict do nothing;
insert into public.templates (key, name, family, config_data) values ('modern-creative', 'Modern Creative', 'modern', '{"fonts": ["Inter", "Roboto", "Open Sans"], "colors": ["#2563eb", "#1f2937", "#6b7280"], "layout": "two-column", "sections": ["header", "summary", "experience", "education", "skills", "certifications"], "description": "Contemporary design with visual elements"}'::jsonb) on conflict do nothing;
insert into public.design_templates (id, name, slug, category, description, file_path, preview_thumbnail_url, is_premium, ats_compatibility_score, supported_customizations, default_config) values ('1ed882dd-f90c-405f-b1e7-af9b58359062', 'Card Modern', 'card-ssr', 'modern', 'A bold, card-based layout with strong visual hierarchy.', 'external/card-ssr', NULL, false, 92, '{"fonts": true, "colors": true, "layout": true}'::jsonb, '{"font_family": {"body": "Inter, system-ui, sans-serif", "heading": "Inter, system-ui, sans-serif"}, "color_scheme": {"text": "#0f172a", "accent": "#0ea5e9", "primary": "#2563eb", "secondary": "#64748b", "background": "#ffffff"}, "spacing_settings": {"compact": false, "lineHeight": 1.5}}'::jsonb) on conflict do nothing;
insert into public.design_templates (id, name, slug, category, description, file_path, preview_thumbnail_url, is_premium, ats_compatibility_score, supported_customizations, default_config) values ('37360766-3d95-4fa5-961b-43702d8898c3', 'Sidebar Executive', 'sidebar-ssr', 'corporate', 'A structured, two-column executive layout with a strong sidebar.', 'external/sidebar-ssr', NULL, false, 94, '{"fonts": true, "colors": true, "layout": true}'::jsonb, '{"font_family": {"body": "Roboto, system-ui, sans-serif", "heading": "Roboto, system-ui, sans-serif"}, "color_scheme": {"text": "#0f172a", "accent": "#10b981", "primary": "#0f172a", "secondary": "#334155", "background": "#ffffff"}, "spacing_settings": {"compact": true, "lineHeight": 1.55}}'::jsonb) on conflict do nothing;
insert into public.design_templates (id, name, slug, category, description, file_path, preview_thumbnail_url, is_premium, ats_compatibility_score, supported_customizations, default_config) values ('7d2b1a46-cd20-4abb-8af1-b035d7c11658', 'Minimal Serif', 'minimal-ssr', 'traditional', 'A clean, classic serif layout optimized for ATS readability.', 'external/minimal-ssr', NULL, false, 98, '{"fonts": true, "colors": true, "layout": true}'::jsonb, '{"font_family": {"body": "Georgia, serif", "heading": "Georgia, serif"}, "color_scheme": {"text": "#0f172a", "accent": "#2563eb", "primary": "#111827", "secondary": "#6b7280", "background": "#ffffff"}, "spacing_settings": {"compact": false, "lineHeight": 1.6}}'::jsonb) on conflict do nothing;
insert into public.design_templates (id, name, slug, category, description, file_path, preview_thumbnail_url, is_premium, ats_compatibility_score, supported_customizations, default_config) values ('d099c4e4-0eee-41f9-9a07-52716f5e5e87', 'Timeline Flow', 'timeline-ssr', 'creative', 'A creative timeline layout for showcasing career progression.', 'external/timeline-ssr', NULL, false, 88, '{"fonts": true, "colors": true, "layout": true}'::jsonb, '{"font_family": {"body": "Poppins, system-ui, sans-serif", "heading": "Poppins, system-ui, sans-serif"}, "color_scheme": {"text": "#0f172a", "accent": "#f59e0b", "primary": "#7c3aed", "secondary": "#6b7280", "background": "#ffffff"}, "spacing_settings": {"compact": false, "lineHeight": 1.6}}'::jsonb) on conflict do nothing;

-- privileges: the dump's GRANT lines add privileges but do not remove the
-- broader defaults a fresh Supabase database gives anon and authenticated.
-- Production locked these three tables down (20260811093000 and
-- 20260811093100 in the archive); restate that so a fresh database matches.
revoke all on table public.profiles, public.credit_transactions, public.design_templates from anon, authenticated;
grant select, references, trigger, maintain on table public.profiles, public.credit_transactions, public.design_templates to anon, authenticated;
