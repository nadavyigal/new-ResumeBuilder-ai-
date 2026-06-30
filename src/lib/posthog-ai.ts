import type OpenAI from 'openai';

type ChatCompletionParams = OpenAI.Chat.Completions.ChatCompletionCreateParams;
type ChatCompletionOptions = Parameters<OpenAI.Chat.Completions['create']>[1];

export type AITraceOptions = {
  distinctId?: string;
  traceId?: string;
  traceName: string;
  properties?: Record<string, unknown>;
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const CONTACT_FIELD_KEYS = new Set(['name', 'email', 'phone']);

async function getServerPostHog() {
  if (typeof window !== 'undefined') return null;

  return import('@/lib/posthog-server');
}

function redactContactInfo(value: unknown, key?: string): unknown {
  const normalizedKey = key?.toLowerCase();
  if (normalizedKey && CONTACT_FIELD_KEYS.has(normalizedKey)) {
    return `[redacted-${normalizedKey}]`;
  }

  if (typeof value === 'string') {
    return value
      .replace(EMAIL_PATTERN, '[redacted-email]')
      .replace(PHONE_PATTERN, '[redacted-phone]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactContactInfo(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        redactContactInfo(item, key),
      ])
    );
  }

  return value;
}

function extractOutputChoices(completion: any) {
  const choices = Array.isArray(completion?.choices) ? completion.choices : [];
  return choices.map((choice: any) => ({
    role: choice?.message?.role,
    content: choice?.message?.content ?? choice?.delta?.content ?? '',
    finish_reason: choice?.finish_reason,
  }));
}

async function captureAiGeneration(
  params: ChatCompletionParams,
  completion: unknown,
  trace: AITraceOptions,
  latency: number,
  error?: unknown
) {
  const posthog = await getServerPostHog();
  const client = posthog?.getPostHogClient();
  if (!client) return;

  const traceId = trace.traceId || crypto.randomUUID();
  const usage = (completion as any)?.usage || {};
  const model = String((completion as any)?.model || params.model || 'unknown');

  client.capture({
    distinctId: trace.distinctId || traceId,
    event: '$ai_generation',
    properties: {
      $ai_lib: 'resumely-posthog-node',
      $ai_provider: 'openai',
      $ai_model: model,
      $ai_model_parameters: {
        temperature: (params as any).temperature,
        max_tokens: (params as any).max_tokens,
        response_format: (params as any).response_format,
      },
      $ai_input: redactContactInfo((params as any).messages || []),
      $ai_output_choices: redactContactInfo(extractOutputChoices(completion)),
      $ai_http_status: error ? ((error as any)?.status || 500) : 200,
      $ai_input_tokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
      $ai_output_tokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
      $ai_total_tokens: usage.total_tokens ?? 0,
      $ai_latency: latency,
      $ai_trace_id: traceId,
      $ai_trace_name: trace.traceName,
      $ai_is_error: Boolean(error),
      ...(error
        ? { $ai_error: error instanceof Error ? error.message : String(error) }
        : {}),
      ...trace.properties,
    },
  });
}

export async function captureAiGenerationEvent(args: {
  input: unknown;
  output?: unknown;
  model: string;
  trace: AITraceOptions;
  latency: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  error?: unknown;
}) {
  const posthog = await getServerPostHog();
  const client = posthog?.getPostHogClient();
  if (!client) return;

  const traceId = args.trace.traceId || crypto.randomUUID();

  client.capture({
    distinctId: args.trace.distinctId || traceId,
    event: '$ai_generation',
    properties: {
      $ai_lib: 'resumely-posthog-node',
      $ai_provider: 'openai',
      $ai_model: args.model,
      $ai_model_parameters: {},
      $ai_input: redactContactInfo(args.input),
      $ai_output_choices: redactContactInfo(args.output ? [{ content: args.output }] : []),
      $ai_http_status: args.error ? ((args.error as any)?.status || 500) : 200,
      $ai_input_tokens: args.usage?.inputTokens ?? 0,
      $ai_output_tokens: args.usage?.outputTokens ?? 0,
      $ai_total_tokens: args.usage?.totalTokens ?? 0,
      $ai_latency: args.latency,
      $ai_trace_id: traceId,
      $ai_trace_name: args.trace.traceName,
      $ai_is_error: Boolean(args.error),
      ...(args.error
        ? { $ai_error: args.error instanceof Error ? args.error.message : String(args.error) }
        : {}),
      ...args.trace.properties,
    },
  });

  await posthog?.flushPostHogClient();
}

export async function trackedChatCompletion(
  client: OpenAI,
  params: ChatCompletionParams,
  trace: AITraceOptions,
  options?: ChatCompletionOptions
) {
  const startedAt = Date.now();

  try {
    const completion = await client.chat.completions.create(params as any, options as any);
    const posthog = await getServerPostHog();
    await captureAiGeneration(params, completion, trace, Date.now() - startedAt);
    await posthog?.flushPostHogClient();
    return completion;
  } catch (error) {
    const posthog = await getServerPostHog();
    await captureAiGeneration(params, undefined, trace, Date.now() - startedAt, error);
    await posthog?.flushPostHogClient();
    throw error;
  }
}
