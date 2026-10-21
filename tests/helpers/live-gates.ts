import { describe } from '@jest/globals';

/**
 * Suites that call paid or shared external systems run only on explicit opt-in,
 * never in the default `npx jest`. Skipped suites still show in the summary.
 *
 * RUN_LIVE_AI_TESTS=1 (plus OPENAI_API_KEY): real OpenAI calls, cost money and vary per run.
 * RUN_LIVE_BACKEND_TESTS=1: real Supabase project and a running app server; signs up users.
 */
export const RUN_LIVE_AI =
  process.env.RUN_LIVE_AI_TESTS === '1' && Boolean(process.env.OPENAI_API_KEY);
export const RUN_LIVE_BACKEND = process.env.RUN_LIVE_BACKEND_TESTS === '1';

export const describeLiveAI = RUN_LIVE_AI ? describe : describe.skip;
export const describeLiveBackend = RUN_LIVE_BACKEND ? describe : describe.skip;
