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
import { DESIGN_KEYWORDS, CONTENT_KEYWORDS } from '../constants';
import { generateAmendments, generateAmendmentsBatch } from '../ats/amendment-generator';
import type { OptimizedResume } from '@/lib/ai-optimizer';

export type MessageIntent = 'content' | 'design' | 'ats_tip' | 'unclear';

export interface UnifiedProcessInput {
  message: string;
  sessionId: string;
  optimizationId: string;
  currentResumeContent: Record<string, unknown>;
  currentDesignConfig?: any;
  currentTemplateId?: string;
  atsSuggestions?: any[]; // ATS suggestions for tip implementation
}

export interface UnifiedProcessOutput {
  intent: MessageIntent;
  aiResponse: string;
  contentAmendments?: AmendmentRequest[];
  designCustomization?: any;
  designPreview?: string;
  designReasoning?: string;
  atsTipNumbers?: number[]; // Tip numbers to implement
  pendingChanges?: any[]; // Pending changes for preview
  shouldApply: boolean;
  requiresClarification: boolean;
}

/**
 * Extract tip numbers from user message
 *
 * Parses messages to identify which ATS tips the user wants to implement.
 * Supports various formats including comma-separated lists and "and" conjunctions.
 *
 * @param message - User's chat message
 * @returns Array of tip numbers (1-indexed) or null if no tips found
 *
 * @example
 * ```ts
 * extractTipNumbers("implement tip 1, 2, and 4")  // [1, 2, 4]
 * extractTipNumbers("use tips 3 and 5")           // [3, 5]
 * extractTipNumbers("apply tip number 1")          // [1]
 * extractTipNumbers("hello")                       // null
 * ```
 *
 * Supported formats:
 * - "implement tip 1, 2, 3"
 * - "apply tips 1 and 2"
 * - "use tip number 5"
 * - "do tip # 1, 3"
 *
 * @complexity O(n) where n is message length
 */
export function extractTipNumbers(message: string): number[] | null {
  const lowerMessage = message.toLowerCase();

  // Pattern: "implement tip [number[s]] 1, 2", "apply tip 1", "use tips 1 and 2", etc.
  // Now handles optional "number" or "numbers" between "tip" and the digits
  const tipPatterns = [
    /(?:implement|apply|use|do|execute)\s+tip[s]?\s+(?:numbers?|#)?\s*([\d,\s]+(?:and\s+\d+)?)/i,
    /tip[s]?\s+(?:numbers?|#)?\s*([\d,\s]+(?:and\s+\d+)?)/i,
  ];

  for (const pattern of tipPatterns) {
    const match = message.match(pattern);
    if (match) {
      // Extract numbers from the captured group
      const numbersStr = match[1];
      const numbers = numbersStr
        .replace(/and/gi, ',')
        .split(/[,\s]+/)
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n > 0);

      if (numbers.length > 0) {
        return numbers;
      }
    }
  }

  return null;
}

/**
 * Detect user intent from message
 *
 * Analyzes message content to route to appropriate processor (content, design, ATS tip).
 * Uses keyword matching with priority: ATS tip > Design > Content > Unclear
 *
 * @param message - User's chat message
 * @returns Detected intent category
 *
 * @example
 * ```ts
 * detectIntent("implement tip 1")              // 'ats_tip'
 * detectIntent("make the header blue")         // 'design'
 * detectIntent("add Python to skills")         // 'content'
 * detectIntent("hello")                        // 'unclear'
 * detectIntent("add React and change colors")  // 'design' or 'content' (compares keyword counts)
 * ```
 *
 * Priority rules:
 * 1. If tip numbers detected → 'ats_tip'
 * 2. If only design keywords → 'design'
 * 3. If only content keywords → 'content'
 * 4. If both keywords → whichever has more matches
 * 5. Otherwise → 'unclear'
 *
 * @see DESIGN_KEYWORDS for design keyword list
 * @see CONTENT_KEYWORDS for content keyword list
 *
 * @complexity O(n*m) where n is message length, m is keyword count
 */
export function detectIntent(message: string): MessageIntent {
  const lowerMessage = message.toLowerCase();

  // Check for ATS tip implementation first (highest priority)
  if (extractTipNumbers(message)) {
    return 'ats_tip';
  }

  // Design-specific nouns that strongly indicate design intent
  const DESIGN_SPECIFIC_NOUNS = [
    'font', 'color', 'colour', 'style', 'layout', 'spacing', 'template', 'theme',
    'background', 'header', 'footer', 'margin', 'padding', 'bold', 'italic',
    'underline', 'arial', 'times', 'helvetica', 'calibri', 'size'
  ];

  // Generic action verbs that can apply to both design and content
  const GENERIC_VERBS = ['change', 'update', 'modify', 'make', 'set', 'add'];

  // Check if message contains design-specific nouns
  const hasDesignNoun = DESIGN_SPECIFIC_NOUNS.some(noun => lowerMessage.includes(noun));

  // Check for design intent keywords
  const hasDesignKeyword = DESIGN_KEYWORDS.some(keyword => lowerMessage.includes(keyword));

  // Check for content intent keywords
  const hasContentKeyword = CONTENT_KEYWORDS.some(keyword => lowerMessage.includes(keyword));

  // IMPROVED: If message has design-specific noun + generic verb, it's design intent
  // Example: "change font to Arial" → has 'font' (design noun) + 'change' (generic verb) → design
  if (hasDesignNoun) {
    return 'design';
  }

  // Prioritize design if both are present but design is more specific
  if (hasDesignKeyword && !hasContentKeyword) {
    return 'design';
  }

  // If only content keywords
  if (hasContentKeyword && !hasDesignKeyword) {
    return 'content';
  }

  // If both or neither, count matches
  if (hasDesignKeyword && hasContentKeyword) {
    // Filter out generic verbs from content matches
    const contentMatchesFiltered = CONTENT_KEYWORDS.filter(k =>
      lowerMessage.includes(k) && !GENERIC_VERBS.includes(k)
    );

    const designMatches = DESIGN_KEYWORDS.filter(k => lowerMessage.includes(k)).length;
    const contentMatches = contentMatchesFiltered.length;

    if (designMatches > contentMatches) {
      return 'design';
    } else if (contentMatches > designMatches) {
      return 'content';
    }

    // If equal but has design keywords, prefer design
    if (designMatches > 0) {
      return 'design';
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
  if (intent === 'ats_tip') {
    return await processATSTipMessage(input);
  } else if (intent === 'design') {
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
  // Note: Allow design changes even without template by using 'natural' as pseudo-template
  // This enables inline styling and customization for the natural/plain text view
  if (!input.currentTemplateId) {
    console.log('ℹ️ No template selected, using "natural" pseudo-template for inline styling');
    input.currentTemplateId = 'natural';
    input.currentDesignConfig = input.currentDesignConfig || {};
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
 * Process ATS tip implementation messages
 */
async function processATSTipMessage(
  input: UnifiedProcessInput
): Promise<UnifiedProcessOutput> {

  try {
    // Extract tip numbers from message
    const tipNumbers = extractTipNumbers(input.message);

    if (!tipNumbers || tipNumbers.length === 0) {
      return {
        intent: 'ats_tip',
        aiResponse: "I couldn't find any tip numbers in your message. Please specify which tips to implement (e.g., 'implement tip 1, 2, and 4').",
        shouldApply: false,
        requiresClarification: true
      };
    }

    // Check if ATS suggestions are available
    if (!input.atsSuggestions || input.atsSuggestions.length === 0) {
      return {
        intent: 'ats_tip',
        aiResponse: "No ATS suggestions are available for this resume. Please run the ATS analysis first.",
        shouldApply: false,
        requiresClarification: true
      };
    }

    // Validate tip numbers
    const invalidTips = tipNumbers.filter(n => n < 1 || n > input.atsSuggestions!.length);
    if (invalidTips.length > 0) {
      return {
        intent: 'ats_tip',
        aiResponse: `Invalid tip number(s): ${invalidTips.join(', ')}. Available tips are numbered 1-${input.atsSuggestions!.length}.`,
        shouldApply: false,
        requiresClarification: true
      };
    }

    // Get the selected suggestions (convert 1-indexed to 0-indexed)
    const selectedSuggestions = tipNumbers.map(n => input.atsSuggestions![n - 1]);

    const tipList = selectedSuggestions
      .map((s, i) => `• Tip #${tipNumbers[i]}: ${s.text}`)
      .join('\n');

    // Generate amendments for each selected suggestion
    console.log(`🔄 Generating amendments for ${selectedSuggestions.length} suggestions...`);
    const resumeContent = input.currentResumeContent as OptimizedResume;
    const amendmentResults = await generateAmendmentsBatch(selectedSuggestions, resumeContent);

    // Create pending changes with populated affectedFields
    const pendingChanges = selectedSuggestions.map((s, i) => {
      const result = amendmentResults.get(s.id);
      const affectedFields = result?.success ? result.affectedFields : [];

      if (!result?.success) {
        console.warn(`Failed to generate amendments for suggestion ${s.id}:`, result?.error);
      }

      return {
        suggestionId: s.id,
        suggestionNumber: tipNumbers[i],
        suggestionText: s.text,
        description: s.explanation || s.text,
        affectedFields, // Now populated with specific changes!
        amendments: [],
        status: 'pending' as const,
        createdAt: new Date().toISOString()
      };
    });

    console.log(`✅ Generated pending changes with ${pendingChanges.reduce((sum, pc) => sum + pc.affectedFields.length, 0)} total affected fields`);

    return {
      intent: 'ats_tip',
      aiResponse: `I'll prepare the following changes for your review:\n\n${tipList}\n\nPlease review the highlighted changes on your resume and approve or reject each one.`,
      atsTipNumbers: tipNumbers,
      pendingChanges,
      shouldApply: false, // Preview mode - don't apply immediately
      requiresClarification: false
    };

  } catch (error) {
    console.error('Error processing ATS tip message:', error);

    return {
      intent: 'ats_tip',
      aiResponse: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process ATS tip request'}`,
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
