/**
 * Customization Engine Module
 * Interprets natural language design requests and applies customizations
 *
 * Reference: specs/003-i-want-to/research.md
 * Task: T021
 */

import OpenAI from 'openai';
import { validateCustomization } from './ats-validator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface CustomizationResult {
  customization: {
    color_scheme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    font_family: {
      heading: string;
      body: string;
    };
    spacing: {
      section_gap: string;
      line_height: string;
    };
    custom_css: string;
    is_ats_safe: boolean;
  };
  reasoning: string;
  preview: string;
}

export interface InterpretationResult {
  understood: boolean;
  customization?: any;
  reasoning?: string;
  clarificationNeeded?: string;
  error?: 'ats_violation' | 'unclear_request' | 'fabrication' | 'invalid_request';
  validationErrors?: string[];
}

/**
 * Interprets natural language design request and generates customization config
 * @param changeRequest - User's natural language request
 * @param currentConfig - Current customization config (for incremental changes)
 * @returns Interpretation result with customization or error
 */
export async function interpretDesignRequest(
  changeRequest: string,
  currentConfig: any
): Promise<InterpretationResult> {
  try {
    // Check for fabrication attempts
    if (isFabricationAttempt(changeRequest)) {
      return {
        understood: false,
        error: 'fabrication',
        clarificationNeeded: 'Design customization cannot modify resume content. Please request visual changes only (colors, fonts, spacing).'
      };
    }

    // Check for unclear requests
    if (isUnclearRequest(changeRequest)) {
      return {
        understood: false,
        error: 'unclear_request',
        clarificationNeeded: 'Please be more specific. For example: "make headers dark blue", "use Times New Roman for body text", or "increase spacing between sections".'
      };
    }

    const prompt = buildCustomizationPrompt(changeRequest, currentConfig);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional resume design consultant. Your job is to interpret user requests for visual design changes and generate JSON configuration.

IMPORTANT RULES:
1. Only modify visual design (colors, fonts, spacing, layout)
2. Never add, remove, or modify content
3. Maintain ATS compatibility (no images, no complex graphics)
4. Preserve current settings unless explicitly requested to change

Respond in JSON format:
{
  "understood": true,
  "customization": {
    "color_scheme": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "text": "#hex"
    },
    "font_family": {
      "heading": "font name",
      "body": "font name"
    },
    "spacing": {
      "section_gap": "CSS value",
      "line_height": "CSS value"
    },
    "custom_css": "/* additional CSS if needed */"
  },
  "reasoning": "Brief explanation of changes"
}

If unclear, respond:
{
  "understood": false,
  "clarificationNeeded": "What specific aspect would you like to change?"
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse JSON response
    const result = JSON.parse(responseText);

    if (!result.understood) {
      return {
        understood: false,
        error: 'unclear_request',
        clarificationNeeded: result.clarificationNeeded || 'Please provide more details about the design change you want.'
      };
    }

    // Validate ATS compatibility
    const validation = validateCustomization(result.customization);

    if (!validation.isValid) {
      return {
        understood: false,
        error: 'ats_violation',
        validationErrors: validation.errors,
        clarificationNeeded: validation.errors.join(' ')
      };
    }

    return {
      understood: true,
      customization: result.customization,
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error('Error interpreting design request:', error);
    return {
      understood: false,
      error: 'invalid_request',
      clarificationNeeded: 'Unable to process request. Please try rephrasing your design change.'
    };
  }
}

/**
 * Applies customization configuration to generate preview HTML
 * @param templateId - Template slug
 * @param resumeData - Resume content
 * @param customization - Customization config
 * @returns HTML preview string
 */
export function applyCustomization(
  templateId: string,
  resumeData: any,
  customization: any
): string {
  // Import template renderer
  const { renderTemplatePreview } = require('./template-renderer');

  // Render template with customization
  return renderTemplatePreview(templateId, resumeData, customization);
}

/**
 * Validates and applies design request in one step
 * @param changeRequest - Natural language request
 * @param templateId - Current template ID
 * @param currentConfig - Current customization config
 * @param resumeData - Resume content for preview
 * @returns Customization result with preview
 */
export async function validateAndApply(
  changeRequest: string,
  templateId: string,
  currentConfig: any,
  resumeData: any
): Promise<CustomizationResult | InterpretationResult> {
  // Interpret request
  const interpretation = await interpretDesignRequest(changeRequest, currentConfig);

  if (!interpretation.understood) {
    return interpretation;
  }

  // Merge with current config (incremental changes)
  const mergedConfig = mergeConfigs(currentConfig, interpretation.customization);

  // Generate preview
  const preview = applyCustomization(templateId, resumeData, mergedConfig);

  return {
    customization: {
      ...mergedConfig,
      is_ats_safe: true
    },
    reasoning: interpretation.reasoning || 'Design updated successfully.',
    preview
  };
}

/**
 * Builds customization prompt from request and current config
 */
function buildCustomizationPrompt(changeRequest: string, currentConfig: any): string {
  const currentColors = currentConfig?.color_scheme || {};
  const currentFonts = currentConfig?.font_family || {};
  const currentSpacing = currentConfig?.spacing || {};

  return `User request: "${changeRequest}"

Current design configuration:
- Primary color: ${currentColors.primary || '#2c3e50'}
- Heading font: ${currentFonts.heading || 'Arial'}
- Body font: ${currentFonts.body || 'Arial'}
- Section gap: ${currentSpacing.section_gap || '1.5rem'}
- Line height: ${currentSpacing.line_height || '1.6'}

Generate updated configuration based on the request. Only change what was explicitly requested.`;
}

/**
 * Merges new customization with current config
 */
function mergeConfigs(current: any, updates: any): any {
  return {
    color_scheme: {
      ...(current?.color_scheme || {}),
      ...(updates?.color_scheme || {})
    },
    font_family: {
      ...(current?.font_family || {}),
      ...(updates?.font_family || {})
    },
    spacing: {
      ...(current?.spacing || {}),
      ...(updates?.spacing || {})
    },
    custom_css: updates?.custom_css || current?.custom_css || ''
  };
}

/**
 * Detects fabrication attempts (content modification)
 */
function isFabricationAttempt(request: string): boolean {
  const fabricationPatterns = [
    /add.*experience/i,
    /add.*skill/i,
    /add.*certification/i,
    /add.*education/i,
    /add.*years/i,
    /change.*company/i,
    /modify.*title/i,
    /include.*project/i
  ];

  return fabricationPatterns.some(pattern => pattern.test(request));
}

/**
 * Detects unclear requests that need clarification
 */
function isUnclearRequest(request: string): boolean {
  const unclearPatterns = [
    /make.*better/i,
    /make.*cooler/i,
    /look.*professional/i,
    /improve/i,
    /enhance/i
  ];

  // Short requests are often unclear
  if (request.trim().length < 10) {
    return true;
  }

  return unclearPatterns.some(pattern => pattern.test(request));
}
