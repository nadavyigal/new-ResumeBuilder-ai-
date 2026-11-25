/**
 * Agent intent classifier and planner on model tiers. No network.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

const mockCreate = jest.fn() as jest.Mock<any>;
jest.mock('openai', () => ({
  __esModule: true,
  default: function MockOpenAI() {
    return { chat: { completions: { create: (...args: any[]) => mockCreate(...args) } } };
  },
}));

import { classifyIntentLLM } from '@/lib/agent/intents';

describe('agent model tiers', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'test';
    delete process.env.OPENAI_MODEL_FAST;
    delete process.env.OPENAI_MODEL_WRITER;
    delete process.env.AGENT_SDK_MODEL;
  });

  it('intent classifier: unchanged params on the current model, AGENT_SDK_MODEL ignored as before', async () => {
    process.env.AGENT_SDK_MODEL = 'gpt-4o';
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'export' } }] });
    expect(await classifyIntentLLM('export as PDF')).toBe('export');
    const params = mockCreate.mock.calls[0][0];
    expect(params).toMatchObject({ model: 'gpt-4o-mini', temperature: 0, max_tokens: 5 });
  });

  it('intent classifier on a reasoning model: effort none and a 16-token budget', async () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-6-luna';
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'add_skills' } }] });
    expect(await classifyIntentLLM('add Kubernetes to skills')).toBe('add_skills');
    const params = mockCreate.mock.calls[0][0];
    expect(params).toMatchObject({ model: 'gpt-6-luna', reasoning_effort: 'none', max_completion_tokens: 16 });
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('max_tokens');
  });
});
