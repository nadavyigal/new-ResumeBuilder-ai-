/**
 * Agent SDK feature flags and model selection.
 * These allow safe rollout and shadow traffic without impacting production.
 */

import { selectModel, type ModelSelection, type ReasoningEffort } from '@/lib/model-tiers';
/**
 * Agent SDK model: AGENT_SDK_MODEL (kept, highest priority), then OPENAI_MODEL_FAST,
 * then gpt-4o-mini. intents.ts never read AGENT_SDK_MODEL and still does not (it
 * is set in production; honoring it there would change models on merge); it uses
 * the FAST tier directly.
 */
export function selectAgentModel(effortOverride?: ReasoningEffort): ModelSelection {
  return selectModel('FAST', 'gpt-4o-mini', effortOverride, 'AGENT_SDK_MODEL');
}

export const agentFlags = {
  enabled: process.env.AGENT_SDK_ENABLED === 'true',
  shadow: process.env.AGENT_SDK_SHADOW === 'true',
  model: selectAgentModel().model,
};

