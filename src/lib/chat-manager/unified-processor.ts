/**
 * Unified Message Processor (OpenAI Assistants API)
 *
 * Uses OpenAI Assistants API with function calling to understand user intent
 * and make design or content changes. Provides conversation memory and
 * context tracking for natural multi-turn conversations.
 */

import { AssistantManager, type RunAssistantInput } from './assistant-manager';
import {
  isUpdateDesignParams,
  isUpdateContentParams,
  isClarifyRequestParams,
  type UpdateDesignParams,
} from './assistant-functions';
import {
  createEmptyContext,
  updateContextContent,
  updateContextDesign,
  recordChange,
  type ResumeContext
} from './memory-manager';
import type { AmendmentRequest } from './processor';

export type MessageIntent = 'content' | 'design' | 'unclear' | 'clarify';

export interface UnifiedProcessInput {
  message: string;
  sessionId: string;
  optimizationId: string;
  currentResumeContent: Record<string, unknown>;
  currentDesignConfig?: any;
  currentTemplateId?: string;
  threadId?: string; // OpenAI thread ID if exists
  resumeContext?: ResumeContext; // Resume context from session
}

export interface UnifiedProcessOutput {
  intent: MessageIntent;
  aiResponse: string;
  contentAmendments?: AmendmentRequest[];
  designCustomization?: any;
  designPreview?: string;
  designReasoning?: string;
  shouldApply: boolean;
  requiresClarification: boolean;
  updatedContext?: ResumeContext; // Updated context to save back to session
  threadId?: string; // OpenAI thread ID for storage
}

/**
 * Process message through OpenAI Assistant
 */
export async function processUnifiedMessage(
  input: UnifiedProcessInput
): Promise<UnifiedProcessOutput> {

  // Get OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  // Create assistant manager
  const assistantManager = new AssistantManager({ apiKey });

  // Build or use existing resume context
  let resumeContext = input.resumeContext;
  if (!resumeContext) {
    resumeContext = createEmptyContext(
      input.optimizationId,
      input.currentResumeContent,
      {
        template_id: input.currentTemplateId,
        template_name: input.currentTemplateId ? 'Selected Template' : undefined,
        customization: input.currentDesignConfig
      }
    );
  } else {
    // Ensure context has all required fields (handle database loaded contexts)
    if (!resumeContext.changes_in_session) {
      resumeContext.changes_in_session = [];
    }
    if (!resumeContext.current_design) {
      resumeContext.current_design = {};
    }
    if (!resumeContext.current_content) {
      resumeContext.current_content = {};
    }

    // Update context with latest data
    resumeContext = updateContextContent(resumeContext, input.currentResumeContent);
    resumeContext = updateContextDesign(resumeContext, {
      template_id: input.currentTemplateId,
      customization: input.currentDesignConfig
    });
  }

  // Prepare assistant input
  const assistantInput: RunAssistantInput = {
    threadId: input.threadId || '', // Will be created if empty
    userMessage: input.message,
    resumeContext
  };

  try {
    // Run the assistant
    const assistantOutput = await assistantManager.runAssistant(assistantInput);

    // Process function calls to determine intent and actions
    let intent: MessageIntent = 'unclear';
    const contentAmendments: AmendmentRequest[] = [];
    let designCustomization: any = null;
    let shouldApply = false;
    let requiresClarification = assistantOutput.requiresClarification;

    for (const functionCall of assistantOutput.functionCalls) {
      if (functionCall.name === 'update_design' && isUpdateDesignParams(functionCall.params)) {
        intent = 'design';
        shouldApply = true;
        designCustomization = convertDesignParamsToCustomization(functionCall.params);

        // Record change in context
        resumeContext = recordChange(
          resumeContext,
          'design',
          `Design update: ${functionCall.params.reasoning || 'Applied design changes'}`,
          undefined,
          functionCall.params
        );
      } else if (functionCall.name === 'update_content' && isUpdateContentParams(functionCall.params)) {
        intent = 'content';
        shouldApply = true;

        // Convert to amendment request format
        contentAmendments.push({
          type: functionCall.params.operation,
          targetSection: functionCall.params.section,
          description: functionCall.params.value
        });

        // Record change in context
        resumeContext = recordChange(
          resumeContext,
          'content',
          functionCall.params.reasoning || `${functionCall.params.operation} content in ${functionCall.params.section}`,
          functionCall.params.section,
          functionCall.params
        );
      } else if (functionCall.name === 'clarify_request' && isClarifyRequestParams(functionCall.params)) {
        intent = 'clarify';
        requiresClarification = true;
      }
    }

    return {
      intent,
      aiResponse: assistantOutput.response,
      contentAmendments: contentAmendments.length > 0 ? contentAmendments : undefined,
      designCustomization,
      shouldApply,
      requiresClarification,
      updatedContext: resumeContext,
      threadId: assistantOutput.threadId
    };

  } catch (error) {
    console.error('Error in OpenAI Assistant processing:', error);

    return {
      intent: 'unclear',
      aiResponse: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      shouldApply: false,
      requiresClarification: false,
      updatedContext: resumeContext,
      threadId: input.threadId // Return existing thread ID on error
    };
  }
}

/**
 * Convert UpdateDesignParams to customization format
 */
function convertDesignParamsToCustomization(params: UpdateDesignParams): any {
  return {
    color_scheme: params.color_scheme || {},
    font_family: params.font_family || {},
    spacing: params.spacing || {},
    custom_css: params.custom_css || '',
    is_ats_safe: true // Default to ATS-safe
  };
}
