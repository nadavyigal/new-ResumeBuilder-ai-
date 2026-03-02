/**
 * Memory Manager
 *
 * Tracks conversation history and resume context for AI assistant.
 * Builds context that gets injected into assistant conversations.
 */

export interface ResumeContext {
  current_content: Record<string, unknown>;
  current_design: {
    template_id?: string;
    template_name?: string;
    customization?: any;
  };
  changes_in_session: Change[];
  optimization_id: string;
}

export interface Change {
  timestamp: string;
  type: 'content' | 'design';
  description: string;
  section?: string;
  details: any;
}

/**
 * Build resume context for assistant
 * This gets passed to the assistant as additional instructions
 */
export function buildResumeContext(context: ResumeContext): string {
  const { current_content, current_design, changes_in_session } = context;

  let contextText = '=== CURRENT RESUME STATE ===\n\n';

  // Resume content summary
  contextText += '**Resume Content:**\n';
  contextText += JSON.stringify(current_content, null, 2);
  contextText += '\n\n';

  // Current design
  contextText += '**Current Design:**\n';
  if (current_design?.template_name) {
    contextText += `Template: ${current_design.template_name}\n`;
  } else {
    contextText += 'Template: Natural (no template selected)\n';
  }

  if (current_design?.customization) {
    contextText += 'Customizations:\n';
    contextText += JSON.stringify(current_design.customization, null, 2);
  } else {
    contextText += 'No customizations applied yet\n';
  }
  contextText += '\n';

  // Changes made in this session - handle undefined safely
  if (changes_in_session && changes_in_session.length > 0) {
    contextText += '**Changes Made in This Session:**\n';
    changes_in_session.forEach((change, index) => {
      contextText += `${index + 1}. [${change.type}] ${change.description}`;
      if (change.section) {
        contextText += ` (${change.section})`;
      }
      contextText += '\n';
    });
    contextText += '\n';
  }

  contextText += '=== END CONTEXT ===\n\n';
  contextText += 'Use this context to understand the current state of the resume when responding to the user. ';
  contextText += 'When they say "make it darker" or "change it back", refer to this context to understand what they mean.';

  return contextText;
}

/**
 * Track a new change in the session
 */
export function recordChange(
  context: ResumeContext,
  type: 'content' | 'design',
  description: string,
  section?: string,
  details?: any
): ResumeContext {
  const change: Change = {
    timestamp: new Date().toISOString(),
    type,
    description,
    section,
    details: details || {}
  };

  return {
    ...context,
    changes_in_session: [...context.changes_in_session, change]
  };
}

/**
 * Update current content in context
 */
export function updateContextContent(
  context: ResumeContext,
  newContent: Record<string, unknown>
): ResumeContext {
  return {
    ...context,
    current_content: newContent
  };
}

/**
 * Update current design in context
 */
export function updateContextDesign(
  context: ResumeContext,
  design: {
    template_id?: string;
    template_name?: string;
    customization?: any;
  }
): ResumeContext {
  return {
    ...context,
    current_design: design
  };
}

/**
 * Get summary of recent changes (for display or logging)
 */
export function getRecentChangesSummary(context: ResumeContext, limit: number = 5): string {
  const recentChanges = context.changes_in_session.slice(-limit);

  if (recentChanges.length === 0) {
    return 'No changes made yet in this session.';
  }

  return recentChanges
    .map((change, index) => `${index + 1}. ${change.description}`)
    .join('\n');
}

/**
 * Initialize empty context for new session
 */
export function createEmptyContext(
  optimizationId: string,
  initialContent: Record<string, unknown>,
  initialDesign: {
    template_id?: string;
    template_name?: string;
    customization?: any;
  }
): ResumeContext {
  return {
    current_content: initialContent,
    current_design: initialDesign,
    changes_in_session: [],
    optimization_id: optimizationId
  };
}
