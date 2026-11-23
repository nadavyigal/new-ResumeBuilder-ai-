/**
 * Resume editor assistant on the Responses API (replaces the Assistants API,
 * shut down 2026-08-26). No network: the OpenAI client is a stub.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/posthog-ai', () => ({ captureAiGenerationEvent: jest.fn(async () => undefined) }));

import { AssistantManager, RESPONSE_TOOLS } from '@/lib/chat-manager/assistant-manager';
import { createEmptyContext } from '@/lib/chat-manager/memory-manager';

function stubClient(responses: any[]) {
  const create = jest.fn(async (params: any) => (params ? responses.shift() : undefined));
  const client = {
    responses: { create },
    conversations: {
      create: jest.fn(async () => ({ id: 'conv_new' })),
      retrieve: jest.fn(async (id: string) => ({ id })),
    },
  };
  return { client: client as any, create, conversationsCreate: client.conversations.create };
}

const context = createEmptyContext('opt-1', { summary: 'Engineer' }, { template_id: 'minimal-ssr' });

describe('AssistantManager (Responses API)', () => {
  beforeEach(() => {
    delete process.env.OPENAI_MODEL_FAST;
    delete process.env.OPENAI_REASONING_EFFORT_FAST;
  });

  it('maps every Assistants function to a Responses function tool', () => {
    expect(RESPONSE_TOOLS.map((t) => t.name)).toEqual(['update_design', 'update_content', 'clarify_request']);
    expect(RESPONSE_TOOLS.every((t) => t.type === 'function' && t.strict === false)).toBe(true);
  });

  it('creates a conversation, acknowledges tool calls and returns the final text', async () => {
    const { client, create, conversationsCreate } = stubClient([
      {
        status: 'completed',
        output: [{ type: 'function_call', name: 'update_content', call_id: 'call_1', arguments: '{"section":"skills","operation":"add","value":"SQL"}' }],
        output_text: '',
        usage: { input_tokens: 100, output_tokens: 20, output_tokens_details: { reasoning_tokens: 0 } },
      },
      { status: 'completed', output: [], output_text: 'Added SQL to your skills.', usage: { input_tokens: 120, output_tokens: 10 } },
    ]);
    const manager = new AssistantManager({ apiKey: 'test', client });

    const out = await manager.runAssistant({ threadId: '', userMessage: 'add SQL', resumeContext: context });

    expect(conversationsCreate).toHaveBeenCalledTimes(1);
    expect(out.threadId).toBe('conv_new');
    expect(out.response).toBe('Added SQL to your skills.');
    expect(out.functionCalls).toEqual([{ name: 'update_content', params: { section: 'skills', operation: 'add', value: 'SQL' }, result: null }]);
    expect(out.requiresClarification).toBe(false);

    const first = create.mock.calls[0][0] as any;
    expect(first.model).toBe('gpt-6-luna');
    expect(first.reasoning).toEqual({ effort: 'none' });
    expect(first.conversation).toBe('conv_new');
    expect(first.instructions).toContain('You are an AI resume assistant focused on precise, ATS-safe improvements.');
    expect(first.input[0].content).toContain('User Request: add SQL');
    expect(first).not.toHaveProperty('temperature');

    const second = create.mock.calls[1][0] as any;
    expect(second.input).toEqual([
      { type: 'function_call_output', call_id: 'call_1', output: JSON.stringify({ success: true, message: 'Function will be executed' }) },
    ]);
  });

  it('reuses an existing conversation and flags clarification', async () => {
    const { client, create, conversationsCreate } = stubClient([
      { status: 'completed', output: [{ type: 'function_call', name: 'clarify_request', call_id: 'c', arguments: '{"question":"Which role?","suggestions":[]}' }], output_text: '' },
      { status: 'completed', output: [], output_text: 'Which role?' },
    ]);
    const out = await new AssistantManager({ apiKey: 'test', client }).runAssistant({ threadId: 'conv_old', userMessage: 'fix it', resumeContext: context });
    expect(conversationsCreate).not.toHaveBeenCalled();
    expect((create.mock.calls[0][0] as any).conversation).toBe('conv_old');
    expect(out.requiresClarification).toBe(true);
  });

  it('throws when the response does not complete', async () => {
    const { client } = stubClient([{ status: 'incomplete', output: [], output_text: '' }]);
    await expect(
      new AssistantManager({ apiKey: 'test', client }).runAssistant({ threadId: 'conv_x', userMessage: 'hi', resumeContext: context })
    ).rejects.toThrow('Assistant run failed: incomplete');
  });

  it('honours OPENAI_MODEL_FAST', async () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-4o-mini';
    const { client, create } = stubClient([{ status: 'completed', output: [], output_text: 'ok' }]);
    await new AssistantManager({ apiKey: 'test', client }).runAssistant({ threadId: 'conv_x', userMessage: 'hi', resumeContext: context });
    const params = create.mock.calls[0][0] as any;
    expect(params.model).toBe('gpt-4o-mini');
    expect(params).not.toHaveProperty('reasoning');
  });
});
