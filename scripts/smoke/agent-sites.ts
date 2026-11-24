/**
 * Live smoke for the agent intent classifier (max_tokens 5). The LLM planner was
 * deleted in the 2026-11-24 prompt upgrade (its output only went to an actions log).
 *   npx tsx scripts/smoke/agent-sites.ts            # current
 *   OPENAI_MODEL_FAST=gpt-6-luna npx tsx scripts/smoke/agent-sites.ts
 * A reasoning model with any effort above "none" can spend the 5-token budget on
 * reasoning and return an empty label; intents.ts pins effort "none".
 */
import OpenAI from 'openai';
import { classifyIntentLLM } from '../../src/lib/agent/intents';
import { adaptChatParams, selectModel } from '../../src/lib/model-tiers';

const COMMANDS = ['make my summary punchier', 'add Kubernetes to skills', 'export as PDF', 'undo that', 'תשפר את הניסוח של הניסיון שלי'];

async function main() {
  console.log(`# FAST=${selectModel('FAST', 'gpt-4o-mini').model}`);
  for (const command of COMMANDS) {
    const t = Date.now();
    const label = await classifyIntentLLM(command);
    console.log(JSON.stringify({ site: 'agent.classifyIntent', command, ok: label !== null, label, ms: Date.now() - t }));
  }
  // Negative control: the same 5-token call at effort "low" on a reasoning model.
  const sel = selectModel('FAST', 'gpt-4o-mini', 'low');
  if (sel.reasoningEffort) {
    const r = await new OpenAI().chat.completions.create(adaptChatParams(sel, {
      temperature: 0, max_tokens: 5,
      messages: [{ role: 'system', content: 'You return only one word from the provided labels.' }, { role: 'user', content: 'Classify: rewrite | export | undo. Command: export as PDF' }],
    }));
    console.log(JSON.stringify({ control: 'effort low, 5 tokens', content: r.choices[0]?.message?.content, finish: r.choices[0]?.finish_reason, usage: r.usage?.completion_tokens_details }));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
