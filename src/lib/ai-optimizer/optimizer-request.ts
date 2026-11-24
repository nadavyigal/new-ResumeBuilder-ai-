import type OpenAI from 'openai';
import { trackedChatCompletion, type AITraceOptions } from '@/lib/posthog-ai';
import { adaptChatParams, outputTokenCap } from '@/lib/model-tiers';
import {
  OPTIMIZATION_CONFIG,
  RESUME_OPTIMIZATION_SYSTEM_PROMPT,
  RESUME_SCHEMA_TEXT,
  TAILORED_RESUME_SCHEMA,
  selectOptimizerModel,
} from '../prompts/resume-optimizer';
import type { OptimizedResume } from './index';

type ResponseFormat = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming['response_format'];

/** True when the API refused the request because of the response_format / schema. */
export function isSchemaRejection(error: unknown): boolean {
  const err = error as { status?: number; message?: string } | null;
  return err?.status === 400 && /response_format|json_schema|schema/i.test(err.message ?? '');
}

/**
 * One optimizer model call. Sends the strict tailored-resume schema; if the API
 * rejects the schema, retries once in json_object mode with the compact schema
 * text appended to the system prompt. Returns the raw message content.
 */
export async function requestTailoredResume(
  openai: OpenAI,
  userPrompt: string,
  aiTrace: AITraceOptions,
  options?: { timeout?: number }
): Promise<{ content: string | null; totalTokens?: number }> {
  const selection = selectOptimizerModel();
  const call = (system: string, responseFormat: ResponseFormat) =>
    trackedChatCompletion(
      openai,
      adaptChatParams(selection, {
        temperature: OPTIMIZATION_CONFIG.temperature,
        max_tokens: outputTokenCap(selection, OPTIMIZATION_CONFIG.maxTokens, OPTIMIZATION_CONFIG.reasoningMaxTokens),
        response_format: responseFormat,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      }),
      aiTrace,
      options?.timeout ? { timeout: options.timeout } : undefined
    );

  let completion;
  try {
    completion = await call(RESUME_OPTIMIZATION_SYSTEM_PROMPT, TAILORED_RESUME_SCHEMA);
  } catch (error) {
    if (!isSchemaRejection(error)) throw error;
    console.warn(JSON.stringify({ event: 'optimizer_schema_rejected', model: selection.model }));
    completion = await call(`${RESUME_OPTIMIZATION_SYSTEM_PROMPT}\n\n${RESUME_SCHEMA_TEXT}`, { type: 'json_object' });
  }
  return {
    content: completion.choices[0]?.message?.content ?? null,
    totalTokens: completion.usage?.total_tokens,
  };
}

/**
 * The strict schema makes contact.linkedin / contact.portfolio required, so the
 * model returns "" where the resume has no link. Those keys were optional
 * before; drop the empty ones so stored rows and API responses look as they did.
 */
export function dropEmptyOptionalFields(resume: OptimizedResume): OptimizedResume {
  if (!resume?.contact) return resume;
  const contact = { ...resume.contact };
  for (const key of ['linkedin', 'portfolio'] as const) {
    if (typeof contact[key] === 'string' && contact[key]!.trim() === '') delete contact[key];
  }
  return { ...resume, contact };
}
