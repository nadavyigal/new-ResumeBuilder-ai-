/**
 * OpenAI Assistant Function Definitions
 *
 * Defines function schemas for the assistant to call when making
 * design or content changes to resumes.
 */

export interface UpdateDesignParams {
  color_scheme?: {
    background?: string;
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  font_family?: {
    heading?: string;
    body?: string;
  };
  layout?: 'one-column' | 'two-column';
  spacing?: {
    section_gap?: string;
    line_height?: string;
  };
  custom_css?: string;
  reasoning?: string;
}

export interface UpdateContentParams {
  section: 'skills' | 'experience' | 'education' | 'summary' | 'certifications' | 'projects';
  operation: 'add' | 'modify' | 'remove';
  value: string;
  target_index?: number; // For arrays like experience, education
  reasoning?: string;
}

export interface ClarifyRequestParams {
  question: string;
  suggestions: string[];
  context?: string;
}

/**
 * Function definitions for OpenAI Assistants API
 */
export const ASSISTANT_FUNCTIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'update_design',
      description: 'Update the visual design and styling of the resume. Use this when the user wants to change colors, fonts, layout, spacing, or other visual elements. Handles typos gracefully (e.g., "backround" → "background").',
      parameters: {
        type: 'object',
        properties: {
          color_scheme: {
            type: 'object',
            description: 'Color scheme changes for the resume',
            properties: {
              background: {
                type: 'string',
                description: 'Background color (hex, rgb, or named color like "light blue", "navy blue"). Handles multi-word colors.'
              },
              primary: {
                type: 'string',
                description: 'Primary accent color for headers and important elements'
              },
              secondary: {
                type: 'string',
                description: 'Secondary color for subheadings and accents'
              },
              accent: {
                type: 'string',
                description: 'Accent color for highlights'
              },
              text: {
                type: 'string',
                description: 'Main text color'
              }
            }
          },
          font_family: {
            type: 'object',
            description: 'Font family changes',
            properties: {
              heading: {
                type: 'string',
                description: 'Font for headers (e.g., "Arial", "Georgia", "Inter")'
              },
              body: {
                type: 'string',
                description: 'Font for body text'
              }
            }
          },
          layout: {
            type: 'string',
            enum: ['one-column', 'two-column'],
            description: 'Resume layout structure'
          },
          spacing: {
            type: 'object',
            description: 'Spacing and padding adjustments',
            properties: {
              section_gap: {
                type: 'string',
                description: 'Gap between sections (e.g., "2rem", "24px")'
              },
              line_height: {
                type: 'string',
                description: 'Line height for text (e.g., "1.5", "1.6")'
              }
            }
          },
          custom_css: {
            type: 'string',
            description: 'Additional custom CSS rules for advanced styling'
          },
          reasoning: {
            type: 'string',
            description: 'Explanation of why these design changes were made'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_content',
      description: 'Add, modify, or remove content from the resume. Use this when the user wants to change text content like skills, experience, education, or summary. Never fabricate information - only work with existing content or user-provided additions.',
      parameters: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['skills', 'experience', 'education', 'summary', 'certifications', 'projects'],
            description: 'Which section of the resume to modify'
          },
          operation: {
            type: 'string',
            enum: ['add', 'modify', 'remove'],
            description: 'What operation to perform on the content'
          },
          value: {
            type: 'string',
            description: 'The content to add/modify/remove. For skills, comma-separated list. For experience, JSON string with job details.'
          },
          target_index: {
            type: 'number',
            description: 'For array sections (experience, education), which item to modify (0-indexed). Omit to add to end or modify most recent.'
          },
          reasoning: {
            type: 'string',
            description: 'Explanation of why this content change was made'
          }
        },
        required: ['section', 'operation', 'value']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'clarify_request',
      description: 'Ask the user for clarification when their request is ambiguous or needs more information. Use this when you cannot determine intent or need additional details.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The clarifying question to ask the user'
          },
          suggestions: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Suggested options or examples for the user to choose from'
          },
          context: {
            type: 'string',
            description: 'Additional context about why clarification is needed'
          }
        },
        required: ['question', 'suggestions']
      }
    }
  }
];

/**
 * Type guard for function parameters
 */
export function isUpdateDesignParams(params: any): params is UpdateDesignParams {
  return params && typeof params === 'object';
}

export function isUpdateContentParams(params: any): params is UpdateContentParams {
  return params && typeof params === 'object' &&
         typeof params.section === 'string' &&
         typeof params.operation === 'string' &&
         typeof params.value === 'string';
}

export function isClarifyRequestParams(params: any): params is ClarifyRequestParams {
  return params && typeof params === 'object' &&
         typeof params.question === 'string' &&
         Array.isArray(params.suggestions);
}
