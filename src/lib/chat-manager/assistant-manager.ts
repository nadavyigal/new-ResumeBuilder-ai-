/**
 * Resume Editor Assistant
 *
 * Runs resume editing conversations on the OpenAI Responses API with
 * conversation state (Conversations API). Replaces the Assistants API, which
 * OpenAI shut down on 2026-08-26, and gpt-4-1106-preview, shut down 2026-10-23.
 *
 * Behavior kept from the Assistants version:
 * - same system instructions (buildAssistantInstructions; since the 2026-11-24
 *   prompt upgrade they end with the shared content rules and the tip reply is
 *   in the user's language)
 * - same tools (ASSISTANT_FUNCTIONS) and the same acknowledgement sent back
 *   for each tool call; the caller still executes the changes
 * - same resume-context message prepended to the user request
 * - an empty threadId starts a new conversation; its id is returned as threadId
 */

import OpenAI from 'openai';
import type { Conversation } from 'openai/resources/conversations/conversations';
import type {
  FunctionTool,
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from 'openai/resources/responses/responses';
import { captureAiGenerationEvent, type AITraceOptions } from '@/lib/posthog-ai';
import { logModelUsage, readUsage, selectModel, type ModelSelection } from '@/lib/model-tiers';
import { CONTENT_RULES } from '@/lib/prompts/shared';
import { ASSISTANT_FUNCTIONS, type UpdateDesignParams, type UpdateContentParams, type ClarifyRequestParams } from './assistant-functions';
import { buildResumeContext, type ResumeContext } from './memory-manager';

/** FAST tier. The previous model is shut down, so the default is the new model. */
export function resolveAssistantModel(): ModelSelection {
  return selectModel('FAST', 'gpt-6-luna');
}

/** Safety cap on tool-call round trips in one turn. */
const MAX_TOOL_ROUNDS = 5;

const TOOL_ACK = JSON.stringify({ success: true, message: 'Function will be executed' });

/** Assistants-style function definitions mapped to Responses API function tools. */
export const RESPONSE_TOOLS: FunctionTool[] = ASSISTANT_FUNCTIONS.map((tool) => ({
  type: 'function',
  name: tool.function.name,
  description: tool.function.description,
  parameters: tool.function.parameters as Record<string, unknown>,
  strict: false,
}));

export interface AssistantManagerConfig {
  apiKey: string;
  /** Injected in tests. */
  client?: OpenAI;
}

export interface RunAssistantInput {
  threadId: string;
  userMessage: string;
  resumeContext: ResumeContext;
  aiTrace?: AITraceOptions;
}

export interface RunAssistantOutput {
  response: string;
  functionCalls: FunctionCall[];
  requiresClarification: boolean;
  threadId: string; // The conversation ID (created or existing)
}

export interface FunctionCall {
  name: string;
  params: UpdateDesignParams | UpdateContentParams | ClarifyRequestParams;
  result?: any;
}

function functionCallsOf(response: Response): ResponseFunctionToolCall[] {
  return (response.output ?? []).filter(
    (item): item is ResponseFunctionToolCall => item.type === 'function_call'
  );
}

/**
 * Resume Editor Assistant on the Responses API
 */
export class AssistantManager {
  private client: OpenAI;

  constructor(config: AssistantManagerConfig) {
    this.client = config.client ?? new OpenAI({ apiKey: config.apiKey });
  }

  /**
   * Create a new conversation for a chat session
   */
  async createThread(): Promise<Conversation> {
    const conversation = await this.client.conversations.create({});
    console.log('Created new conversation:', conversation.id);
    return conversation;
  }

  /**
   * Retrieve an existing conversation
   */
  async getThread(threadId: string): Promise<Conversation> {
    return await this.client.conversations.retrieve(threadId);
  }

  /**
   * Run the assistant with a user message
   */
  async runAssistant(input: RunAssistantInput): Promise<RunAssistantOutput> {
    const startedAt = Date.now();
    const selection = resolveAssistantModel();
    const instructions = this.buildAssistantInstructions();

    let resolvedThreadId: string;
    if (!input.threadId || input.threadId === '') {
      const conversation = await this.createThread();
      resolvedThreadId = conversation.id;
    } else {
      resolvedThreadId = input.threadId;
    }

    // Add resume context to the user message, as before
    const contextMessage = buildResumeContext(input.resumeContext);

    const functionCalls: FunctionCall[] = [];
    let requiresClarification = false;
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;

    const createResponse = async (items: ResponseInputItem[]): Promise<Response> => {
      const params: ResponseCreateParamsNonStreaming = {
        model: selection.model,
        instructions,
        input: items,
        tools: RESPONSE_TOOLS,
        conversation: resolvedThreadId,
        // openai@5.23 types predate the "none" / "xhigh" / "max" efforts the API accepts
        ...(selection.reasoningEffort
          ? { reasoning: { effort: selection.reasoningEffort as NonNullable<ResponseCreateParamsNonStreaming['reasoning']>['effort'] } }
          : {}),
      };
      const response = await this.client.responses.create(params);
      const usage = readUsage(response.usage);
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
      reasoningTokens += usage.reasoningTokens ?? 0;
      return response;
    };

    const trackFailure = async (status: string) => {
      await captureAiGenerationEvent({
        input: {
          thread_id: resolvedThreadId,
          user_message: input.userMessage,
          resume_context: input.resumeContext,
        },
        model: selection.model,
        trace: input.aiTrace || { traceName: 'chat' },
        latency: Date.now() - startedAt,
        usage: { inputTokens, outputTokens, reasoningTokens, totalTokens: inputTokens + outputTokens },
        error: new Error(`Assistant run failed: ${status}`),
      });
      console.error('Run failed with status:', status);
      throw new Error(`Assistant run failed: ${status}`);
    };

    let response = await createResponse([
      { role: 'user', content: `${contextMessage}\n\nUser Request: ${input.userMessage}` },
    ]);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (response.status && response.status !== 'completed') break;
      const toolCalls = functionCallsOf(response);
      if (toolCalls.length === 0) break;

      const toolOutputs: ResponseInputItem[] = [];
      for (const toolCall of toolCalls) {
        console.log('Function called:', toolCall.name);

        const params = JSON.parse(toolCall.arguments);
        functionCalls.push({
          name: toolCall.name,
          params,
          result: null, // Will be filled by caller
        });

        // Acknowledge the call; the caller executes the change
        toolOutputs.push({ type: 'function_call_output', call_id: toolCall.call_id, output: TOOL_ACK });

        if (toolCall.name === 'clarify_request') {
          requiresClarification = true;
        }
      }

      response = await createResponse(toolOutputs);
    }

    if (response.status && response.status !== 'completed') {
      await trackFailure(response.status);
    }
    if (functionCallsOf(response).length > 0) {
      await trackFailure('tool_round_limit');
    }

    const text = response.output_text ?? '';

    const latency = Date.now() - startedAt;
    logModelUsage('chat.assistant', selection, { inputTokens, outputTokens, reasoningTokens }, latency);

    await captureAiGenerationEvent({
      input: {
        thread_id: resolvedThreadId,
        user_message: input.userMessage,
        resume_context: input.resumeContext,
      },
      output: text,
      model: selection.model,
      trace: input.aiTrace || { traceName: 'chat' },
      latency,
      usage: { inputTokens, outputTokens, reasoningTokens, totalTokens: inputTokens + outputTokens },
    });

    return {
      response: text,
      functionCalls,
      requiresClarification,
      threadId: resolvedThreadId, // Return the conversation ID for storage
    };
  }

/**
   * Build assistant instructions (system prompt)
   */
  private buildAssistantInstructions(): string {
    return `You are an AI resume assistant focused on precise, ATS-safe improvements.

Core behavior:
- Respond in the same language the user is currently using (English or Hebrew), unless they request otherwise.
- Be concise, direct, and practical.
- Handle typos and informal phrasing naturally.
- Use chat history and existing resume context for follow-up requests.
- Never fabricate information. Only use data already in the resume or explicitly provided by the user.

Your tools:
1. update_design: colors, typography, spacing, and layout adjustments.
2. update_content: add, edit, or remove resume content.
3. clarify_request: ask one focused question when the request is ambiguous.

Design rules:
- Keep formatting ATS-friendly and readable.
- Avoid decorative changes that can reduce ATS parseability.
- Prefer high-contrast, accessible color choices.

Content rules:
- Skills: add to technical or soft skills in the appropriate section.
- Experience: edit existing roles carefully; do not invent roles, dates, or outcomes.
- Education/Certifications: require complete details if adding new entries.
- Summary: keep it clear, targeted to role, and truthful.

ATS tip rule:
- If the user asks to apply or implement tip numbers (for example: "apply tip 2"), do not perform direct manual edits yourself.
- These requests are handled by a dedicated tip implementation flow.
- Tell the user, in their language, that you will apply tip X now and that they will see the change in their resume shortly.

When changes are made:
- Confirm exactly what changed.
- If helpful, include a short next step the user can take.

${CONTENT_RULES}`;
  }

  /**
   * Sleep utility for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create assistant manager instance
 */
export function createAssistantManager(config: AssistantManagerConfig): AssistantManager {
  return new AssistantManager(config);
}
