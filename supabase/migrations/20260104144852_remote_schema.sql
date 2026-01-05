create extension if not exists "citext" with schema "extensions";

drop extension if exists "pg_net";

create sequence "public"."beta_signups_waitlist_position_seq";

drop policy "Users can delete own job descriptions" on "public"."job_descriptions";

drop policy "Users can insert own job descriptions" on "public"."job_descriptions";

drop policy "Users can update own job descriptions" on "public"."job_descriptions";

drop policy "Users can view own job descriptions" on "public"."job_descriptions";

drop policy "Users can delete own optimizations" on "public"."optimizations";

drop policy "Users can insert own optimizations" on "public"."optimizations";

drop policy "Users can update own optimizations" on "public"."optimizations";

drop policy "Users can view own optimizations" on "public"."optimizations";

drop policy "Users can insert own profile" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can view own profile" on "public"."profiles";

drop policy "Users can delete own resumes" on "public"."resumes";

drop policy "Users can insert own resumes" on "public"."resumes";

drop policy "Users can update own resumes" on "public"."resumes";

drop policy "Users can view own resumes" on "public"."resumes";

drop policy "Authenticated users can view templates" on "public"."templates";

revoke delete on table "public"."anonymous_ats_scores" from "anon";

revoke insert on table "public"."anonymous_ats_scores" from "anon";

revoke references on table "public"."anonymous_ats_scores" from "anon";

revoke select on table "public"."anonymous_ats_scores" from "anon";

revoke trigger on table "public"."anonymous_ats_scores" from "anon";

revoke truncate on table "public"."anonymous_ats_scores" from "anon";

revoke update on table "public"."anonymous_ats_scores" from "anon";

revoke delete on table "public"."anonymous_ats_scores" from "authenticated";

revoke insert on table "public"."anonymous_ats_scores" from "authenticated";

revoke references on table "public"."anonymous_ats_scores" from "authenticated";

revoke select on table "public"."anonymous_ats_scores" from "authenticated";

revoke trigger on table "public"."anonymous_ats_scores" from "authenticated";

revoke truncate on table "public"."anonymous_ats_scores" from "authenticated";

revoke update on table "public"."anonymous_ats_scores" from "authenticated";

revoke delete on table "public"."anonymous_ats_scores" from "service_role";

revoke insert on table "public"."anonymous_ats_scores" from "service_role";

revoke references on table "public"."anonymous_ats_scores" from "service_role";

revoke select on table "public"."anonymous_ats_scores" from "service_role";

revoke trigger on table "public"."anonymous_ats_scores" from "service_role";

revoke truncate on table "public"."anonymous_ats_scores" from "service_role";

revoke update on table "public"."anonymous_ats_scores" from "service_role";

revoke delete on table "public"."applications" from "anon";

revoke insert on table "public"."applications" from "anon";

revoke references on table "public"."applications" from "anon";

revoke select on table "public"."applications" from "anon";

revoke trigger on table "public"."applications" from "anon";

revoke truncate on table "public"."applications" from "anon";

revoke update on table "public"."applications" from "anon";

revoke delete on table "public"."applications" from "authenticated";

revoke insert on table "public"."applications" from "authenticated";

revoke references on table "public"."applications" from "authenticated";

revoke select on table "public"."applications" from "authenticated";

revoke trigger on table "public"."applications" from "authenticated";

revoke truncate on table "public"."applications" from "authenticated";

revoke update on table "public"."applications" from "authenticated";

revoke delete on table "public"."applications" from "service_role";

revoke insert on table "public"."applications" from "service_role";

revoke references on table "public"."applications" from "service_role";

revoke select on table "public"."applications" from "service_role";

revoke trigger on table "public"."applications" from "service_role";

revoke truncate on table "public"."applications" from "service_role";

revoke update on table "public"."applications" from "service_role";

revoke delete on table "public"."chat_sessions" from "anon";

revoke insert on table "public"."chat_sessions" from "anon";

revoke references on table "public"."chat_sessions" from "anon";

revoke select on table "public"."chat_sessions" from "anon";

revoke trigger on table "public"."chat_sessions" from "anon";

revoke truncate on table "public"."chat_sessions" from "anon";

revoke update on table "public"."chat_sessions" from "anon";

revoke delete on table "public"."chat_sessions" from "authenticated";

revoke insert on table "public"."chat_sessions" from "authenticated";

revoke references on table "public"."chat_sessions" from "authenticated";

revoke select on table "public"."chat_sessions" from "authenticated";

revoke trigger on table "public"."chat_sessions" from "authenticated";

revoke truncate on table "public"."chat_sessions" from "authenticated";

revoke update on table "public"."chat_sessions" from "authenticated";

revoke delete on table "public"."chat_sessions" from "service_role";

revoke insert on table "public"."chat_sessions" from "service_role";

revoke references on table "public"."chat_sessions" from "service_role";

revoke select on table "public"."chat_sessions" from "service_role";

revoke trigger on table "public"."chat_sessions" from "service_role";

revoke truncate on table "public"."chat_sessions" from "service_role";

revoke update on table "public"."chat_sessions" from "service_role";

revoke delete on table "public"."design_templates" from "anon";

revoke insert on table "public"."design_templates" from "anon";

revoke references on table "public"."design_templates" from "anon";

revoke select on table "public"."design_templates" from "anon";

revoke trigger on table "public"."design_templates" from "anon";

revoke truncate on table "public"."design_templates" from "anon";

revoke update on table "public"."design_templates" from "anon";

revoke delete on table "public"."design_templates" from "authenticated";

revoke insert on table "public"."design_templates" from "authenticated";

revoke references on table "public"."design_templates" from "authenticated";

revoke select on table "public"."design_templates" from "authenticated";

revoke trigger on table "public"."design_templates" from "authenticated";

revoke truncate on table "public"."design_templates" from "authenticated";

revoke update on table "public"."design_templates" from "authenticated";

revoke delete on table "public"."design_templates" from "service_role";

revoke insert on table "public"."design_templates" from "service_role";

revoke references on table "public"."design_templates" from "service_role";

revoke select on table "public"."design_templates" from "service_role";

revoke trigger on table "public"."design_templates" from "service_role";

revoke truncate on table "public"."design_templates" from "service_role";

revoke update on table "public"."design_templates" from "service_role";

revoke delete on table "public"."events" from "anon";

revoke insert on table "public"."events" from "anon";

revoke references on table "public"."events" from "anon";

revoke select on table "public"."events" from "anon";

revoke trigger on table "public"."events" from "anon";

revoke truncate on table "public"."events" from "anon";

revoke update on table "public"."events" from "anon";

revoke delete on table "public"."events" from "authenticated";

revoke insert on table "public"."events" from "authenticated";

revoke references on table "public"."events" from "authenticated";

revoke select on table "public"."events" from "authenticated";

revoke trigger on table "public"."events" from "authenticated";

revoke truncate on table "public"."events" from "authenticated";

revoke update on table "public"."events" from "authenticated";

revoke delete on table "public"."events" from "service_role";

revoke insert on table "public"."events" from "service_role";

revoke references on table "public"."events" from "service_role";

revoke select on table "public"."events" from "service_role";

revoke trigger on table "public"."events" from "service_role";

revoke truncate on table "public"."events" from "service_role";

revoke update on table "public"."events" from "service_role";

revoke delete on table "public"."job_descriptions" from "anon";

revoke insert on table "public"."job_descriptions" from "anon";

revoke references on table "public"."job_descriptions" from "anon";

revoke select on table "public"."job_descriptions" from "anon";

revoke trigger on table "public"."job_descriptions" from "anon";

revoke truncate on table "public"."job_descriptions" from "anon";

revoke update on table "public"."job_descriptions" from "anon";

revoke delete on table "public"."job_descriptions" from "authenticated";

revoke insert on table "public"."job_descriptions" from "authenticated";

revoke references on table "public"."job_descriptions" from "authenticated";

revoke select on table "public"."job_descriptions" from "authenticated";

revoke trigger on table "public"."job_descriptions" from "authenticated";

revoke truncate on table "public"."job_descriptions" from "authenticated";

revoke update on table "public"."job_descriptions" from "authenticated";

revoke delete on table "public"."job_descriptions" from "service_role";

revoke insert on table "public"."job_descriptions" from "service_role";

revoke references on table "public"."job_descriptions" from "service_role";

revoke select on table "public"."job_descriptions" from "service_role";

revoke trigger on table "public"."job_descriptions" from "service_role";

revoke truncate on table "public"."job_descriptions" from "service_role";

revoke update on table "public"."job_descriptions" from "service_role";

revoke delete on table "public"."optimizations" from "anon";

revoke insert on table "public"."optimizations" from "anon";

revoke references on table "public"."optimizations" from "anon";

revoke select on table "public"."optimizations" from "anon";

revoke trigger on table "public"."optimizations" from "anon";

revoke truncate on table "public"."optimizations" from "anon";

revoke update on table "public"."optimizations" from "anon";

revoke delete on table "public"."optimizations" from "authenticated";

revoke insert on table "public"."optimizations" from "authenticated";

revoke references on table "public"."optimizations" from "authenticated";

revoke select on table "public"."optimizations" from "authenticated";

revoke trigger on table "public"."optimizations" from "authenticated";

revoke truncate on table "public"."optimizations" from "authenticated";

revoke update on table "public"."optimizations" from "authenticated";

revoke delete on table "public"."optimizations" from "service_role";

revoke insert on table "public"."optimizations" from "service_role";

revoke references on table "public"."optimizations" from "service_role";

revoke select on table "public"."optimizations" from "service_role";

revoke trigger on table "public"."optimizations" from "service_role";

revoke truncate on table "public"."optimizations" from "service_role";

revoke update on table "public"."optimizations" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."rate_limits" from "anon";

revoke insert on table "public"."rate_limits" from "anon";

revoke references on table "public"."rate_limits" from "anon";

revoke select on table "public"."rate_limits" from "anon";

revoke trigger on table "public"."rate_limits" from "anon";

revoke truncate on table "public"."rate_limits" from "anon";

revoke update on table "public"."rate_limits" from "anon";

revoke delete on table "public"."rate_limits" from "authenticated";

revoke insert on table "public"."rate_limits" from "authenticated";

revoke references on table "public"."rate_limits" from "authenticated";

revoke select on table "public"."rate_limits" from "authenticated";

revoke trigger on table "public"."rate_limits" from "authenticated";

revoke truncate on table "public"."rate_limits" from "authenticated";

revoke update on table "public"."rate_limits" from "authenticated";

revoke delete on table "public"."rate_limits" from "service_role";

revoke insert on table "public"."rate_limits" from "service_role";

revoke references on table "public"."rate_limits" from "service_role";

revoke select on table "public"."rate_limits" from "service_role";

revoke trigger on table "public"."rate_limits" from "service_role";

revoke truncate on table "public"."rate_limits" from "service_role";

revoke update on table "public"."rate_limits" from "service_role";

revoke delete on table "public"."resumes" from "anon";

revoke insert on table "public"."resumes" from "anon";

revoke references on table "public"."resumes" from "anon";

revoke select on table "public"."resumes" from "anon";

revoke trigger on table "public"."resumes" from "anon";

revoke truncate on table "public"."resumes" from "anon";

revoke update on table "public"."resumes" from "anon";

revoke delete on table "public"."resumes" from "authenticated";

revoke insert on table "public"."resumes" from "authenticated";

revoke references on table "public"."resumes" from "authenticated";

revoke select on table "public"."resumes" from "authenticated";

revoke trigger on table "public"."resumes" from "authenticated";

revoke truncate on table "public"."resumes" from "authenticated";

revoke update on table "public"."resumes" from "authenticated";

revoke delete on table "public"."resumes" from "service_role";

revoke insert on table "public"."resumes" from "service_role";

revoke references on table "public"."resumes" from "service_role";

revoke select on table "public"."resumes" from "service_role";

revoke trigger on table "public"."resumes" from "service_role";

revoke truncate on table "public"."resumes" from "service_role";

revoke update on table "public"."resumes" from "service_role";

revoke delete on table "public"."templates" from "anon";

revoke insert on table "public"."templates" from "anon";

revoke references on table "public"."templates" from "anon";

revoke select on table "public"."templates" from "anon";

revoke trigger on table "public"."templates" from "anon";

revoke truncate on table "public"."templates" from "anon";

revoke update on table "public"."templates" from "anon";

revoke delete on table "public"."templates" from "authenticated";

revoke insert on table "public"."templates" from "authenticated";

revoke references on table "public"."templates" from "authenticated";

revoke select on table "public"."templates" from "authenticated";

revoke trigger on table "public"."templates" from "authenticated";

revoke truncate on table "public"."templates" from "authenticated";

revoke update on table "public"."templates" from "authenticated";

revoke delete on table "public"."templates" from "service_role";

revoke insert on table "public"."templates" from "service_role";

revoke references on table "public"."templates" from "service_role";

revoke select on table "public"."templates" from "service_role";

revoke trigger on table "public"."templates" from "service_role";

revoke truncate on table "public"."templates" from "service_role";

revoke update on table "public"."templates" from "service_role";

alter table "public"."optimizations" drop constraint "optimizations_match_score_check";

alter table "public"."optimizations" drop constraint "optimizations_resume_id_jd_id_key";

alter table "public"."profiles" drop constraint "profiles_optimizations_used_check";

alter table "public"."profiles" drop constraint "profiles_subscription_tier_check";

drop function if exists "public"."check_subscription_limit"(user_id_param uuid);

drop function if exists "public"."cleanup_stale_optimizations"();

drop function if exists "public"."complete_optimization"(optimization_uuid uuid, final_match_score numeric, optimization_result jsonb);

drop function if exists "public"."create_optimization"(user_uuid uuid, resume_uuid uuid, jd_uuid uuid, initial_match_score numeric);

drop function if exists "public"."fail_optimization"(optimization_uuid uuid, error_message text);

drop function if exists "public"."get_ats_improvement"(optimization_id bigint);

drop function if exists "public"."get_user_dashboard_stats"(user_uuid uuid);

drop function if exists "public"."get_user_subscription_status"(user_uuid uuid);

drop function if exists "public"."increment_optimization_usage"(user_id_param uuid);

drop function if exists "public"."is_ats_v2"(optimization_id bigint);

drop function if exists "public"."upgrade_to_premium"(user_uuid uuid);

alter table "public"."design_templates" drop constraint "design_templates_pkey";

drop index if exists "public"."idx_events_created_at";

drop index if exists "public"."idx_events_type";

drop index if exists "public"."idx_events_user_id";

drop index if exists "public"."idx_job_descriptions_created_at";

drop index if exists "public"."idx_job_descriptions_embeddings";

drop index if exists "public"."idx_job_descriptions_user_id";

drop index if exists "public"."idx_optimizations_resume_id";

drop index if exists "public"."idx_resumes_created_at";

drop index if exists "public"."idx_resumes_embeddings";

drop index if exists "public"."idx_resumes_user_id";

drop index if exists "public"."optimizations_resume_id_jd_id_key";

drop index if exists "public"."design_templates_pkey";

drop index if exists "public"."idx_optimizations_created_at";


  create table "public"."agent_shadow_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "intent" text[],
    "ats_before" integer,
    "ats_after" integer,
    "diff_count" integer,
    "warnings" text[],
    "created_at" timestamp with time zone default now()
      );


alter table "public"."agent_shadow_logs" enable row level security;


  create table "public"."ai_threads" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "optimization_id" uuid not null,
    "session_id" uuid,
    "openai_thread_id" character varying(255) not null,
    "openai_assistant_id" character varying(255),
    "status" character varying(50) default 'active'::character varying,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "last_message_at" timestamp with time zone default now(),
    "archived_at" timestamp with time zone
      );


alter table "public"."ai_threads" enable row level security;


  create table "public"."amendment_requests" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "session_id" uuid not null,
    "message_id" uuid not null,
    "type" text not null,
    "target_section" text,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default now(),
    "processed_at" timestamp with time zone,
    "rejection_reason" text
      );


alter table "public"."amendment_requests" enable row level security;


  create table "public"."beta_signups" (
    "id" uuid not null default gen_random_uuid(),
    "email" extensions.citext not null,
    "experience_level" text,
    "goals" text[] not null default '{}'::text[],
    "referral_source" text,
    "accepted_terms" boolean not null default false,
    "accepted_privacy" boolean not null default false,
    "metadata" jsonb not null default '{}'::jsonb,
    "waitlist_position" bigint not null default nextval('beta_signups_waitlist_position_seq'::regclass),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."beta_signups" enable row level security;


  create table "public"."chat_messages" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "session_id" uuid not null,
    "sender" text not null,
    "content" text not null,
    "created_at" timestamp with time zone not null default now(),
    "metadata" jsonb
      );


alter table "public"."chat_messages" enable row level security;


  create table "public"."content_modifications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "optimization_id" uuid not null,
    "session_id" uuid,
    "message_id" uuid,
    "operation" character varying(50) not null,
    "field_path" character varying(500) not null,
    "old_value" text,
    "new_value" text,
    "reason" text,
    "intent" character varying(100),
    "ats_score_before" numeric(5,2),
    "ats_score_after" numeric(5,2),
    "score_change" numeric(5,2) generated always as ((ats_score_after - ats_score_before)) stored,
    "applied_by" character varying(50) default 'ai_assistant'::character varying,
    "is_reverted" boolean default false,
    "reverted_at" timestamp with time zone,
    "reverted_by_modification_id" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."content_modifications" enable row level security;


  create table "public"."design_assignments" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "optimization_id" uuid not null,
    "template_id" uuid,
    "customization" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."design_assignments" enable row level security;


  create table "public"."design_customizations" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "template_id" uuid not null,
    "color_scheme" jsonb not null default '{"accent": "#0ea5e9", "primary": "#2563eb", "secondary": "#64748b"}'::jsonb,
    "font_family" jsonb not null default '{"body": "Arial", "headings": "Arial"}'::jsonb,
    "spacing" jsonb not null default '{"compact": false, "lineHeight": 1.5}'::jsonb,
    "layout_variant" character varying(100),
    "custom_css" text,
    "is_ats_safe" boolean not null default true,
    "ats_validation_errors" jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."design_customizations" enable row level security;


  create table "public"."newsletter_subscribers" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "name" text,
    "subscribed_at" timestamp with time zone default now(),
    "status" text default 'active'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."newsletter_subscribers" enable row level security;


  create table "public"."resume_design_assignments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "optimization_id" uuid not null,
    "template_id" uuid not null,
    "customization_id" uuid,
    "previous_customization_id" uuid,
    "original_template_id" uuid not null,
    "is_active" boolean not null default true,
    "finalized_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."resume_design_assignments" enable row level security;


  create table "public"."resume_versions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "optimization_id" uuid not null,
    "session_id" uuid,
    "version_number" integer not null,
    "content" jsonb not null,
    "change_summary" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."resume_versions" enable row level security;


  create table "public"."style_customization_history" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "optimization_id" uuid not null,
    "session_id" uuid,
    "message_id" uuid,
    "customization_type" character varying(50) not null,
    "changes" jsonb not null,
    "previous_customization" jsonb,
    "request_text" text,
    "applied_by" character varying(50) default 'ai_assistant'::character varying,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."style_customization_history" enable row level security;

alter table "public"."applications" add column "applied_date" timestamp with time zone not null default now();

alter table "public"."applications" add column "apply_clicked_at" timestamp with time zone;

alter table "public"."applications" add column "ats_score" numeric;

alter table "public"."applications" add column "company_name" text;

alter table "public"."applications" add column "contact" jsonb;

alter table "public"."applications" add column "job_extraction" jsonb;

alter table "public"."applications" add column "job_title" text;

alter table "public"."applications" add column "job_url" text;

alter table "public"."applications" add column "notes" text;

alter table "public"."applications" add column "optimized_resume_id" uuid;

alter table "public"."applications" add column "optimized_resume_url" text;

alter table "public"."applications" add column "resume_html_path" text;

alter table "public"."applications" add column "resume_json_path" text;

alter table "public"."applications" add column "search" tsvector;

alter table "public"."applications" add column "source_url" text;

alter table "public"."applications" add column "status" text not null default 'applied'::text;

alter table "public"."applications" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."applications" alter column "created_at" set not null;

alter table "public"."applications" alter column "id" set default gen_random_uuid();

alter table "public"."applications" alter column "user_id" set not null;

alter table "public"."applications" enable row level security;

alter table "public"."chat_sessions" add column "context" jsonb;

alter table "public"."chat_sessions" add column "last_activity_at" timestamp with time zone not null default now();

alter table "public"."chat_sessions" add column "openai_thread_id" character varying(255);

alter table "public"."chat_sessions" add column "optimization_id" uuid not null;

alter table "public"."chat_sessions" add column "status" text not null default 'active'::text;

alter table "public"."chat_sessions" alter column "created_at" set not null;

alter table "public"."chat_sessions" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."chat_sessions" alter column "updated_at" set not null;

alter table "public"."chat_sessions" alter column "user_id" set not null;

alter table "public"."chat_sessions" enable row level security;

alter table "public"."design_templates" add column "id" uuid not null default extensions.uuid_generate_v4();

alter table "public"."design_templates" add column "preview_thumbnail_url" text;

alter table "public"."design_templates" alter column "ats_compatibility_score" set default 100;

alter table "public"."design_templates" alter column "ats_compatibility_score" set not null;

alter table "public"."design_templates" alter column "category" set not null;

alter table "public"."design_templates" alter column "category" set data type character varying(50) using "category"::character varying(50);

alter table "public"."design_templates" alter column "created_at" set not null;

alter table "public"."design_templates" alter column "default_config" set default '{"font_family": {"body": "Arial", "headings": "Arial"}, "color_scheme": {"accent": "#0ea5e9", "primary": "#2563eb", "secondary": "#64748b"}, "spacing_settings": {"compact": false, "lineHeight": 1.5}}'::jsonb;

alter table "public"."design_templates" alter column "default_config" set not null;

alter table "public"."design_templates" alter column "description" set not null;

alter table "public"."design_templates" alter column "file_path" set not null;

alter table "public"."design_templates" alter column "file_path" set data type character varying(500) using "file_path"::character varying(500);

alter table "public"."design_templates" alter column "is_premium" set not null;

alter table "public"."design_templates" alter column "name" set data type character varying(100) using "name"::character varying(100);

alter table "public"."design_templates" alter column "slug" set data type character varying(100) using "slug"::character varying(100);

alter table "public"."design_templates" alter column "supported_customizations" set default '{"fonts": true, "colors": true, "layout": true}'::jsonb;

alter table "public"."design_templates" alter column "supported_customizations" set not null;

alter table "public"."design_templates" alter column "updated_at" set not null;

alter table "public"."design_templates" enable row level security;

alter table "public"."events" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."events" alter column "user_id" drop not null;

alter table "public"."job_descriptions" drop column "extracted_data";

alter table "public"."job_descriptions" drop column "url";

alter table "public"."job_descriptions" add column "clean_text" text not null;

alter table "public"."job_descriptions" add column "parsed_data" jsonb not null default '{}'::jsonb;

alter table "public"."job_descriptions" add column "raw_text" text not null;

alter table "public"."job_descriptions" add column "source_url" text;

alter table "public"."job_descriptions" alter column "company" set not null;

alter table "public"."job_descriptions" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."job_descriptions" alter column "user_id" drop not null;

alter table "public"."optimizations" drop column "optimization_data";

alter table "public"."optimizations" add column "ai_modification_count" integer default 0;

alter table "public"."optimizations" add column "ats_confidence" real;

alter table "public"."optimizations" add column "ats_score_optimized" real;

alter table "public"."optimizations" add column "ats_score_original" real;

alter table "public"."optimizations" add column "ats_subscores" jsonb;

alter table "public"."optimizations" add column "ats_subscores_original" jsonb;

alter table "public"."optimizations" add column "ats_suggestions" jsonb;

alter table "public"."optimizations" add column "ats_version" integer default 2;

alter table "public"."optimizations" add column "gaps_data" jsonb not null default '{}'::jsonb;

alter table "public"."optimizations" add column "jd_text" text;

alter table "public"."optimizations" add column "language_preference" text default 'auto'::text;

alter table "public"."optimizations" add column "output_paths" jsonb default '{}'::jsonb;

alter table "public"."optimizations" add column "resume_text" text;

alter table "public"."optimizations" add column "rewrite_data" jsonb not null default '{}'::jsonb;

alter table "public"."optimizations" add column "template_key" text not null;

alter table "public"."optimizations" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."optimizations" alter column "jd_id" drop not null;

alter table "public"."optimizations" alter column "resume_id" drop not null;

alter table "public"."optimizations" alter column "user_id" drop not null;

alter table "public"."profiles" drop column "max_optimizations";

alter table "public"."profiles" drop column "subscription_tier";

alter table "public"."profiles" add column "plan_type" text default 'free'::text;

alter table "public"."profiles" add column "role" text;

alter table "public"."profiles" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."profiles" alter column "user_id" drop not null;

alter table "public"."resumes" drop column "original_content";

alter table "public"."resumes" drop column "parsed_data";

alter table "public"."resumes" add column "canonical_data" jsonb default '{}'::jsonb;

alter table "public"."resumes" add column "raw_text" text;

alter table "public"."resumes" add column "storage_path" text;

alter table "public"."resumes" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."resumes" alter column "user_id" drop not null;

alter table "public"."templates" drop column "config";

alter table "public"."templates" drop column "is_premium";

alter table "public"."templates" add column "config_data" jsonb not null default '{}'::jsonb;

alter sequence "public"."beta_signups_waitlist_position_seq" owned by "public"."beta_signups"."waitlist_position";

CREATE UNIQUE INDEX agent_shadow_logs_pkey ON public.agent_shadow_logs USING btree (id);

CREATE UNIQUE INDEX ai_threads_openai_thread_id_key ON public.ai_threads USING btree (openai_thread_id);

CREATE UNIQUE INDEX ai_threads_pkey ON public.ai_threads USING btree (id);

CREATE UNIQUE INDEX amendment_requests_pkey ON public.amendment_requests USING btree (id);

CREATE UNIQUE INDEX beta_signups_email_unique ON public.beta_signups USING btree (email);

CREATE UNIQUE INDEX beta_signups_pkey ON public.beta_signups USING btree (id);

CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);

CREATE UNIQUE INDEX chat_sessions_openai_thread_id_key ON public.chat_sessions USING btree (openai_thread_id);

CREATE UNIQUE INDEX content_modifications_pkey ON public.content_modifications USING btree (id);

CREATE UNIQUE INDEX design_assignments_optimization_id_key ON public.design_assignments USING btree (optimization_id);

CREATE UNIQUE INDEX design_assignments_pkey ON public.design_assignments USING btree (id);

CREATE UNIQUE INDEX design_customizations_pkey ON public.design_customizations USING btree (id);

CREATE UNIQUE INDEX design_templates_name_key ON public.design_templates USING btree (name);

CREATE UNIQUE INDEX design_templates_slug_key ON public.design_templates USING btree (slug);

CREATE UNIQUE INDEX idx_active_session ON public.chat_sessions USING btree (user_id, optimization_id) WHERE (status = 'active'::text);

CREATE INDEX idx_agent_shadow_user_created ON public.agent_shadow_logs USING btree (user_id, created_at DESC);

CREATE INDEX idx_ai_threads_openai_thread_id ON public.ai_threads USING btree (openai_thread_id);

CREATE INDEX idx_ai_threads_optimization_id ON public.ai_threads USING btree (optimization_id);

CREATE INDEX idx_ai_threads_session_id ON public.ai_threads USING btree (session_id);

CREATE INDEX idx_ai_threads_status ON public.ai_threads USING btree (status);

CREATE INDEX idx_ai_threads_user_id ON public.ai_threads USING btree (user_id);

CREATE INDEX idx_amendment_requests_message_id ON public.amendment_requests USING btree (message_id);

CREATE INDEX idx_amendment_requests_session_id_fk ON public.amendment_requests USING btree (session_id);

CREATE INDEX idx_applications_applied_date ON public.applications USING btree (applied_date DESC);

CREATE INDEX idx_applications_optimized_resume_id ON public.applications USING btree (optimized_resume_id);

CREATE INDEX idx_applications_search ON public.applications USING gin (search);

CREATE INDEX idx_applications_source_url ON public.applications USING btree (source_url);

CREATE INDEX idx_applications_status ON public.applications USING btree (status);

CREATE INDEX idx_applications_user_id ON public.applications USING btree (user_id);

CREATE INDEX idx_beta_signups_created_at ON public.beta_signups USING btree (created_at DESC);

CREATE INDEX idx_beta_signups_waitlist_position ON public.beta_signups USING btree (waitlist_position);

CREATE INDEX idx_chat_messages_session_id ON public.chat_messages USING btree (session_id);

CREATE UNIQUE INDEX idx_chat_sessions_active_unique ON public.chat_sessions USING btree (user_id, optimization_id) WHERE (status = 'active'::text);

CREATE INDEX idx_chat_sessions_openai_thread_id ON public.chat_sessions USING btree (openai_thread_id);

CREATE INDEX idx_chat_sessions_optimization_id_fk ON public.chat_sessions USING btree (optimization_id);

CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions USING btree (user_id);

CREATE INDEX idx_content_modifications_message_id ON public.content_modifications USING btree (message_id);

CREATE INDEX idx_content_modifications_reverted_by_modification_id ON public.content_modifications USING btree (reverted_by_modification_id);

CREATE INDEX idx_content_mods_created_at ON public.content_modifications USING btree (created_at DESC);

CREATE INDEX idx_content_mods_field_path ON public.content_modifications USING btree (field_path);

CREATE INDEX idx_content_mods_is_reverted ON public.content_modifications USING btree (is_reverted) WHERE (is_reverted = false);

CREATE INDEX idx_content_mods_optimization_id ON public.content_modifications USING btree (optimization_id);

CREATE INDEX idx_content_mods_session_id ON public.content_modifications USING btree (session_id);

CREATE INDEX idx_content_mods_user_id ON public.content_modifications USING btree (user_id);

CREATE UNIQUE INDEX idx_design_assignments_optimization_id ON public.design_assignments USING btree (optimization_id);

CREATE INDEX idx_design_assignments_template_id ON public.design_assignments USING btree (template_id);

CREATE INDEX idx_design_assignments_user_id ON public.design_assignments USING btree (user_id);

CREATE INDEX idx_design_customizations_template_id_fk ON public.design_customizations USING btree (template_id);

CREATE INDEX idx_design_templates_category ON public.design_templates USING btree (category);

CREATE INDEX idx_events_user_id_fk ON public.events USING btree (user_id);

CREATE INDEX idx_job_descriptions_user_id_fk ON public.job_descriptions USING btree (user_id);

CREATE INDEX idx_newsletter_subscribers_email ON public.newsletter_subscribers USING btree (email);

CREATE INDEX idx_newsletter_subscribers_status ON public.newsletter_subscribers USING btree (status);

CREATE INDEX idx_optimizations_ats_score_optimized ON public.optimizations USING btree (ats_score_optimized) WHERE (ats_score_optimized IS NOT NULL);

CREATE INDEX idx_optimizations_ats_subscores_gin ON public.optimizations USING gin (ats_subscores);

CREATE INDEX idx_optimizations_ats_subscores_original_gin ON public.optimizations USING gin (ats_subscores_original);

CREATE INDEX idx_optimizations_ats_suggestions_gin ON public.optimizations USING gin (ats_suggestions);

CREATE INDEX idx_optimizations_ats_version ON public.optimizations USING btree (ats_version);

CREATE INDEX idx_optimizations_jd_id_fk ON public.optimizations USING btree (jd_id);

CREATE INDEX idx_optimizations_modification_count ON public.optimizations USING btree (ai_modification_count);

CREATE INDEX idx_optimizations_resume_id_fk ON public.optimizations USING btree (resume_id);

CREATE INDEX idx_resume_design_assignments_customization_id_fk ON public.resume_design_assignments USING btree (customization_id);

CREATE INDEX idx_resume_design_assignments_optimization_id ON public.resume_design_assignments USING btree (optimization_id);

CREATE INDEX idx_resume_design_assignments_original_template_id_performance ON public.resume_design_assignments USING btree (original_template_id);

CREATE INDEX idx_resume_design_assignments_previous_customization_id_fk ON public.resume_design_assignments USING btree (previous_customization_id);

CREATE INDEX idx_resume_design_assignments_template_id_performance ON public.resume_design_assignments USING btree (template_id);

CREATE INDEX idx_resume_design_assignments_user_id_fk ON public.resume_design_assignments USING btree (user_id);

CREATE INDEX idx_resume_design_assignments_user_optimization ON public.resume_design_assignments USING btree (user_id, optimization_id);

CREATE INDEX idx_resume_versions_session_id_fk ON public.resume_versions USING btree (session_id);

CREATE INDEX idx_resumes_user_id_fk ON public.resumes USING btree (user_id);

CREATE INDEX idx_session_messages ON public.chat_messages USING btree (session_id, created_at);

CREATE INDEX idx_style_customization_history_message_id ON public.style_customization_history USING btree (message_id);

CREATE INDEX idx_style_customization_history_session_id ON public.style_customization_history USING btree (session_id);

CREATE INDEX idx_style_history_created_at ON public.style_customization_history USING btree (created_at DESC);

CREATE INDEX idx_style_history_optimization_id ON public.style_customization_history USING btree (optimization_id);

CREATE INDEX idx_style_history_type ON public.style_customization_history USING btree (customization_type);

CREATE INDEX idx_style_history_user_id ON public.style_customization_history USING btree (user_id);

CREATE INDEX idx_user_sessions ON public.chat_sessions USING btree (user_id, last_activity_at DESC);

CREATE UNIQUE INDEX idx_version_number ON public.resume_versions USING btree (optimization_id, version_number);

CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers USING btree (email);

CREATE UNIQUE INDEX newsletter_subscribers_pkey ON public.newsletter_subscribers USING btree (id);

CREATE UNIQUE INDEX resume_design_assignments_optimization_id_key ON public.resume_design_assignments USING btree (optimization_id);

CREATE UNIQUE INDEX resume_design_assignments_pkey ON public.resume_design_assignments USING btree (id);

CREATE UNIQUE INDEX resume_versions_optimization_version_unique ON public.resume_versions USING btree (optimization_id, version_number);

CREATE UNIQUE INDEX resume_versions_pkey ON public.resume_versions USING btree (id);

CREATE UNIQUE INDEX style_customization_history_pkey ON public.style_customization_history USING btree (id);

CREATE UNIQUE INDEX unique_active_thread_per_optimization ON public.ai_threads USING btree (optimization_id, status) WHERE ((status)::text = 'active'::text);

CREATE UNIQUE INDEX design_templates_pkey ON public.design_templates USING btree (id);

CREATE INDEX idx_optimizations_created_at ON public.optimizations USING btree (created_at);

alter table "public"."agent_shadow_logs" add constraint "agent_shadow_logs_pkey" PRIMARY KEY using index "agent_shadow_logs_pkey";

alter table "public"."ai_threads" add constraint "ai_threads_pkey" PRIMARY KEY using index "ai_threads_pkey";

alter table "public"."amendment_requests" add constraint "amendment_requests_pkey" PRIMARY KEY using index "amendment_requests_pkey";

alter table "public"."beta_signups" add constraint "beta_signups_pkey" PRIMARY KEY using index "beta_signups_pkey";

alter table "public"."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY using index "chat_messages_pkey";

alter table "public"."content_modifications" add constraint "content_modifications_pkey" PRIMARY KEY using index "content_modifications_pkey";

alter table "public"."design_assignments" add constraint "design_assignments_pkey" PRIMARY KEY using index "design_assignments_pkey";

alter table "public"."design_customizations" add constraint "design_customizations_pkey" PRIMARY KEY using index "design_customizations_pkey";

alter table "public"."newsletter_subscribers" add constraint "newsletter_subscribers_pkey" PRIMARY KEY using index "newsletter_subscribers_pkey";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_pkey" PRIMARY KEY using index "resume_design_assignments_pkey";

alter table "public"."resume_versions" add constraint "resume_versions_pkey" PRIMARY KEY using index "resume_versions_pkey";

alter table "public"."style_customization_history" add constraint "style_customization_history_pkey" PRIMARY KEY using index "style_customization_history_pkey";

alter table "public"."design_templates" add constraint "design_templates_pkey" PRIMARY KEY using index "design_templates_pkey";

alter table "public"."ai_threads" add constraint "ai_threads_openai_thread_id_key" UNIQUE using index "ai_threads_openai_thread_id_key";

alter table "public"."ai_threads" add constraint "ai_threads_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."ai_threads" validate constraint "ai_threads_optimization_id_fkey";

alter table "public"."ai_threads" add constraint "ai_threads_session_id_fkey" FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."ai_threads" validate constraint "ai_threads_session_id_fkey";

alter table "public"."ai_threads" add constraint "ai_threads_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying, 'error'::character varying])::text[]))) not valid;

alter table "public"."ai_threads" validate constraint "ai_threads_status_check";

alter table "public"."ai_threads" add constraint "ai_threads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_threads" validate constraint "ai_threads_user_id_fkey";

alter table "public"."amendment_requests" add constraint "amendment_requests_message_id_fkey" FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_requests" validate constraint "amendment_requests_message_id_fkey";

alter table "public"."amendment_requests" add constraint "amendment_requests_session_id_fkey" FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."amendment_requests" validate constraint "amendment_requests_session_id_fkey";

alter table "public"."amendment_requests" add constraint "amendment_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'rejected'::text, 'needs_clarification'::text]))) not valid;

alter table "public"."amendment_requests" validate constraint "amendment_requests_status_check";

alter table "public"."amendment_requests" add constraint "amendment_requests_type_check" CHECK ((type = ANY (ARRAY['add'::text, 'modify'::text, 'remove'::text, 'clarify'::text]))) not valid;

alter table "public"."amendment_requests" validate constraint "amendment_requests_type_check";

alter table "public"."applications" add constraint "applications_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."applications" validate constraint "applications_optimization_id_fkey";

alter table "public"."applications" add constraint "applications_optimized_resume_id_fkey" FOREIGN KEY (optimized_resume_id) REFERENCES optimizations(id) ON DELETE SET NULL not valid;

alter table "public"."applications" validate constraint "applications_optimized_resume_id_fkey";

alter table "public"."applications" add constraint "applications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."applications" validate constraint "applications_user_id_fkey";

alter table "public"."beta_signups" add constraint "beta_signups_email_unique" UNIQUE using index "beta_signups_email_unique";

alter table "public"."chat_messages" add constraint "chat_messages_sender_check" CHECK ((sender = ANY (ARRAY['user'::text, 'ai'::text]))) not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_sender_check";

alter table "public"."chat_messages" add constraint "chat_messages_session_id_fkey" FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_session_id_fkey";

alter table "public"."chat_sessions" add constraint "chat_sessions_openai_thread_id_key" UNIQUE using index "chat_sessions_openai_thread_id_key";

alter table "public"."chat_sessions" add constraint "chat_sessions_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."chat_sessions" validate constraint "chat_sessions_optimization_id_fkey";

alter table "public"."chat_sessions" add constraint "chat_sessions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text]))) not valid;

alter table "public"."chat_sessions" validate constraint "chat_sessions_status_check";

alter table "public"."chat_sessions" add constraint "chat_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_sessions" validate constraint "chat_sessions_user_id_fkey";

alter table "public"."content_modifications" add constraint "content_modifications_applied_by_check" CHECK (((applied_by)::text = ANY ((ARRAY['ai_assistant'::character varying, 'user'::character varying, 'system'::character varying])::text[]))) not valid;

alter table "public"."content_modifications" validate constraint "content_modifications_applied_by_check";

alter table "public"."content_modifications" add constraint "content_modifications_message_id_fkey" FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL not valid;

alter table "public"."content_modifications" validate constraint "content_modifications_message_id_fkey";

alter table "public"."content_modifications" add constraint "content_modifications_operation_check" CHECK (((operation)::text = ANY ((ARRAY['replace'::character varying, 'prefix'::character varying, 'suffix'::character varying, 'append'::character varying, 'insert'::character varying, 'remove'::character varying])::text[]))) not valid;

alter table "public"."content_modifications" validate constraint "content_modifications_operation_check";

alter table "public"."content_modifications" add constraint "content_modifications_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."content_modifications" validate constraint "content_modifications_optimization_id_fkey";

alter table "public"."content_modifications" add constraint "content_modifications_reverted_by_modification_id_fkey" FOREIGN KEY (reverted_by_modification_id) REFERENCES content_modifications(id) not valid;

alter table "public"."content_modifications" validate constraint "content_modifications_reverted_by_modification_id_fkey";

alter table "public"."content_modifications" add constraint "content_modifications_session_id_fkey" FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."content_modifications" validate constraint "content_modifications_session_id_fkey";

alter table "public"."content_modifications" add constraint "content_modifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."content_modifications" validate constraint "content_modifications_user_id_fkey";

alter table "public"."content_modifications" add constraint "valid_score_range" CHECK ((((ats_score_before IS NULL) OR ((ats_score_before >= (0)::numeric) AND (ats_score_before <= (100)::numeric))) AND ((ats_score_after IS NULL) OR ((ats_score_after >= (0)::numeric) AND (ats_score_after <= (100)::numeric))))) not valid;

alter table "public"."content_modifications" validate constraint "valid_score_range";

alter table "public"."design_assignments" add constraint "design_assignments_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."design_assignments" validate constraint "design_assignments_optimization_id_fkey";

alter table "public"."design_assignments" add constraint "design_assignments_optimization_id_key" UNIQUE using index "design_assignments_optimization_id_key";

alter table "public"."design_assignments" add constraint "design_assignments_template_id_fkey" FOREIGN KEY (template_id) REFERENCES design_templates(id) ON DELETE SET NULL not valid;

alter table "public"."design_assignments" validate constraint "design_assignments_template_id_fkey";

alter table "public"."design_assignments" add constraint "design_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."design_assignments" validate constraint "design_assignments_user_id_fkey";

alter table "public"."design_customizations" add constraint "design_customizations_template_id_fkey" FOREIGN KEY (template_id) REFERENCES design_templates(id) ON DELETE CASCADE not valid;

alter table "public"."design_customizations" validate constraint "design_customizations_template_id_fkey";

alter table "public"."design_templates" add constraint "design_templates_ats_compatibility_score_check" CHECK (((ats_compatibility_score >= 0) AND (ats_compatibility_score <= 100))) not valid;

alter table "public"."design_templates" validate constraint "design_templates_ats_compatibility_score_check";

alter table "public"."design_templates" add constraint "design_templates_category_check" CHECK (((category)::text = ANY ((ARRAY['modern'::character varying, 'traditional'::character varying, 'creative'::character varying, 'corporate'::character varying])::text[]))) not valid;

alter table "public"."design_templates" validate constraint "design_templates_category_check";

alter table "public"."design_templates" add constraint "design_templates_name_key" UNIQUE using index "design_templates_name_key";

alter table "public"."design_templates" add constraint "design_templates_slug_key" UNIQUE using index "design_templates_slug_key";

alter table "public"."newsletter_subscribers" add constraint "newsletter_subscribers_email_key" UNIQUE using index "newsletter_subscribers_email_key";

alter table "public"."newsletter_subscribers" add constraint "newsletter_subscribers_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'unsubscribed'::text]))) not valid;

alter table "public"."newsletter_subscribers" validate constraint "newsletter_subscribers_status_check";

alter table "public"."optimizations" add constraint "check_ats_confidence_range" CHECK (((ats_confidence IS NULL) OR ((ats_confidence >= (0)::double precision) AND (ats_confidence <= (1)::double precision)))) not valid;

alter table "public"."optimizations" validate constraint "check_ats_confidence_range";

alter table "public"."optimizations" add constraint "check_ats_score_optimized_range" CHECK (((ats_score_optimized IS NULL) OR ((ats_score_optimized >= (0)::double precision) AND (ats_score_optimized <= (100)::double precision)))) not valid;

alter table "public"."optimizations" validate constraint "check_ats_score_optimized_range";

alter table "public"."optimizations" add constraint "check_ats_score_original_range" CHECK (((ats_score_original IS NULL) OR ((ats_score_original >= (0)::double precision) AND (ats_score_original <= (100)::double precision)))) not valid;

alter table "public"."optimizations" validate constraint "check_ats_score_original_range";

alter table "public"."optimizations" add constraint "optimizations_language_preference_check" CHECK ((language_preference = ANY (ARRAY['auto'::text, 'hebrew'::text, 'english'::text]))) not valid;

alter table "public"."optimizations" validate constraint "optimizations_language_preference_check";

alter table "public"."profiles" add constraint "profiles_plan_type_check" CHECK ((plan_type = ANY (ARRAY['free'::text, 'premium'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_plan_type_check";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_customization_id_fkey" FOREIGN KEY (customization_id) REFERENCES design_customizations(id) ON DELETE SET NULL not valid;

alter table "public"."resume_design_assignments" validate constraint "resume_design_assignments_customization_id_fkey";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."resume_design_assignments" validate constraint "resume_design_assignments_optimization_id_fkey";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_optimization_id_key" UNIQUE using index "resume_design_assignments_optimization_id_key";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_original_template_id_fkey" FOREIGN KEY (original_template_id) REFERENCES design_templates(id) ON DELETE RESTRICT not valid;

alter table "public"."resume_design_assignments" validate constraint "resume_design_assignments_original_template_id_fkey";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_previous_customization_id_fkey" FOREIGN KEY (previous_customization_id) REFERENCES design_customizations(id) ON DELETE SET NULL not valid;

alter table "public"."resume_design_assignments" validate constraint "resume_design_assignments_previous_customization_id_fkey";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_template_id_fkey" FOREIGN KEY (template_id) REFERENCES design_templates(id) ON DELETE RESTRICT not valid;

alter table "public"."resume_design_assignments" validate constraint "resume_design_assignments_template_id_fkey";

alter table "public"."resume_design_assignments" add constraint "resume_design_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE not valid;

alter table "public"."resume_design_assignments" validate constraint "resume_design_assignments_user_id_fkey";

alter table "public"."resume_versions" add constraint "resume_versions_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."resume_versions" validate constraint "resume_versions_optimization_id_fkey";

alter table "public"."resume_versions" add constraint "resume_versions_optimization_version_unique" UNIQUE using index "resume_versions_optimization_version_unique";

alter table "public"."resume_versions" add constraint "resume_versions_session_id_fkey" FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."resume_versions" validate constraint "resume_versions_session_id_fkey";

alter table "public"."style_customization_history" add constraint "style_customization_history_customization_type_check" CHECK (((customization_type)::text = ANY ((ARRAY['color'::character varying, 'font'::character varying, 'spacing'::character varying, 'layout'::character varying, 'mixed'::character varying])::text[]))) not valid;

alter table "public"."style_customization_history" validate constraint "style_customization_history_customization_type_check";

alter table "public"."style_customization_history" add constraint "style_customization_history_message_id_fkey" FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL not valid;

alter table "public"."style_customization_history" validate constraint "style_customization_history_message_id_fkey";

alter table "public"."style_customization_history" add constraint "style_customization_history_optimization_id_fkey" FOREIGN KEY (optimization_id) REFERENCES optimizations(id) ON DELETE CASCADE not valid;

alter table "public"."style_customization_history" validate constraint "style_customization_history_optimization_id_fkey";

alter table "public"."style_customization_history" add constraint "style_customization_history_session_id_fkey" FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."style_customization_history" validate constraint "style_customization_history_session_id_fkey";

alter table "public"."style_customization_history" add constraint "style_customization_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."style_customization_history" validate constraint "style_customization_history_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_default_template()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_subscription_limit(user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Check subscription limit (currently disabled - returns TRUE)
    -- Future: Implement actual check against profiles.plan_type
    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ats_improvement(optimization_id uuid)
 RETURNS real
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.increment_optimization_usage(user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Increment optimization usage (currently disabled - returns TRUE)
    -- Future: Implement actual increment
    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_ats_v2(optimization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_version INTEGER;
BEGIN
  SELECT ats_version INTO v_version
  FROM optimizations
  WHERE id = optimization_id;

  RETURN COALESCE(v_version, 1) >= 2;
END;
$function$
;

create or replace view "public"."optimizations_with_ats_v2" as  SELECT id,
    user_id,
    resume_id,
    jd_id,
    created_at,
    status,
    template_key,
    match_score AS legacy_score,
    ats_version,
    ats_score_original,
    ats_score_optimized,
        CASE
            WHEN ((ats_score_original IS NOT NULL) AND (ats_score_optimized IS NOT NULL)) THEN (ats_score_optimized - ats_score_original)
            ELSE NULL::real
        END AS ats_score_improvement,
    (ats_subscores -> 'keyword_exact'::text) AS subscore_keyword_exact,
    (ats_subscores -> 'keyword_phrase'::text) AS subscore_keyword_phrase,
    (ats_subscores -> 'semantic_relevance'::text) AS subscore_semantic_relevance,
    (ats_subscores -> 'title_alignment'::text) AS subscore_title_alignment,
    (ats_subscores -> 'metrics_presence'::text) AS subscore_metrics_presence,
    (ats_subscores -> 'section_completeness'::text) AS subscore_section_completeness,
    (ats_subscores -> 'format_parseability'::text) AS subscore_format_parseability,
    (ats_subscores -> 'recency_fit'::text) AS subscore_recency_fit,
    ats_subscores,
    ats_suggestions,
    ats_confidence
   FROM optimizations o;


CREATE OR REPLACE FUNCTION public.update_session_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE chat_sessions
  SET last_activity_at = NOW(), updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.applications_update_search()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.search := to_tsvector('simple', coalesce(NEW.job_title,'') || ' ' || coalesce(NEW.company_name,''));
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_files(bucket_name text, days_old integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE 
    deleted_count INTEGER := 0; 
BEGIN 
    -- Function body preserved as-is
    RETURN deleted_count; 
END; 
$function$
;

CREATE OR REPLACE FUNCTION public.generate_file_path(user_uuid uuid, filename text, file_type text DEFAULT 'upload'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_optimizations_used(user_id_param uuid, max_allowed integer)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.increment_rate_limit(p_identifier text, p_endpoint text, p_window_ms bigint)
 RETURNS TABLE(requests_count integer, window_start timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_applications_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;


  create policy "Users can insert own agent shadow logs"
  on "public"."agent_shadow_logs"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view own agent shadow logs"
  on "public"."agent_shadow_logs"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own threads"
  on "public"."ai_threads"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own threads"
  on "public"."ai_threads"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own threads"
  on "public"."ai_threads"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own threads"
  on "public"."ai_threads"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "amendment_requests_insert_own"
  on "public"."amendment_requests"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = amendment_requests.session_id) AND (chat_sessions.user_id = auth.uid())))));



  create policy "amendment_requests_select_own"
  on "public"."amendment_requests"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = amendment_requests.session_id) AND (chat_sessions.user_id = auth.uid())))));



  create policy "amendment_requests_service_role"
  on "public"."amendment_requests"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "amendment_requests_update_own"
  on "public"."amendment_requests"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = amendment_requests.session_id) AND (chat_sessions.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = amendment_requests.session_id) AND (chat_sessions.user_id = auth.uid())))));



  create policy "Users can delete own applications"
  on "public"."applications"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "applications_insert_own"
  on "public"."applications"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "applications_select_own"
  on "public"."applications"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "applications_service_role"
  on "public"."applications"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "applications_update_own"
  on "public"."applications"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Anyone can insert beta signup"
  on "public"."beta_signups"
  as permissive
  for insert
  to anon, authenticated
with check (((accepted_terms = true) AND (accepted_privacy = true) AND (email IS NOT NULL)));



  create policy "chat_messages_insert_own"
  on "public"."chat_messages"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.user_id = auth.uid())))));



  create policy "chat_messages_select_own"
  on "public"."chat_messages"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.user_id = auth.uid())))));



  create policy "chat_messages_service_role"
  on "public"."chat_messages"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "chat_sessions_insert_own"
  on "public"."chat_sessions"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM optimizations
  WHERE ((optimizations.id = chat_sessions.optimization_id) AND (optimizations.user_id = auth.uid()))))));



  create policy "chat_sessions_select_own"
  on "public"."chat_sessions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "chat_sessions_service_role"
  on "public"."chat_sessions"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "chat_sessions_update_own"
  on "public"."chat_sessions"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can create own modifications"
  on "public"."content_modifications"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own modifications"
  on "public"."content_modifications"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own modifications"
  on "public"."content_modifications"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can delete own design assignments"
  on "public"."design_assignments"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Users can insert own design assignments"
  on "public"."design_assignments"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "Users can update own design assignments"
  on "public"."design_assignments"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "Users can view own design assignments"
  on "public"."design_assignments"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "Customizations deletable by assignment owner"
  on "public"."design_customizations"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM resume_design_assignments rda
  WHERE (((rda.customization_id = design_customizations.id) OR (rda.previous_customization_id = design_customizations.id)) AND (rda.user_id = auth.uid())))));



  create policy "Customizations insertable by assignment owner"
  on "public"."design_customizations"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM resume_design_assignments rda
  WHERE ((rda.template_id = design_customizations.template_id) AND (rda.user_id = auth.uid())))));



  create policy "Customizations updatable by assignment owner"
  on "public"."design_customizations"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM resume_design_assignments rda
  WHERE (((rda.customization_id = design_customizations.id) OR (rda.previous_customization_id = design_customizations.id)) AND (rda.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM resume_design_assignments rda
  WHERE (((rda.customization_id = design_customizations.id) OR (rda.previous_customization_id = design_customizations.id)) AND (rda.user_id = auth.uid())))));



  create policy "design_customizations_insert_authenticated"
  on "public"."design_customizations"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "design_customizations_select_own"
  on "public"."design_customizations"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM resume_design_assignments rda
  WHERE (((rda.customization_id = design_customizations.id) OR (rda.previous_customization_id = design_customizations.id)) AND (rda.user_id = auth.uid())))));



  create policy "design_customizations_service_role"
  on "public"."design_customizations"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Templates deletable by service role"
  on "public"."design_templates"
  as permissive
  for delete
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "Templates insertable by service role"
  on "public"."design_templates"
  as permissive
  for insert
  to public
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "Templates updatable by service role"
  on "public"."design_templates"
  as permissive
  for update
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "Templates viewable by authenticated or service role"
  on "public"."design_templates"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = ANY (ARRAY['authenticated'::text, 'service_role'::text])));



  create policy "design_templates_select_authenticated"
  on "public"."design_templates"
  as permissive
  for select
  to authenticated
using (true);



  create policy "design_templates_service_role"
  on "public"."design_templates"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Users can delete their own job descriptions"
  on "public"."job_descriptions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own job descriptions"
  on "public"."job_descriptions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view their own job descriptions"
  on "public"."job_descriptions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "job_descriptions_delete_own"
  on "public"."job_descriptions"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "job_descriptions_insert_own"
  on "public"."job_descriptions"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "job_descriptions_select_own"
  on "public"."job_descriptions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "job_descriptions_service_role"
  on "public"."job_descriptions"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "job_descriptions_update_own"
  on "public"."job_descriptions"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Anyone can subscribe to newsletter"
  on "public"."newsletter_subscribers"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can view their own subscription"
  on "public"."newsletter_subscribers"
  as permissive
  for select
  to public
using (((auth.jwt() ->> 'email'::text) = email));



  create policy "Users can delete their own optimizations"
  on "public"."optimizations"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own optimizations"
  on "public"."optimizations"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view their own optimizations"
  on "public"."optimizations"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "optimizations_delete_own"
  on "public"."optimizations"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "optimizations_insert_own"
  on "public"."optimizations"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "optimizations_select_own"
  on "public"."optimizations"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "optimizations_service_role"
  on "public"."optimizations"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "optimizations_update_own"
  on "public"."optimizations"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can update their own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can view their own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "profiles_service_role"
  on "public"."profiles"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Assignments deletable by owner"
  on "public"."resume_design_assignments"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "resume_design_assignments_insert_own"
  on "public"."resume_design_assignments"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "resume_design_assignments_select_own"
  on "public"."resume_design_assignments"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "resume_design_assignments_service_role"
  on "public"."resume_design_assignments"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "resume_design_assignments_update_own"
  on "public"."resume_design_assignments"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "resume_versions_insert_own"
  on "public"."resume_versions"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM optimizations
  WHERE ((optimizations.id = resume_versions.optimization_id) AND (optimizations.user_id = auth.uid())))));



  create policy "resume_versions_select_own"
  on "public"."resume_versions"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM optimizations
  WHERE ((optimizations.id = resume_versions.optimization_id) AND (optimizations.user_id = auth.uid())))));



  create policy "resume_versions_service_role"
  on "public"."resume_versions"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Users can delete their own resumes"
  on "public"."resumes"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own resumes"
  on "public"."resumes"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view their own resumes"
  on "public"."resumes"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "resumes_delete_own"
  on "public"."resumes"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "resumes_insert_own"
  on "public"."resumes"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "resumes_select_own"
  on "public"."resumes"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "resumes_service_role"
  on "public"."resumes"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "resumes_update_own"
  on "public"."resumes"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can create own style history"
  on "public"."style_customization_history"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view own style history"
  on "public"."style_customization_history"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Authenticated users can view templates"
  on "public"."templates"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));


CREATE TRIGGER applications_update_search_trigger BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION applications_update_search();

CREATE TRIGGER update_applications_updated_at_trigger BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION update_applications_updated_at();

CREATE TRIGGER on_message_created AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION update_session_activity();

CREATE TRIGGER trigger_update_session_activity AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION update_session_activity();

CREATE TRIGGER update_design_assignments_updated_at BEFORE UPDATE ON public.design_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_design_templates_updated_at BEFORE UPDATE ON public.design_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_subscribers_updated_at BEFORE UPDATE ON public.newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_assign_default_template AFTER INSERT ON public.optimizations FOR EACH ROW EXECUTE FUNCTION assign_default_template();

CREATE TRIGGER update_resume_design_assignments_updated_at BEFORE UPDATE ON public.resume_design_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


