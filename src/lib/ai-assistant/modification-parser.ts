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
    throw new Error('Empty message is not allowed');
  }

  // Normalize common typos and casing
  const normalized = message.replace(/^ad\s+/i, 'add ').replace(/skillz/i, 'skills');
  const lowerMessage = normalized.toLowerCase().trim();

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

  // Handle combined modifications (e.g., change title and summary in one sentence)
  if (lowerMessage.includes('title') && lowerMessage.includes('summary') && lowerMessage.includes(' and ')) {
    const titleMatch = normalized.match(/title\s+to\s+(.+?)(?:\s+and|$)/i);
    const summaryMatch = normalized.match(/add\s+(.+?)\s+to\s+summary/i);

    const first = titleMatch
      ? parseJobTitleModification(`change my title to ${titleMatch[1]}`, `change my title to ${titleMatch[1]}`.toLowerCase(), resumeContext)
      : parseJobTitleModification(normalized, lowerMessage, resumeContext);
    const second = summaryMatch
      ? parseSummaryModification(`add ${summaryMatch[1]} to summary`, `add ${summaryMatch[1]} to summary`.toLowerCase())
      : parseSummaryModification(normalized, lowerMessage);

    return {
      ...first,
      modifications: [first, second],
    };
  }

  // Treat "make me <role>" as a title change even without explicit "title"
  if (!lowerMessage.includes('title') && lowerMessage.match(/make me\s+/)) {
    return parseJobTitleModification(normalized + ' title', (normalized + ' title').toLowerCase(), resumeContext);
  }

  // Handle shorthand "latest job" / "most recent job" without explicit title
  if (
    (lowerMessage.includes('latest job') || lowerMessage.includes('most recent job')) &&
    !lowerMessage.includes('title') &&
    !lowerMessage.includes('achievement')
  ) {
    return {
      is_modification: true,
      operation: 'replace',
      field_path: resolveTitleFieldPath(lowerMessage, resumeContext),
      confidence: 0.6,
      requires_clarification: true,
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
  if (lowerMessage.includes('emial')) {
    return {
      is_modification: true,
      operation: 'replace',
      field_path: 'contact.email',
      confidence: 0.4,
      requires_clarification: true,
      clarification_question: 'Did you want to change your email address?',
      suggested_fields: ['contact.email'],
    };
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
    return parseAchievementModification(message, lowerMessage);
  }

  // Generic experience modification (fallback)
  if (lowerMessage.includes('experience')) {
    const ordinalMatch = lowerMessage.match(/(first|second|third|latest|most recent|\d+)/);
    const index = ordinalMatch ? parseOrdinal(ordinalMatch[1]) : 0;
    return {
      is_modification: true,
      operation: 'replace',
      field_path: index === 0 ? 'experiences[latest]' : `experiences[${index}]`,
      confidence: 0.5,
      requires_clarification: true,
      clarification_question: 'What would you like to change about this experience?',
    };
  }

  // Ambiguity handling for short "add senior" style requests
  if (lowerMessage.startsWith('add senior')) {
    return {
      is_modification: true,
      operation: 'prefix',
      field_path: '',
      confidence: 0.4,
      requires_clarification: true,
      clarification_question: 'What would you like to add Senior to? (e.g., experiences[latest].title)',
      suggested_fields: ['experiences[latest].title'],
    };
  }

  // Ambiguous modification
  return {
    is_modification: true,
    operation: 'replace',
    field_path: '',
    confidence: 0.3,
    requires_clarification: true,
    clarification_question: 'What would you like to modify? (job title, email, skills, summary, etc.)',
    suggested_fields: ['experiences[latest].title', 'contact.email', 'skills.technical'],
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
  const fieldPath = resolveTitleFieldPath(lowerMessage, context);

  // "make me <role>"
  const makeMeMatch = message.match(/make\s+me\s+(?:a|an)?\s*(.+)$/i);
  if (makeMeMatch) {
    const value = stripQuotes(makeMeMatch[1].trim());
    return {
      is_modification: true,
      operation: 'replace',
      field_path: fieldPath,
      new_value: value,
      confidence: 0.9,
      context_used: !!context,
    };
  }

  // "add X to title" → prefix/suffix
  if (lowerMessage.match(/add\s+(.+?)\s+to.*title/)) {
    const match = message.match(/add\s+(.+?)\s+to/i);
    const rawValue = match ? stripQuotes(match[1].trim()) : '';
    const isRoman = /^(i{1,3}|iv|v)$/i.test(rawValue);
    const isSuffix = lowerMessage.includes('end') || lowerMessage.includes('suffix') || isRoman;
    const value = isSuffix ? ` ${rawValue}` : `${rawValue} `;

    return {
      is_modification: true,
      operation: isSuffix ? 'suffix' : 'prefix',
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
    const value = match ? stripQuotes(match[1].trim()) : '';

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
    suggested_fields: [fieldPath],
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
  const contactPattern = field === 'phone'
    ? /(phone number|phone|number)\s+(?:to|is)\s+(.+?)(?:\s*$)/i
    : new RegExp(`${field}\\s+(?:to|is)\\s+(.+?)(?:\\s*$)`, 'i');

  const match = message.match(contactPattern);
  const value = match ? stripQuotes((match[2] || match[1]).trim()) : '';

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
    suggested_fields: [`contact.${field}`],
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

      if (!skillsText.trim() || skillsText.trim().toLowerCase() === 'to') {
        return {
          is_modification: true,
          operation: 'append',
          field_path: 'skills.technical',
          confidence: 0.4,
          requires_clarification: true,
          clarification_question: 'Which skill would you like to add?',
        };
      }

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
    const skill = match ? stripQuotes(match[1].trim()) : '';
    const ordinalMatch = lowerMessage.match(/(first|second|third|\d+)/);
    const index = ordinalMatch ? parseOrdinal(ordinalMatch[1]) : undefined;

    return {
      is_modification: true,
      operation: 'remove',
      field_path: index !== undefined ? `skills.technical[${index}]` : 'skills.technical', // Will need to search both
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
  lowerMessage: string
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

/**
 * Determine experience title path using context and hints
 */
function resolveTitleFieldPath(lowerMessage: string, context?: any): string {
  if (lowerMessage.includes('previous') && context?.experiences?.length > 1) {
    return 'experiences[1].title';
  }
  if (lowerMessage.includes('latest') || lowerMessage.includes('most recent')) {
    return context ? 'experiences[0].title' : 'experiences[latest].title';
  }
  return context ? 'experiences[0].title' : 'experiences[latest].title';
}

function stripQuotes(value: string): string {
  return value.replace(/^\"(.*)\"$/, '$1').trim();
}
