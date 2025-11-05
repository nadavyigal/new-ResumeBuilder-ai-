/**
 * Agent SDK feature flags and model selection.
 * These allow safe rollout and shadow traffic without impacting production.
 */
export const AGENT_SDK_MODEL_DEFAULT = "gpt-4o-mini";

export const AGENT_SDK_ENABLED = process.env.AGENT_SDK_ENABLED === "true";
export const AGENT_SDK_SHADOW = process.env.AGENT_SDK_SHADOW === "true";
export const AGENT_SDK_MODEL = process.env.AGENT_SDK_MODEL ?? AGENT_SDK_MODEL_DEFAULT;

export const agentFlags = Object.freeze({
  enabled: AGENT_SDK_ENABLED,
  shadow: AGENT_SDK_SHADOW,
  model: AGENT_SDK_MODEL,
});

export type AgentFlags = typeof agentFlags;

