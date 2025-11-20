/**
 * Modification Parser - Convert natural language to structured modifications
 *
 * Parses user messages like:
 * - "add Senior to my job title" → prefix operation
 * - "change email to john@example.com" → replace operation
 * - "remove Python from skills" → remove operation
 *
 * @module lib/ai-assistant/modification-parser
 */

import type { ModificationOperation } from '../resume/modification-applier';

/**
 * Parsed modification intent
 */
export interface ModificationIntent {
  is_modification: boolean;
  operation: ModificationOperation['operation'];
  field_path: string;
  new_value?: any;
  target_value?: string;
  values?: any[];
  confidence: number;
  requires_clarification?: boolean;
  clarification_question?: string;
  suggested_fields?: string[];
  warnings?: string[];
  should_skip?: boolean;
  context_used?: boolean;
  modifications?: ModificationIntent[];
  error?: string;
}

/**
 * Technical skill keywords for classification
 */
const TECHNICAL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust',
  'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring',
  'sql', 'mongodb', 'postgresql', 'redis', 'elasticsearch',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd',
  'git', 'github', 'gitlab', 'jenkins', 'terraform',
  'html', 'css', 'sass', 'tailwind', 'bootstrap',
  'api', 'rest', 'graphql', 'websocket', 'grpc',
  'testing', 'jest', 'cypress', 'selenium', 'junit',
];

/**
 * Parse natural language message into structured modification
 *
 * @param message - User's natural language message
 * @param resumeContext - Optional resume data for context awareness
 * @returns Parsed modification intent
 *
 * @example
 * parseModificationIntent("add Senior to my job title")
 * // Returns: {
 * //   operation: 'prefix',
 * //   field_path: 'experiences[latest].title',
 * //   new_value: 'Senior ',
 * //   confidence: 0.9
 * // }
 */
export function parseModificationIntent(
  message: string,
  resumeContext?: any
): ModificationIntent {
  if (!message || message.trim() === '') {
    throw new Error('Message cannot be empty');
  }

  const lowerMessage = message.toLowerCase().trim();

  // Check if this is a modification intent
  if (!isModificationMessage(lowerMessage)) {
    return {
      is_modification: false,
      operation: 'replace',
      field_path: '',
      confidence: 0,
      error: 'Message does not appear to be a modification request',
    };
  }

  // Parse job title modifications
  if (lowerMessage.includes('job title') || lowerMessage.includes('title')) {
    return parseJobTitleModification(message, lowerMessage, resumeContext);
  }

  // Parse contact modifications
  if (lowerMessage.includes('email')) {
    return parseContactModification(message, lowerMessage, 'email');
  }
  if (lowerMessage.includes('phone')) {
    return parseContactModification(message, lowerMessage, 'phone');
  }
  if (lowerMessage.includes('location')) {
    return parseContactModification(message, lowerMessage, 'location');
  }

  // Parse skill modifications
  if (lowerMessage.includes('skill')) {
    return parseSkillModification(message, lowerMessage, resumeContext);
  }

  // Parse summary modifications
  if (lowerMessage.includes('summary')) {
    return parseSummaryModification(message, lowerMessage);
  }

  // Parse achievement modifications
  if (lowerMessage.includes('achievement')) {
    return parseAchievementModification(message, lowerMessage, resumeContext);
  }

  // Ambiguous modification
  return {
    is_modification: true,
    operation: 'replace',
    field_path: '',
    confidence: 0.3,
    requires_clarification: true,
    clarification_question: 'What would you like to modify? (job title, email, skills, summary, etc.)',
  };
}

/**
 * Check if message is a modification intent
 */
function isModificationMessage(message: string): boolean {
  const modificationKeywords = [
    'add', 'change', 'update', 'modify', 'remove', 'delete',
    'replace', 'set', 'make', 'insert',
  ];

  return modificationKeywords.some(keyword => message.includes(keyword));
}

/**
 * Parse job title modification
 */
function parseJobTitleModification(
  message: string,
  lowerMessage: string,
  context?: any
): ModificationIntent {
  const fieldPath = context
    ? 'experiences[0].title'
    : 'experiences[latest].title';

  // "add X to title" → prefix
  if (lowerMessage.match(/add\s+(\w+)\s+to.*title/)) {
    const match = message.match(/add\s+(\w+)\s+to/i);
    const value = match ? match[1] + ' ' : '';

    return {
      is_modification: true,
      operation: 'prefix',
      field_path: fieldPath,
      new_value: value,
      confidence: 0.9,
      context_used: !!context,
    };
  }

  // "add X at the end" or "add X to end" → suffix
  if (lowerMessage.match(/add\s+(\w+)\s+(at the end|to end|at end)/)) {
    const match = message.match(/add\s+(\w+)\s+/i);
    const value = match ? ' ' + match[1] : '';

    return {
      is_modification: true,
      operation: 'suffix',
      field_path: fieldPath,
      new_value: value,
      confidence: 0.9,
    };
  }

  // "change title to X" or "make me X" → replace
  if (lowerMessage.match(/(change|update|make).*title to|make me/)) {
    const match = message.match(/(?:to|me)\s+(.+?)(?:\s*$)/i);
    const value = match ? match[1].trim() : '';

    return {
      is_modification: true,
      operation: 'replace',
      field_path: fieldPath,
      new_value: value,
      confidence: 0.85,
    };
  }

  // Ambiguous
  return {
    is_modification: true,
    operation: 'replace',
    field_path: fieldPath,
    confidence: 0.5,
    requires_clarification: true,
    clarification_question: 'Would you like to add text, replace the entire title, or make another change?',
  };
}

/**
 * Parse contact field modification
 */
function parseContactModification(
  message: string,
  lowerMessage: string,
  field: 'email' | 'phone' | 'location'
): ModificationIntent {
  // "change email to X"
  const match = message.match(new RegExp(`${field}\\s+to\\s+(.+?)(?:\\s*$)`, 'i'));
  const value = match ? match[1].trim() : '';

  if (value) {
    return {
      is_modification: true,
      operation: 'replace',
      field_path: `contact.${field}`,
      new_value: value,
      confidence: 0.95,
    };
  }

  return {
    is_modification: true,
    operation: 'replace',
    field_path: `contact.${field}`,
    confidence: 0.4,
    requires_clarification: true,
    clarification_question: `What would you like to change your ${field} to?`,
  };
}

/**
 * Parse skill modification
 */
function parseSkillModification(
  message: string,
  lowerMessage: string,
  context?: any
): ModificationIntent {
  // "add X to skills"
  if (lowerMessage.includes('add')) {
    const match = message.match(/add\s+(.+?)\s+(?:to|in)/i);
    if (match) {
      const skillsText = match[1];
      const skills = skillsText.split(/\s+and\s+|,\s*/);

      // Determine if technical or soft skill
      const skill = skills[0].trim();
      const isTechnical = TECHNICAL_KEYWORDS.some(kw =>
        skill.toLowerCase().includes(kw)
      );

      const fieldPath = isTechnical ? 'skills.technical' : 'skills.soft';

      // Check for duplicates
      if (context && context.skills) {
        const allSkills = [
          ...(context.skills.technical || []),
          ...(context.skills.soft || []),
        ];
        if (allSkills.includes(skill)) {
          return {
            is_modification: true,
            operation: 'append',
            field_path: fieldPath,
            new_value: skill,
            confidence: 0.9,
            warnings: [`${skill} already exists in skills`],
            should_skip: true,
          };
        }
      }

      if (skills.length > 1) {
        return {
          is_modification: true,
          operation: 'append',
          field_path: fieldPath,
          values: skills.map(s => s.trim()),
          confidence: 0.85,
        };
      }

      return {
        is_modification: true,
        operation: 'append',
        field_path: fieldPath,
        new_value: skill,
        confidence: 0.9,
      };
    }
  }

  // "remove X from skills"
  if (lowerMessage.includes('remove') || lowerMessage.includes('delete')) {
    const match = message.match(/(?:remove|delete)\s+(.+?)\s+from/i);
    const skill = match ? match[1].trim() : '';

    return {
      is_modification: true,
      operation: 'remove',
      field_path: 'skills.technical', // Will need to search both
      target_value: skill,
      confidence: 0.85,
    };
  }

  return {
    is_modification: true,
    operation: 'append',
    field_path: 'skills.technical',
    confidence: 0.4,
    requires_clarification: true,
    clarification_question: 'Which skill would you like to add or remove?',
  };
}

/**
 * Parse summary modification
 */
function parseSummaryModification(
  message: string,
  lowerMessage: string
): ModificationIntent {
  // "change summary to X"
  if (lowerMessage.includes('change') || lowerMessage.includes('update')) {
    const match = message.match(/summary\s+to\s+(.+?)(?:\s*$)/i);
    const value = match ? match[1].trim() : '';

    return {
      is_modification: true,
      operation: 'replace',
      field_path: 'summary',
      new_value: value,
      confidence: value ? 0.9 : 0.5,
      requires_clarification: !value,
      clarification_question: value ? undefined : 'What would you like your summary to say?',
    };
  }

  // "add to summary"
  if (lowerMessage.includes('add')) {
    const match = message.match(/add\s+(?:to\s+)?(?:my\s+)?summary:?\s*(.+?)(?:\s*$)/i);
    const value = match ? match[1].trim() : '';

    return {
      is_modification: true,
      operation: 'suffix',
      field_path: 'summary',
      new_value: value ? ' ' + value : '',
      confidence: value ? 0.85 : 0.4,
    };
  }

  return {
    is_modification: true,
    operation: 'replace',
    field_path: 'summary',
    confidence: 0.4,
    requires_clarification: true,
    clarification_question: 'What would you like to change about your summary?',
  };
}

/**
 * Parse achievement modification
 */
function parseAchievementModification(
  message: string,
  lowerMessage: string,
  context?: any
): ModificationIntent {
  const fieldPath = 'experiences[latest].achievements';

  // "add achievement"
  if (lowerMessage.includes('add')) {
    const match = message.match(/achievement.*?:\s*(.+?)(?:\s*$)/i);
    const value = match ? match[1].trim() : '';

    return {
      is_modification: true,
      operation: 'append',
      field_path: fieldPath,
      new_value: value,
      confidence: value ? 0.9 : 0.5,
    };
  }

  // "remove second achievement" → remove with index
  if (lowerMessage.includes('remove') || lowerMessage.includes('delete')) {
    const indexMatch = lowerMessage.match(/(first|second|third|\d+)/);
    const index = indexMatch ? parseOrdinal(indexMatch[1]) : 1;

    return {
      is_modification: true,
      operation: 'remove',
      field_path: `${fieldPath}[${index}]`,
      confidence: 0.85,
    };
  }

  // "change first achievement"
  if (lowerMessage.includes('change') || lowerMessage.includes('update')) {
    const indexMatch = lowerMessage.match(/(first|second|third|\d+)/);
    const index = indexMatch ? parseOrdinal(indexMatch[1]) : 0;

    const match = message.match(/achievement.*?(?:to|:)\s*(.+?)(?:\s*$)/i);
    const value = match ? match[1].trim() : '';

    return {
      is_modification: true,
      operation: 'replace',
      field_path: `${fieldPath}[${index}]`,
      new_value: value,
      confidence: value ? 0.85 : 0.5,
    };
  }

  return {
    is_modification: true,
    operation: 'append',
    field_path: fieldPath,
    confidence: 0.4,
    requires_clarification: true,
    clarification_question: 'What achievement would you like to add, change, or remove?',
  };
}

/**
 * Convert ordinal words to numbers
 */
function parseOrdinal(ordinal: string): number {
  const ordinalMap: Record<string, number> = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    latest: 0,
    'most recent': 0,
  };

  const lower = ordinal.toLowerCase();
  if (lower in ordinalMap) {
    return ordinalMap[lower];
  }

  const num = parseInt(ordinal, 10);
  return isNaN(num) ? 0 : num - 1; // Convert 1-indexed to 0-indexed
}
