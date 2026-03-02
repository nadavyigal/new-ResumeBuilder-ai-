/**
 * PostHog Analytics Event Constants
 * Centralized, typed event names for the ResumeBuilder AI application.
 * All PostHog event names should be referenced from here to prevent typos.
 */

// ─── Auth Events ───────────────────────────────────────────────
export const AUTH_EVENTS = {
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
} as const;

// ─── ATS Checker Events (Landing Page) ────────────────────────
export const ATS_CHECKER_EVENTS = {
  VIEW: 'ats_checker_view',
  FILE_UPLOADED: 'ats_checker_file_uploaded',
  SUBMITTED: 'ats_checker_submitted',
  SCORE_DISPLAYED: 'ats_checker_score_displayed',
  RATE_LIMITED: 'ats_checker_rate_limited',
  SIGNUP_CLICKED: 'ats_checker_signup_clicked',
  SHARE_CLICKED: 'ats_checker_share_clicked',
  SESSION_CONVERTED: 'ats_checker_session_converted',
} as const;

// ─── Resume Flow Events ───────────────────────────────────────
export const RESUME_EVENTS = {
  UPLOADED: 'resume_uploaded',
  JOB_DESCRIPTION_ADDED: 'job_description_added',
  OPTIMIZATION_STARTED: 'optimization_started',
  OPTIMIZATION_VIEWED: 'optimization_viewed',
  OPTIMIZATION_ERROR: 'optimization_error',
  DOWNLOADED: 'resume_downloaded',
  DOWNLOAD_ERROR: 'download_error',
  COPIED: 'resume_copied',
} as const;

// ─── Chat Events ──────────────────────────────────────────────
export const CHAT_EVENTS = {
  OPENED: 'chat_opened',
  MESSAGE_SENT: 'chat_message_sent',
} as const;

// ─── Design Events ────────────────────────────────────────────
export const DESIGN_EVENTS = {
  BROWSER_OPENED: 'design_browser_opened',
  SELECTED: 'design_selected',
} as const;

// ─── Application Tracking Events ──────────────────────────────
export const APPLICATION_EVENTS = {
  CREATED: 'application_created',
  ADDED_FROM_URL: 'application_added_from_url',
} as const;

// ─── Engagement Events ────────────────────────────────────────
export const ENGAGEMENT_EVENTS = {
  NEWSLETTER_SIGNUP: 'newsletter_signup',
} as const;

// ─── Flat export of all event names ───────────────────────────
export const EVENTS = {
  ...AUTH_EVENTS,
  ...ATS_CHECKER_EVENTS,
  ...RESUME_EVENTS,
  ...CHAT_EVENTS,
  ...DESIGN_EVENTS,
  ...APPLICATION_EVENTS,
  ...ENGAGEMENT_EVENTS,
} as const;
