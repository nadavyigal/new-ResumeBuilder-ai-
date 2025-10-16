/**
 * Message Processor
 *
 * Extracts amendment requests from user chat messages.
 * Identifies intent (add, modify, remove, clarify) and target sections.
 * Detects vague requests and returns clarifying questions (Feature 006).
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
  requiresClarification?: boolean;
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
      requiresClarification: false,
    };
  }

  // Check for vague requests that need clarification (Feature 006)
  const vagueRequest = detectVagueRequest(message);
  if (vagueRequest.isVague) {
    return {
      amendments: [{
        type: 'clarify',
        targetSection: null,
        description: message,
      }],
      aiResponse: vagueRequest.clarifyingQuestion,
      shouldApply: false,
      requiresClarification: true,
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
    requiresClarification: false,
  };
}

/**
 * Detect vague user requests that need clarification (Feature 006)
 *
 * Identifies generic improvement requests without specific intent or target.
 * Returns appropriate clarifying questions to guide the conversation.
 *
 * @param message - User's request message
 * @returns Detection result with clarifying question if vague
 */
export interface VagueRequestResult {
  isVague: boolean;
  clarifyingQuestion: string;
}

export function detectVagueRequest(message: string): VagueRequestResult {
  const lowerMessage = message.toLowerCase().trim();

  // Pattern 1: Generic "make it better" requests
  const genericImprovementPatterns = [
    /^make (it|this|my resume) better$/i,
    /^improve (it|this|my resume)$/i,
    /^enhance (it|this|my resume)$/i,
    /^fix (it|this|my resume)$/i,
    /^update (it|this|my resume)$/i,
    /^tweak (it|this|my resume)$/i, // Added in T014
    /^refine (it|this|my resume)$/i, // Added in T014
    /^help( me)?$/i,
    /^can you help$/i,
  ];

  for (const pattern of genericImprovementPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        isVague: true,
        clarifyingQuestion:
          "I'd love to help! Which section would you like to improve?\n\n" +
          "• **Summary** - Your professional headline and overview\n" +
          "• **Experience** - Specific job roles or bullet points\n" +
          "• **Skills** - Technical or soft skills to highlight\n" +
          "• **Education** - Academic credentials or certifications\n\n" +
          "Or let me know if you want to focus on something specific!",
      };
    }
  }

  // Pattern 2: Vague section references without specific action
  const vagueSectionPatterns = [
    /^(my |the )?(summary|experience|skills|education)$/i,
    /^look at (my |the )?(summary|experience|skills|education)$/i,
    /^check (my |the )?(summary|experience|skills|education)$/i,
    /^review (my |the )?(summary|experience|skills|education)$/i,
    /^work on (my |the )?(summary|experience|skills|education)$/i, // Added in T014
    /^go over (my |the )?(summary|experience|skills|education)$/i, // Added in T014
  ];

  for (const pattern of vagueSectionPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      const section = match[2] || match[1]; // Get the section name
      return {
        isVague: true,
        clarifyingQuestion:
          `Great! Let's work on your ${section} section. What would you like me to focus on?\n\n` +
          "• **Keywords** - Add industry-specific terms for ATS\n" +
          "• **Impact** - Strengthen metrics and outcomes\n" +
          "• **Tone** - Adjust language and style\n" +
          "• **Structure** - Reorganize or reformat content\n\n" +
          "Or describe the specific change you have in mind!",
      };
    }
  }

  // Pattern 3: Ambiguous improvement requests with unclear scope
  const ambiguousPatterns = [
    /make (it|this|my resume) (more |better |stronger )?for/i,
    /^optimize$/i,
    /^improve$/i,
    /^enhance$/i,
    /^strengthen$/i,
    /^polish$/i,
    /^refine$/i, // Added in T014
  ];

  for (const pattern of ambiguousPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        isVague: true,
        clarifyingQuestion:
          "I can definitely help optimize your resume! To make sure I focus on what matters most, could you tell me:\n\n" +
          "1. **Which section** needs work? (summary, experience, skills, etc.)\n" +
          "2. **What aspect** should I improve? (keywords, impact, clarity, formatting)\n\n" +
          "Or feel free to be specific - e.g., 'Add more technical keywords to my latest role' or 'Make my summary stronger for product manager positions'",
      };
    }
  }

  // Pattern 4: Single-word or two-word vague commands
  const vagueCommands = [
    /^better$/i,
    /^more$/i,
    /^change$/i,
    /^fix$/i,
    /^help$/i,
    /^improve$/i,
    /^update$/i,
    /^tweak$/i, // Added in T014
    /^refine$/i, // Added in T014
    /^(make|do) (it|this)$/i,
  ];

  for (const pattern of vagueCommands) {
    if (pattern.test(lowerMessage)) {
      return {
        isVague: true,
        clarifyingQuestion:
          "I'm here to help! Can you give me a bit more detail?\n\n" +
          "For example:\n" +
          "• 'Add project management keywords to my second role'\n" +
          "• 'Make my summary more focused on data analysis'\n" +
          "• 'Improve the metrics in my latest job'\n" +
          "• 'Rewrite my first bullet to be more impactful'\n\n" +
          "What would you like to work on?",
      };
    }
  }

  // Not vague - has sufficient specificity
  return {
    isVague: false,
    clarifyingQuestion: '',
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
