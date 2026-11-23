/**
 * OpenAI model tiers.
 *
 * Every model id used on the server comes from here. Each tier reads one env
 * var; the code default is passed by the call site, so a call site keeps its
 * current model until the env var is set. Rollback = unset the env var.
 *
 *   OPENAI_MODEL_PLAN    core CV tailoring           target gpt-6.2-sol
 *   OPENAI_MODEL_WRITER  cover letters, rewrites     target gpt-6.1-terra
 *   OPENAI_MODEL_FAST    small high-volume tasks     target gpt-6-luna
 *
 *   OPENAI_REASONING_EFFORT_PLAN / _WRITER / _FAST   override the effort below
 *
 * The gpt-5 / gpt-6 families are reasoning models. Checked against the live
 * API on 2026-11-23: they reject `temperature` (other than 1), `top_p` and
 * `max_tokens` (use `max_completion_tokens`), and gpt-6.2-sol rejects effort
 * "none". `adaptChatParams` handles all of that for reasoning ids only, so the
 * current non-reasoning defaults are sent exactly as before.
 */

import type OpenAI from 'openai';

export type ModelTier = 'PLAN' | 'WRITER' | 'FAST';

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

const EFFORTS: readonly ReasoningEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Target ids, verified on developers.openai.com/api/docs/models on 2026-11-23. */
export const TARGET_MODELS = {
  PLAN: 'gpt-6.2-sol',
  WRITER: 'gpt-6.1-terra',
  FAST: 'gpt-6-luna',
} as const satisfies Record<ModelTier, string>;

const DEFAULT_EFFORT: Record<ModelTier, ReasoningEffort> = {
  PLAN: 'low',
  WRITER: 'low',
  FAST: 'none',
};

export interface ModelSelection {
  tier: ModelTier;
  model: string;
  /** Set only when `model` is a reasoning model. */
  reasoningEffort?: ReasoningEffort;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** True for model families that take `reasoning_effort` and reject sampling params. */
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5|gpt-6)/i.test(model.trim());
}

/** Models that reject effort "none" (lowest accepted is "low"). */
function rejectsNoneEffort(model: string): boolean {
  return /^gpt-6\.2-sol/i.test(model.trim());
}

function normalizeEffort(model: string, effort: ReasoningEffort): ReasoningEffort {
  if ((effort === 'none' || effort === 'minimal') && rejectsNoneEffort(model)) return 'low';
  return effort;
}

/**
 * Resolve the model for a tier.
 * @param codeDefault the model this call site used before tiers existed
 * @param effortOverride a fixed effort for this call site (wins over the tier env var)
 * @param overrideEnv an older per-feature env var (e.g. AGENT_SDK_MODEL); it keeps
 *   priority over the tier env var so existing settings behave as before
 */
export function selectModel(
  tier: ModelTier,
  codeDefault: string,
  effortOverride?: ReasoningEffort,
  overrideEnv?: string
): ModelSelection {
  const model =
    (overrideEnv ? readEnv(overrideEnv) : undefined) ?? readEnv(`OPENAI_MODEL_${tier}`) ?? codeDefault;
  if (!isReasoningModel(model)) return { tier, model };

  const envEffort = readEnv(`OPENAI_REASONING_EFFORT_${tier}`) as ReasoningEffort | undefined;
  const effort =
    effortOverride ??
    (envEffort && EFFORTS.includes(envEffort) ? envEffort : DEFAULT_EFFORT[tier]);
  return { tier, model, reasoningEffort: normalizeEffort(model, effort) };
}

/**
 * Make Chat Completions params safe for the selected model.
 * Non-reasoning models: params are returned unchanged apart from `model`.
 * Reasoning models: drops temperature/top_p, renames max_tokens to
 * max_completion_tokens and adds reasoning_effort.
 */
export function adaptChatParams(
  selection: ModelSelection,
  params: Omit<ChatParams, 'model'>
): ChatParams {
  const out: Record<string, unknown> = { ...params, model: selection.model };
  if (!isReasoningModel(selection.model)) return out as unknown as ChatParams;

  delete out.temperature;
  delete out.top_p;
  delete out.presence_penalty;
  delete out.frequency_penalty;
  if (out.max_tokens !== undefined) {
    if (out.max_completion_tokens === undefined) out.max_completion_tokens = out.max_tokens;
    delete out.max_tokens;
  }
  if (selection.reasoningEffort) out.reasoning_effort = selection.reasoningEffort;
  return out as unknown as ChatParams;
}

export interface TokenUsageLog {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

/** Read token counts from a Chat Completions or Responses API usage object. */
export function readUsage(usage: unknown): TokenUsageLog {
  const u = (usage ?? {}) as Record<string, any>;
  return {
    inputTokens: u.prompt_tokens ?? u.input_tokens,
    outputTokens: u.completion_tokens ?? u.output_tokens,
    reasoningTokens:
      u.completion_tokens_details?.reasoning_tokens ?? u.output_tokens_details?.reasoning_tokens,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens,
  };
}

/**
 * One structured log line per model call, so cost per call site can be compared
 * before and after a tier switch. Reasoning tokens bill as output.
 */
export function logModelUsage(
  callSite: string,
  selection: ModelSelection,
  usage: TokenUsageLog,
  latencyMs: number
): void {
  console.info(
    JSON.stringify({
      event: 'openai_usage',
      callSite,
      tier: selection.tier,
      model: selection.model,
      reasoningEffort: selection.reasoningEffort ?? null,
      latencyMs,
      ...usage,
    })
  );
}
