/**
 * src/lib/model-tiers.ts: tier resolution and reasoning-model param handling.
 * The rejected params below were checked against the live API on 2026-11-23.
 */
import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { adaptChatParams, isReasoningModel, outputTokenCap, readUsage, selectModel, warnIfTruncated } from '@/lib/model-tiers';

const ENV_KEYS = [
  'OPENAI_MODEL_PLAN', 'OPENAI_MODEL_WRITER', 'OPENAI_MODEL_FAST',
  'OPENAI_REASONING_EFFORT_PLAN', 'OPENAI_REASONING_EFFORT_WRITER', 'OPENAI_REASONING_EFFORT_FAST',
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('selectModel', () => {
  it('keeps the call-site default when the env var is unset', () => {
    expect(selectModel('FAST', 'gpt-4o-mini')).toEqual({ tier: 'FAST', model: 'gpt-4o-mini' });
  });

  it('uses the tier env var when set, with the tier default effort', () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-6-luna';
    expect(selectModel('FAST', 'gpt-4o-mini')).toEqual({ tier: 'FAST', model: 'gpt-6-luna', reasoningEffort: 'none' });
    process.env.OPENAI_MODEL_WRITER = ' gpt-6.1-terra ';
    expect(selectModel('WRITER', 'gpt-4o').model).toBe('gpt-6.1-terra');
  });

  it('reads the effort env var and ignores invalid values', () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-6-luna';
    process.env.OPENAI_REASONING_EFFORT_FAST = 'low';
    expect(selectModel('FAST', 'x').reasoningEffort).toBe('low');
    process.env.OPENAI_REASONING_EFFORT_FAST = 'turbo';
    expect(selectModel('FAST', 'x').reasoningEffort).toBe('none');
  });

  it('a call-site effort override wins over the env var', () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-6-luna';
    process.env.OPENAI_REASONING_EFFORT_FAST = 'medium';
    expect(selectModel('FAST', 'x', 'none').reasoningEffort).toBe('none');
  });

  it('never sends effort none to gpt-6.2-sol (the API rejects it)', () => {
    process.env.OPENAI_MODEL_PLAN = 'gpt-6.2-sol';
    process.env.OPENAI_REASONING_EFFORT_PLAN = 'none';
    expect(selectModel('PLAN', 'gpt-4o').reasoningEffort).toBe('low');
  });
});

describe('effort per model family', () => {
  it('maps "none" to the lowest effort each family accepts', () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-5-mini';
    expect(selectModel('FAST', 'x').reasoningEffort).toBe('minimal');
    process.env.OPENAI_MODEL_FAST = 'o4-mini';
    expect(selectModel('FAST', 'x').reasoningEffort).toBe('low');
    process.env.OPENAI_MODEL_FAST = 'gpt-5.1';
    expect(selectModel('FAST', 'x').reasoningEffort).toBe('none');
    process.env.OPENAI_MODEL_FAST = 'gpt-6-luna';
    expect(selectModel('FAST', 'x').reasoningEffort).toBe('none');
  });
});

describe('adaptChatParams', () => {
  const params = { messages: [], temperature: 0.3, top_p: 0.9, max_tokens: 300, response_format: { type: 'json_object' as const } };

  it('leaves non-reasoning params untouched', () => {
    expect(adaptChatParams({ tier: 'FAST', model: 'gpt-4o-mini' }, params)).toEqual({ ...params, model: 'gpt-4o-mini' });
  });

  it('drops sampling params and renames max_tokens for reasoning models', () => {
    const out = adaptChatParams({ tier: 'FAST', model: 'gpt-6-luna', reasoningEffort: 'none' }, params);
    expect(out).toEqual({
      messages: [],
      model: 'gpt-6-luna',
      max_completion_tokens: 300,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
    });
  });
});

describe('isReasoningModel / readUsage', () => {
  it('classifies model families', () => {
    expect(isReasoningModel('gpt-6.2-sol')).toBe(true);
    expect(isReasoningModel('gpt-5-mini')).toBe(true);
    expect(isReasoningModel('o4-mini')).toBe(true);
    expect(isReasoningModel('gpt-4o')).toBe(false);
    expect(isReasoningModel('gpt-4.1-mini')).toBe(false);
  });

  it('reads chat and responses usage shapes', () => {
    expect(readUsage({ prompt_tokens: 10, completion_tokens: 5, completion_tokens_details: { reasoning_tokens: 2 } }))
      .toMatchObject({ inputTokens: 10, outputTokens: 5, reasoningTokens: 2 });
    expect(readUsage({ input_tokens: 7, output_tokens: 3, output_tokens_details: { reasoning_tokens: 1 } }))
      .toMatchObject({ inputTokens: 7, outputTokens: 3, reasoningTokens: 1 });
  });
});

describe('overrideEnv', () => {
  afterEach(() => {
    delete process.env.AGENT_SDK_MODEL;
  });

  it('an older per-feature env var keeps priority over the tier env var', () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-6-luna';
    process.env.AGENT_SDK_MODEL = 'gpt-4o-mini';
    expect(selectModel('FAST', 'gpt-4o-mini', undefined, 'AGENT_SDK_MODEL')).toEqual({ tier: 'FAST', model: 'gpt-4o-mini' });
    delete process.env.AGENT_SDK_MODEL;
    expect(selectModel('FAST', 'gpt-4o-mini', undefined, 'AGENT_SDK_MODEL').model).toBe('gpt-6-luna');
  });
});

describe('outputTokenCap', () => {
  it('keeps the old cap on non-reasoning models and raises it on reasoning models', () => {
    expect(outputTokenCap({ tier: 'PLAN', model: 'gpt-4o' }, 4000, 8000)).toBe(4000);
    expect(outputTokenCap({ tier: 'PLAN', model: 'gpt-6.2-sol', reasoningEffort: 'low' }, 4000, 8000)).toBe(8000);
    expect(outputTokenCap({ tier: 'FAST', model: 'gpt-6-luna', reasoningEffort: 'none' }, 5000, 4000)).toBe(5000);
  });
});

describe('warnIfTruncated', () => {
  it('logs only when the output hit the cap', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnIfTruncated('x', { choices: [{ finish_reason: 'stop' }] })).toBe(false);
    expect(warnIfTruncated('x', { choices: [{ finish_reason: 'length' }], usage: { completion_tokens: 4000 } })).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('openai_output_truncated');
    expect(warnIfTruncated('x', undefined)).toBe(false);
    warn.mockRestore();
  });
});
