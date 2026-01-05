/**
 * Agent SDK feature flags and model selection.
 * These allow safe rollout and shadow traffic without impacting production.
 */
export const agentFlags = {
  enabled: process.env.AGENT_SDK_ENABLED === 'true',
  shadow: process.env.AGENT_SDK_SHADOW === 'true',
  model: process.env.AGENT_SDK_MODEL ?? 'gpt-4o-mini',
};

