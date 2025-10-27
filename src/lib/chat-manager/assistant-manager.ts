/**
 * OpenAI Assistant Manager
 *
 * Manages OpenAI Assistants API for resume editing conversations.
 * Handles thread creation, message posting, and function execution.
 */

import OpenAI from 'openai';
import type { Assistant, Thread, Run } from 'openai/resources/beta/index';
import { ASSISTANT_FUNCTIONS, type UpdateDesignParams, type UpdateContentParams, type ClarifyRequestParams } from './assistant-functions';
import { buildResumeContext, type ResumeContext } from './memory-manager';

const ASSISTANT_MODEL = 'gpt-4-1106-preview'; // GPT-4 Turbo with function calling
const ASSISTANT_NAME = 'Resume Editor Assistant';

export interface AssistantManagerConfig {
  apiKey: string;
  assistantId?: string; // Use existing assistant
}

export interface RunAssistantInput {
  threadId: string;
  userMessage: string;
  resumeContext: ResumeContext;
}

export interface RunAssistantOutput {
  response: string;
  functionCalls: FunctionCall[];
  requiresClarification: boolean;
  threadId: string; // The thread ID (created or existing)
}

export interface FunctionCall {
  name: string;
  params: UpdateDesignParams | UpdateContentParams | ClarifyRequestParams;
  result?: any;
}

/**
 * OpenAI Assistant Manager
 */
export class AssistantManager {
  private client: OpenAI;
  private assistantId?: string;
  private assistant?: Assistant;

  constructor(config: AssistantManagerConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.assistantId = config.assistantId;
  }

  /**
   * Get or create assistant
   */
  async getOrCreateAssistant(): Promise<Assistant> {
    // If we have a cached assistant, return it
    if (this.assistant) {
      return this.assistant;
    }

    // If we have an assistant ID, retrieve it
    if (this.assistantId) {
      try {
        this.assistant = await this.client.beta.assistants.retrieve(this.assistantId);
        console.log('Retrieved existing assistant:', this.assistantId);
        return this.assistant;
      } catch (error) {
        console.warn('Failed to retrieve assistant, will create new one:', error);
      }
    }

    // Create new assistant
    const instructions = this.buildAssistantInstructions();

    this.assistant = await this.client.beta.assistants.create({
      name: ASSISTANT_NAME,
      instructions,
      model: ASSISTANT_MODEL,
      tools: ASSISTANT_FUNCTIONS
    });

    this.assistantId = this.assistant.id;
    console.log('Created new assistant:', this.assistantId);

    return this.assistant;
  }

  /**
   * Get assistant ID (for storage)
   */
  getAssistantId(): string | undefined {
    return this.assistantId;
  }

  /**
   * Create a new thread for a chat session
   */
  async createThread(): Promise<Thread> {
    const thread = await this.client.beta.threads.create();
    console.log('Created new thread:', thread.id);
    return thread;
  }

  /**
   * Retrieve an existing thread
   */
  async getThread(threadId: string): Promise<Thread> {
    return await this.client.beta.threads.retrieve(threadId);
  }

  /**
   * Run the assistant with a user message
   */
  async runAssistant(input: RunAssistantInput): Promise<RunAssistantOutput> {
    const assistant = await this.getOrCreateAssistant();

    // Create thread if not provided - use const to prevent reassignment
    let resolvedThreadId: string;
    if (!input.threadId || input.threadId === '') {
      const thread = await this.createThread();
      resolvedThreadId = thread.id;
      console.log('Created new thread for session:', resolvedThreadId);
    } else {
      resolvedThreadId = input.threadId;
      console.log('Using existing thread:', resolvedThreadId);
    }

    // Add resume context as a system-like message
    const contextMessage = buildResumeContext(input.resumeContext);

    console.log('Adding message to thread:', resolvedThreadId);
    // Add user message to thread with context
    await this.client.beta.threads.messages.create(resolvedThreadId, {
      role: 'user',
      content: `${contextMessage}\n\nUser Request: ${input.userMessage}`
    });

    console.log('Creating run for thread:', resolvedThreadId);
    // Run the assistant
    let run = await this.client.beta.threads.runs.create(resolvedThreadId, {
      assistant_id: assistant.id
    });
    console.log('Created run:', run.id, 'for thread:', resolvedThreadId);

    // Poll for completion
    const functionCalls: FunctionCall[] = [];
    let response = '';
    let requiresClarification = false;

    while (run.status === 'queued' || run.status === 'in_progress' || run.status === 'requires_action') {
      // Wait a bit before polling again
      await this.sleep(1000);

      console.log('Retrieving run status - thread:', resolvedThreadId, 'run:', run.id);
      run = await this.client.beta.threads.runs.retrieve(run.id, { thread_id: resolvedThreadId });

      // Handle function calls
      if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
        const toolCalls = run.required_action.submit_tool_outputs.tool_calls;

        const toolOutputs = [];

        for (const toolCall of toolCalls) {
          console.log('Function called:', toolCall.function.name);
          console.log('Parameters:', toolCall.function.arguments);

          const params = JSON.parse(toolCall.function.arguments);

          functionCalls.push({
            name: toolCall.function.name,
            params,
            result: null // Will be filled by caller
          });

          // For now, just acknowledge the function call
          // The actual execution will be done by the caller
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify({ success: true, message: 'Function will be executed' })
          });

          // Check if it's a clarification request
          if (toolCall.function.name === 'clarify_request') {
            requiresClarification = true;
          }
        }

        // Submit tool outputs to continue the run
        run = await this.client.beta.threads.runs.submitToolOutputs(
          run.id,
          {
            thread_id: resolvedThreadId,
            tool_outputs: toolOutputs
          }
        );
      }
    }

    // Get the assistant's response
    if (run.status === 'completed') {
      const messages = await this.client.beta.threads.messages.list(resolvedThreadId, {
        order: 'desc',
        limit: 1
      });

      const lastMessage = messages.data[0];
      if (lastMessage && lastMessage.role === 'assistant') {
        const content = lastMessage.content[0];
        if (content.type === 'text') {
          response = content.text.value;
        }
      }
    } else {
      console.error('Run failed with status:', run.status);
      throw new Error(`Assistant run failed: ${run.status}`);
    }

    return {
      response,
      functionCalls,
      requiresClarification,
      threadId: resolvedThreadId // Return the thread ID for storage
    };
  }

  /**
   * Build assistant instructions (system prompt)
   */
  private buildAssistantInstructions(): string {
    return `You are a professional resume editing assistant. You help users improve their resume through natural conversation.

**YOUR CAPABILITIES:**
1. **Design Changes**: Update colors, fonts, layout, spacing using the update_design function
2. **Content Changes**: Add, modify, or remove resume content using the update_content function
3. **Clarification**: Ask questions when requests are ambiguous using the clarify_request function

**IMPORTANT RULES:**
- ALWAYS be understanding of typos (e.g., "backround" means "background")
- Handle multi-word colors naturally ("light blue", "dark navy", "sky blue")
- When users say "make it darker" or "change it back", use the conversation context to understand what they mean
- NEVER fabricate information - only work with existing resume content or user-provided additions
- Always confirm what you changed in your response
- Be friendly and conversational
- If the user's request is unclear, use clarify_request to ask for more information

**DESIGN GUIDELINES:**
- For background colors, support common names: light blue (#87CEEB), dark blue (#00008B), navy (#001f3f), etc.
- Maintain ATS (Applicant Tracking System) friendly formatting
- Avoid overly decorative elements that might hurt ATS parsing

**CONTENT GUIDELINES:**
- Skills: Add to technical or soft skills arrays as appropriate
- Experience: Only modify existing jobs or add new jobs with complete information
- Education: Require full details (degree, institution, date)
- Summary: Rewrite professionally while maintaining user's voice

**CONVERSATION MEMORY:**
- You have access to the full conversation history in this thread
- You have access to the current resume state (provided in each message)
- You have access to all changes made in this session
- Use this context to understand follow-up requests like "make it darker", "undo that", "change it back"

When you need to make changes, call the appropriate function. Always respond with a friendly confirmation of what you did.`;
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
