/**
 * Design recommender: off gpt-4 (shut down 2026-10-23), structured outputs.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

const mockCreate = jest.fn() as jest.Mock<any>;
jest.mock('openai', () => ({
  __esModule: true,
  default: function MockOpenAI() {
    return { chat: { completions: { create: (...args: any[]) => mockCreate(...args) } } };
  },
}));

import { recommendTemplate } from '@/lib/design-manager/design-recommender';

const resume = { summary: 'Product designer', skills: ['Figma'], experience: [] };

describe('recommendTemplate', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    delete process.env.OPENAI_MODEL_FAST;
  });

  it('calls gpt-6-luna with a JSON schema and no sampling params', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"templateId":"card-ssr","reasoning":"Creative role.","confidence":0.9}' } }],
      usage: { prompt_tokens: 300, completion_tokens: 40 },
    });
    const result = await recommendTemplate(resume, 'UX designer role');
    expect(result).toEqual({ templateId: 'card-ssr', reasoning: 'Creative role.', confidence: 0.9 });

    const params = mockCreate.mock.calls[0][0] as any;
    expect(params.model).toBe('gpt-6-luna');
    expect(params.response_format.type).toBe('json_schema');
    expect(params.response_format.json_schema.schema.properties.templateId.enum).toEqual(['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr']);
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('max_tokens');
    expect(params.max_completion_tokens).toBe(300);
    expect(params.reasoning_effort).toBe('none');
  });

  it('keeps temperature and max_tokens when OPENAI_MODEL_FAST is a non-reasoning model', async () => {
    process.env.OPENAI_MODEL_FAST = 'gpt-4o-mini';
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"templateId":"minimal-ssr","reasoning":"r","confidence":0.8}' } }] });
    await recommendTemplate(resume, 'Backend engineer');
    const params = mockCreate.mock.calls[0][0] as any;
    expect(params.model).toBe('gpt-4o-mini');
    expect(params.temperature).toBe(0.3);
    expect(params.max_tokens).toBe(300);
  });

  it('falls back to the safe default when the API errors', async () => {
    mockCreate.mockRejectedValue(new Error('model_not_found'));
    const result = await recommendTemplate(resume, 'x');
    expect(result.templateId).toBe('minimal-ssr');
    expect(result.confidence).toBe(0.6);
  });
});
