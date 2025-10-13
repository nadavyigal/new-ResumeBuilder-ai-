/**
 * Unified Message Processor
 *
 * Routes user messages to either content processor or design processor
 * based on intent detection. Provides single interface for all chat interactions.
 */

import { processMessage as processContentMessage, AmendmentRequest } from './processor';
import {
  interpretDesignRequest,
  validateAndApply,
  InterpretationResult,
  CustomizationResult
} from '../design-manager/customization-engine';

export type MessageIntent = 'content' | 'design' | 'unclear';

export interface UnifiedProcessInput {
  message: string;
  sessionId: string;
  optimizationId: string;
  currentResumeContent: Record<string, unknown>;
  currentDesignConfig?: any;
  currentTemplateId?: string;
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
}

/**
 * Detect user intent from message
 */
export function detectIntent(message: string): MessageIntent {
  const lowerMessage = message.toLowerCase();

  // Design-related keywords
  const designKeywords = [
    'color', 'font', 'design', 'style', 'layout', 'spacing',
    'header', 'template', 'theme', 'background', 'text color',
    'font size', 'bold', 'italic', 'underline', 'margin', 'padding',
    'make it look', 'change the look', 'visual', 'appearance'
  ];

  // Content-related keywords
  const contentKeywords = [
    'add', 'remove', 'delete', 'modify', 'change', 'update',
    'experience', 'skill', 'education', 'summary', 'achievement',
    'work history', 'job', 'company', 'certification', 'project'
  ];

  // Check for design intent
  const hasDesignKeyword = designKeywords.some(keyword => lowerMessage.includes(keyword));

  // Check for content intent
  const hasContentKeyword = contentKeywords.some(keyword => lowerMessage.includes(keyword));

  // Prioritize design if both are present but design is more specific
  if (hasDesignKeyword && !hasContentKeyword) {
    return 'design';
  }

  // If only content keywords
  if (hasContentKeyword && !hasDesignKeyword) {
    return 'content';
  }

  // If both or neither, it's unclear
  if (hasDesignKeyword && hasContentKeyword) {
    // Try to determine which is more prominent
    const designMatches = designKeywords.filter(k => lowerMessage.includes(k)).length;
    const contentMatches = contentKeywords.filter(k => lowerMessage.includes(k)).length;

    if (designMatches > contentMatches) {
      return 'design';
    } else if (contentMatches > designMatches) {
      return 'content';
    }
  }

  return 'unclear';
}

/**
 * Process message through unified router
 */
export async function processUnifiedMessage(
  input: UnifiedProcessInput
): Promise<UnifiedProcessOutput> {

  // Detect intent
  const intent = detectIntent(input.message);

  // Handle unclear intent
  if (intent === 'unclear') {
    return {
      intent: 'unclear',
      aiResponse: "I'm not sure if you want to modify the resume content or change the design. Could you please clarify?\n\n• For content changes: \"add Python to skills\" or \"update my summary\"\n• For design changes: \"make headers blue\" or \"change font to Times New Roman\"",
      shouldApply: false,
      requiresClarification: true
    };
  }

  // Route to appropriate processor
  if (intent === 'design') {
    return await processDesignMessage(input);
  } else {
    return await processContentMessage_(input);
  }
}

/**
 * Process design-related messages
 */
async function processDesignMessage(
  input: UnifiedProcessInput
): Promise<UnifiedProcessOutput> {

  // Check if design assignment exists
  if (!input.currentTemplateId) {
    return {
      intent: 'design',
      aiResponse: "You haven't selected a design template yet. Please choose a template from the 'Change Design' button first, then I can help you customize it!",
      shouldApply: false,
      requiresClarification: true
    };
  }

  try {
    // Use design customization engine
    const result = await validateAndApply(
      input.message,
      input.currentTemplateId,
      input.currentDesignConfig || {},
      input.currentResumeContent
    );

    // Check if interpretation failed
    if ('understood' in result && !result.understood) {
      const interpretResult = result as InterpretationResult;

      return {
        intent: 'design',
        aiResponse: interpretResult.clarificationNeeded || 'Unable to process design request.',
        shouldApply: false,
        requiresClarification: true
      };
    }

    // Success
    const customResult = result as CustomizationResult;

    return {
      intent: 'design',
      aiResponse: `✅ ${customResult.reasoning}`,
      designCustomization: customResult.customization,
      designPreview: customResult.preview,
      designReasoning: customResult.reasoning,
      shouldApply: true,
      requiresClarification: false
    };

  } catch (error) {
    console.error('Error processing design message:', error);

    return {
      intent: 'design',
      aiResponse: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process design request'}`,
      shouldApply: false,
      requiresClarification: false
    };
  }
}

/**
 * Process content-related messages
 */
async function processContentMessage_(
  input: UnifiedProcessInput
): Promise<UnifiedProcessOutput> {

  try {
    // Use existing content processor
    const result = await processContentMessage({
      message: input.message,
      sessionId: input.sessionId,
      currentResumeContent: input.currentResumeContent
    });

    return {
      intent: 'content',
      aiResponse: result.aiResponse,
      contentAmendments: result.amendments,
      shouldApply: result.shouldApply,
      requiresClarification: !result.shouldApply
    };

  } catch (error) {
    console.error('Error processing content message:', error);

    return {
      intent: 'content',
      aiResponse: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process content request'}`,
      shouldApply: false,
      requiresClarification: false
    };
  }
}
