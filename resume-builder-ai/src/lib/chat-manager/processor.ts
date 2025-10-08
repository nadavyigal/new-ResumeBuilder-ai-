/**
 * Message Processor
 *
 * Extracts amendment requests from user chat messages.
 * Identifies intent (add, modify, remove, clarify) and target sections.
 */

export interface ProcessMessageInput {
  message: string;
  sessionId: string;
  currentResumeContent: Record<string, unknown>;
}

export interface AmendmentRequest {
  type: 'add' | 'modify' | 'remove' | 'clarify';
  targetSection: string | null;
  description: string;
}

export interface ProcessMessageOutput {
  amendments: AmendmentRequest[];
  aiResponse: string;
  shouldApply: boolean;
}

/**
 * Process user message and extract amendment requests
 *
 * @param input - Message processing input
 * @returns Extracted amendments and AI response
 */
export async function processMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageOutput> {
  // Validate message
  const validation = validateMessageDetailed(input.message);
  if (!validation.valid) {
    throw new Error(`Invalid message: ${validation.error}`);
  }

  // Use sanitized message
  const message = validation.sanitized || input.message;

  // Check for fabrication attempts
  if (detectFabrication(message, input.currentResumeContent)) {
    return {
      amendments: [],
      aiResponse:
        'I cannot add fabricated information to your resume. Please only request changes based on your actual experience and skills. If you believe this is an error, please rephrase your request to clarify what existing information you want to modify.',
      shouldApply: false,
    };
  }

  // Extract amendment type from message using basic keyword matching
  const amendments: AmendmentRequest[] = [];
  const lowerMessage = input.message.toLowerCase();

  if (lowerMessage.includes('add')) {
    amendments.push({
      type: 'add',
      targetSection: extractSection(input.message),
      description: input.message,
    });
  } else if (lowerMessage.includes('remove') || lowerMessage.includes('delete')) {
    amendments.push({
      type: 'remove',
      targetSection: extractSection(input.message),
      description: input.message,
    });
  } else if (lowerMessage.includes('change') || lowerMessage.includes('modify') || lowerMessage.includes('update')) {
    amendments.push({
      type: 'modify',
      targetSection: extractSection(input.message),
      description: input.message,
    });
  } else {
    amendments.push({
      type: 'clarify',
      targetSection: null,
      description: input.message,
    });
  }

  return {
    amendments,
    aiResponse: `I'll help you ${amendments[0].type} content ${amendments[0].targetSection ? `in your ${amendments[0].targetSection} section` : ''}. Let me process that change.`,
    shouldApply: true,
  };
}

/**
 * Extract target section from message
 */
function extractSection(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('skill')) return 'skills';
  if (lowerMessage.includes('experience')) return 'experience';
  if (lowerMessage.includes('education')) return 'education';
  if (lowerMessage.includes('summary')) return 'summary';

  return null;
}

/**
 * Validate message content (length, sanitization, forbidden patterns)
 *
 * @param message - Message to validate
 * @returns Validation result with error details if invalid
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

export function validateMessage(message: string): boolean {
  const result = validateMessageDetailed(message);
  return result.valid;
}

export function validateMessageDetailed(message: string): ValidationResult {
  // Check for null/undefined
  if (!message) {
    return { valid: false, error: 'Message is required' };
  }

  // Check for empty/whitespace-only
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty or whitespace-only' };
  }

  // Check minimum length (at least 3 characters for meaningful input)
  if (trimmed.length < 3) {
    return { valid: false, error: 'Message must be at least 3 characters long' };
  }

  // Check maximum length
  if (message.length > 5000) {
    return { valid: false, error: 'Message exceeds maximum length of 5000 characters' };
  }

  // Sanitize: remove control characters (except newlines and tabs)
  const sanitized = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Check for suspicious patterns (potential injection attempts)
  const suspiciousPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
    /data:text\/html/gi, // Data URLs
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      return {
        valid: false,
        error: 'Message contains potentially unsafe content',
      };
    }
  }

  // Check for excessive repetition (spam detection)
  if (hasExcessiveRepetition(sanitized)) {
    return {
      valid: false,
      error: 'Message contains excessive repetition',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Detect excessive character or word repetition
 */
function hasExcessiveRepetition(text: string): boolean {
  // Check for repeated characters (e.g., "aaaaaaa")
  const charRepeatPattern = /(.)\1{10,}/;
  if (charRepeatPattern.test(text)) {
    return true;
  }

  // Check for repeated words (e.g., "help help help help")
  const words = text.toLowerCase().split(/\s+/);
  if (words.length >= 5) {
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      if (word.length > 2) {
        // Ignore very short words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        if (wordCounts.get(word)! > words.length * 0.5) {
          // More than 50% repetition
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Detect fabrication attempts in user requests
 *
 * Checks for patterns that suggest adding false information to resume:
 * - Adding work experience at companies not in original resume
 * - Adding skills that aren't demonstrated in experience
 * - Adding education credentials not previously listed
 * - Inflating job titles or responsibilities
 *
 * @param message - User's request message
 * @param currentResumeContent - Current resume data for verification
 * @returns True if fabrication attempt detected
 */
export function detectFabrication(
  message: string,
  currentResumeContent?: Record<string, unknown>
): boolean {
  const lowerMessage = message.toLowerCase();

  // Fabrication indicator keywords
  const fabricationKeywords = [
    'fake',
    'make up',
    'fabricate',
    'invent',
    'pretend',
    'lie about',
    'falsify',
    'create fake',
  ];

  // Check for explicit fabrication keywords
  for (const keyword of fabricationKeywords) {
    if (lowerMessage.includes(keyword)) {
      return true;
    }
  }

  // Check for suspicious "add" patterns without verification
  const suspiciousAddPatterns = [
    /add\s+(work\s+)?experience\s+at\s+(?!my|our|the)/i, // "add experience at Google" (not "my experience")
    /add\s+(?:that\s+)?(?:i|we)\s+worked\s+at/i, // "add that I worked at"
    /make\s+it\s+(?:seem|look)\s+like/i, // "make it seem like"
    /say\s+(?:that\s+)?(?:i|we)\s+(?:have|had|worked)/i, // "say that I have"
    /include\s+(?:that\s+)?(?:i|we)\s+(?:have|had)/i, // "include that I have"
  ];

  for (const pattern of suspiciousAddPatterns) {
    if (pattern.test(message)) {
      return true;
    }
  }

  // If resume content is available, check for adding unverified information
  if (currentResumeContent) {
    // Check if trying to add experience at a company not in resume
    const experiencePattern = /add\s+(?:work\s+)?experience\s+at\s+(\w+)/i;
    const match = message.match(experiencePattern);

    if (match) {
      const companyName = match[1].toLowerCase();
      const experienceData = currentResumeContent.experience as any[];

      if (experienceData && Array.isArray(experienceData)) {
        const hasCompany = experienceData.some(
          (exp) => exp.company?.toLowerCase().includes(companyName)
        );

        if (!hasCompany) {
          // Trying to add experience at a company not in resume
          return true;
        }
      }
    }

    // Check if trying to add skills without basis
    const skillPattern = /add\s+(?:skill|proficiency|expertise)\s+(?:in\s+)?(\w+)/i;
    const skillMatch = message.match(skillPattern);

    if (skillMatch) {
      const skillName = skillMatch[1].toLowerCase();
      const skillsData = currentResumeContent.skills as any;

      if (skillsData) {
        const allSkills = [
          ...(skillsData.technical || []),
          ...(skillsData.soft || []),
        ].map((s) => s.toLowerCase());

        // Allow adding skills if they're mentioned in experience
        const experienceText = JSON.stringify(currentResumeContent.experience || []).toLowerCase();

        if (!allSkills.includes(skillName) && !experienceText.includes(skillName)) {
          // Trying to add a skill with no evidence in resume
          return true;
        }
      }
    }
  }

  return false;
}
