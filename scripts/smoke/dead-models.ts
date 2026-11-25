/**
 * Live smoke test for the dead-model fix (chat assistant + design recommender).
 * Calls the real OpenAI API with a local OPENAI_API_KEY. Not part of `npm test`.
 *
 *   OPENAI_API_KEY=... npx tsx scripts/smoke/dead-models.ts
 *   OPENAI_REASONING_EFFORT_FAST=low npx tsx scripts/smoke/dead-models.ts
 *
 * Usage lines (`openai_usage`) are printed by the code under test.
 */
import OpenAI from 'openai';
import { AssistantManager } from '../../src/lib/chat-manager/assistant-manager';
import { createEmptyContext } from '../../src/lib/chat-manager/memory-manager';
import { recommendTemplate } from '../../src/lib/design-manager/design-recommender';
import { resolveAssistantModel } from '../../src/lib/chat-manager/assistant-manager';

const resume = {
  summary: 'Backend engineer with 6 years building payment APIs in Go and Python.',
  skills: ['Go', 'Python', 'PostgreSQL', 'Kafka'],
  experience: [
    { title: 'Senior Backend Engineer', company: 'PayCo', startDate: '2021-03-01', endDate: 'Present', achievements: ['Cut p95 latency of the ledger API from 900ms to 250ms'] },
    { title: 'Backend Engineer', company: 'ShopIt', startDate: '2018-06-01', endDate: '2021-02-01', achievements: ['Built the order service used by 40 merchants'] },
  ],
};

const chatCases = [
  'Change the background to light blue',
  'Add SQL and Docker to my skills',
  'make it better',
  'תוסיף Terraform לכישורים',
  'apply tip 2',
];

const designCases = [
  'Senior backend engineer, fintech, Go and Kafka',
  'UX/UI designer for a consumer mobile app, portfolio required',
  'Head of Operations, management consulting firm',
  'Account executive, B2B SaaS sales, quota carrying',
  'מנהל מוצר בכיר בחברת סייבר',
];

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const sel = resolveAssistantModel();
  console.log(`\n# chat assistant: ${sel.model} effort=${sel.reasoningEffort ?? '-'}`);
  const manager = new AssistantManager({ apiKey: process.env.OPENAI_API_KEY });
  const context = createEmptyContext('smoke-opt', resume as any, { template_id: 'minimal-ssr' });

  let conv = '';
  for (const message of chatCases) {
    const t = Date.now();
    try {
      const out = await manager.runAssistant({ threadId: '', userMessage: message, resumeContext: context });
      conv = out.threadId;
      console.log(JSON.stringify({ case: message, ok: true, ms: Date.now() - t, calls: out.functionCalls.map((c) => ({ name: c.name, params: c.params })), clarify: out.requiresClarification, reply: out.response.slice(0, 160) }));
    } catch (error) {
      console.log(JSON.stringify({ case: message, ok: false, ms: Date.now() - t, error: String(error) }));
    }
  }

  // Conversation state: a follow-up on the last conversation must see the earlier turn.
  const follow = await manager.runAssistant({ threadId: conv, userMessage: 'What did I just ask you to do?', resumeContext: context });
  console.log(JSON.stringify({ case: 'follow-up in same conversation', reply: follow.response.slice(0, 200) }));

  // A stored Assistants thread id must fail validation (ensureThread then makes a new conversation).
  try {
    await new OpenAI().conversations.retrieve('thread_abc123');
    console.log('legacy thread id: unexpectedly valid');
  } catch (error: any) {
    console.log(`legacy thread id rejected as expected: ${error?.status} ${String(error?.message).slice(0, 80)}`);
  }

  console.log('\n# design recommender');
  for (const job of designCases) {
    const t = Date.now();
    const out = await recommendTemplate({ content: resume }, job);
    console.log(JSON.stringify({ case: job, ms: Date.now() - t, ...out }));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
