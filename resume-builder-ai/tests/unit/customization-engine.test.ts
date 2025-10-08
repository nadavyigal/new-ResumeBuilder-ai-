/**
 * Unit Tests for Customization Engine
 * Feature 003: AI-Powered Resume Design Selection
 * Task: T044
 *
 * Tests AI interpretation logic for design customization:
 * - Mock GPT-4 responses
 * - Color interpretation ("dark blue" → "#1e3a8a")
 * - Font interpretation ("professional font" → "Times New Roman")
 * - Unclear request handling
 * - Fabrication detection
 * - ATS violation handling
 */

import {
  interpretDesignRequest,
  validateAndApply,
  applyCustomization,
  InterpretationResult,
  CustomizationResult
} from '@/lib/design-manager/customization-engine';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// Mock template renderer
jest.mock('@/lib/design-manager/template-renderer', () => ({
  renderTemplatePreview: jest.fn((templateId, resumeData, customization) => {
    return `<html><body>Rendered template: ${templateId}</body></html>`;
  })
}));

// Mock ATS validator
jest.mock('@/lib/design-manager/ats-validator', () => ({
  validateCustomization: jest.fn((config) => {
    // Default to valid unless explicitly marked invalid
    if (config?.color_scheme?.primary === 'INVALID') {
      return {
        isValid: false,
        errors: ['Invalid color format for primary']
      };
    }
    return {
      isValid: true,
      errors: []
    };
  }),
  ATS_SAFE_RULES: {
    allowedFonts: ['Arial', 'Times New Roman', 'Calibri', 'Georgia'],
    blockedCssProperties: ['background-image', 'transform', 'animation']
  }
}));

describe('Customization Engine', () => {
  let mockOpenAIInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup OpenAI mock
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };

    MockedOpenAI.mockImplementation(() => mockOpenAIInstance);
  });

  describe('interpretDesignRequest - Color Interpretation', () => {
    it('should interpret "dark blue" color request', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#1e3a8a',
            secondary: '#3b82f6',
            accent: '#60a5fa',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: {
            heading: 'Arial',
            body: 'Arial'
          },
          spacing: {
            section_gap: '1.5rem',
            line_height: '1.6'
          },
          custom_css: ''
        },
        reasoning: 'Applied dark blue color scheme to primary elements'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('make headers dark blue', {});

      expect(result.understood).toBe(true);
      expect(result.customization?.color_scheme.primary).toBe('#1e3a8a');
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          temperature: 0.2
        })
      );
    });

    it('should interpret "navy" color to hex', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#000080',
            secondary: '#3b82f6',
            accent: '#60a5fa',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Applied navy blue color'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('use navy color', {});

      expect(result.understood).toBe(true);
      expect(result.customization?.color_scheme.primary).toBe('#000080');
    });

    it('should interpret "professional blue-grey" color scheme', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#475569',
            secondary: '#64748b',
            accent: '#94a3b8',
            background: '#ffffff',
            text: '#0f172a'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Applied professional blue-grey color scheme'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('use professional blue-grey colors', {});

      expect(result.understood).toBe(true);
      expect(result.customization?.color_scheme.primary).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should preserve existing colors when not mentioned', async () => {
      const currentConfig = {
        color_scheme: {
          primary: '#ff0000',
          secondary: '#00ff00',
          accent: '#0000ff',
          background: '#ffffff',
          text: '#000000'
        }
      };

      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#1e3a8a', // Only primary changed
            secondary: '#00ff00',
            accent: '#0000ff',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Changed primary color only'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('change primary to dark blue', currentConfig);

      expect(result.understood).toBe(true);
      expect(result.customization?.color_scheme.primary).toBe('#1e3a8a');
      expect(result.customization?.color_scheme.secondary).toBe('#00ff00');
    });
  });

  describe('interpretDesignRequest - Font Interpretation', () => {
    it('should interpret "professional font" as Times New Roman', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#2c3e50',
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: {
            heading: 'Times New Roman',
            body: 'Times New Roman'
          },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Applied professional serif font'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('use a professional font', {});

      expect(result.understood).toBe(true);
      expect(result.customization?.font_family.body).toBe('Times New Roman');
    });

    it('should interpret "modern font" as sans-serif', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#2c3e50',
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: {
            heading: 'Arial',
            body: 'Calibri'
          },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Applied modern sans-serif fonts'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('use modern fonts', {});

      expect(result.understood).toBe(true);
      expect(['Arial', 'Calibri', 'Helvetica']).toContain(result.customization?.font_family.body);
    });

    it('should interpret "serif headings with sans-serif body"', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#2c3e50',
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: {
            heading: 'Georgia',
            body: 'Arial'
          },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Applied serif headings with sans-serif body'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('use serif for headings and sans-serif for body', {});

      expect(result.understood).toBe(true);
      expect(['Georgia', 'Times New Roman']).toContain(result.customization?.font_family.heading);
      expect(['Arial', 'Calibri', 'Helvetica']).toContain(result.customization?.font_family.body);
    });
  });

  describe('interpretDesignRequest - Spacing Interpretation', () => {
    it('should interpret "increase spacing"', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#2c3e50',
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: {
            section_gap: '2rem',
            line_height: '1.8'
          },
          custom_css: ''
        },
        reasoning: 'Increased spacing for better readability'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('increase spacing between sections', {});

      expect(result.understood).toBe(true);
      expect(parseFloat(result.customization?.spacing.section_gap)).toBeGreaterThan(1.5);
    });

    it('should interpret "tighter line spacing"', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#2c3e50',
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: {
            section_gap: '1.5rem',
            line_height: '1.4'
          },
          custom_css: ''
        },
        reasoning: 'Reduced line spacing'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('use tighter line spacing', {});

      expect(result.understood).toBe(true);
      expect(parseFloat(result.customization?.spacing.line_height)).toBeLessThan(1.6);
    });
  });

  describe('interpretDesignRequest - Unclear Request Handling', () => {
    it('should detect "make it better" as unclear', async () => {
      const result = await interpretDesignRequest('make it better', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('unclear_request');
      expect(result.clarificationNeeded).toContain('more specific');
    });

    it('should detect "improve design" as unclear', async () => {
      const result = await interpretDesignRequest('improve design', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('unclear_request');
    });

    it('should detect "make it cooler" as unclear', async () => {
      const result = await interpretDesignRequest('make it cooler', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('unclear_request');
    });

    it('should detect very short requests as unclear', async () => {
      const result = await interpretDesignRequest('better', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('unclear_request');
    });

    it('should accept specific requests even if short', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#ff0000',
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Changed to red color'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('make it red', {});

      expect(result.understood).toBe(true);
    });

    it('should handle GPT-4 unclear response', async () => {
      const mockResponse = {
        understood: false,
        clarificationNeeded: 'Could you specify which color you want to change?'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('change the color', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('unclear_request');
      expect(result.clarificationNeeded).toContain('specify');
    });
  });

  describe('interpretDesignRequest - Fabrication Detection', () => {
    it('should detect "add experience" as fabrication', async () => {
      const result = await interpretDesignRequest('add 5 years of experience', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('fabrication');
      expect(result.clarificationNeeded).toContain('cannot modify resume content');
    });

    it('should detect "add skill" as fabrication', async () => {
      const result = await interpretDesignRequest('add Python to skills', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('fabrication');
    });

    it('should detect "add certification" as fabrication', async () => {
      const result = await interpretDesignRequest('add AWS certification', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('fabrication');
    });

    it('should detect "change company" as fabrication', async () => {
      const result = await interpretDesignRequest('change my company to Google', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('fabrication');
    });

    it('should detect "modify title" as fabrication', async () => {
      const result = await interpretDesignRequest('modify my job title to Senior Engineer', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('fabrication');
    });

    it('should allow "add spacing" (not content fabrication)', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: '#2c3e50',
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: { section_gap: '2rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Added spacing'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('add more spacing', {});

      expect(result.understood).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('interpretDesignRequest - ATS Violation Handling', () => {
    it('should reject customization with ATS violations', async () => {
      const mockResponse = {
        understood: true,
        customization: {
          color_scheme: {
            primary: 'INVALID', // This will trigger mock validation error
            secondary: '#3498db',
            accent: '#e74c3c',
            background: '#ffffff',
            text: '#000000'
          },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Applied custom color'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }]
      });

      const result = await interpretDesignRequest('use custom colors', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('ats_violation');
      expect(result.validationErrors).toBeDefined();
    });
  });

  describe('interpretDesignRequest - Error Handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await interpretDesignRequest('make headers blue', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('invalid_request');
      expect(result.clarificationNeeded).toContain('Unable to process');
    });

    it('should handle empty OpenAI response', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '' } }]
      });

      const result = await interpretDesignRequest('make headers blue', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('invalid_request');
    });

    it('should handle invalid JSON from OpenAI', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'not valid json' } }]
      });

      const result = await interpretDesignRequest('make headers blue', {});

      expect(result.understood).toBe(false);
      expect(result.error).toBe('invalid_request');
    });
  });

  describe('validateAndApply', () => {
    it('should interpret, validate, and generate preview', async () => {
      const mockInterpretation = {
        understood: true,
        customization: {
          color_scheme: { primary: '#1e3a8a', secondary: '#3b82f6', accent: '#60a5fa', background: '#ffffff', text: '#000000' },
          font_family: { heading: 'Arial', body: 'Arial' },
          spacing: { section_gap: '1.5rem', line_height: '1.6' },
          custom_css: ''
        },
        reasoning: 'Applied blue color scheme'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockInterpretation) } }]
      });

      const result = await validateAndApply(
        'make it blue',
        'minimal-ats',
        {},
        { name: 'Test User' }
      ) as CustomizationResult;

      expect(result.customization).toBeDefined();
      expect(result.preview).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.customization.is_ats_safe).toBe(true);
    });

    it('should return interpretation error without generating preview', async () => {
      const result = await validateAndApply(
        'add experience',
        'minimal-ats',
        {},
        {}
      ) as InterpretationResult;

      expect(result.understood).toBe(false);
      expect(result.error).toBe('fabrication');
      expect((result as any).preview).toBeUndefined();
    });

    it('should merge with current config for incremental changes', async () => {
      const currentConfig = {
        color_scheme: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff', background: '#ffffff', text: '#000000' },
        font_family: { heading: 'Georgia', body: 'Georgia' },
        spacing: { section_gap: '2rem', line_height: '1.8' },
        custom_css: ''
      };

      const mockInterpretation = {
        understood: true,
        customization: {
          color_scheme: { primary: '#1e3a8a', secondary: '#00ff00', accent: '#0000ff', background: '#ffffff', text: '#000000' },
          font_family: { heading: 'Georgia', body: 'Georgia' },
          spacing: { section_gap: '2rem', line_height: '1.8' },
          custom_css: ''
        },
        reasoning: 'Changed primary color only'
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockInterpretation) } }]
      });

      const result = await validateAndApply(
        'change primary to blue',
        'minimal-ats',
        currentConfig,
        {}
      ) as CustomizationResult;

      expect(result.customization.color_scheme.primary).toBe('#1e3a8a');
      expect(result.customization.font_family.heading).toBe('Georgia');
    });
  });

  describe('applyCustomization', () => {
    it('should call template renderer with correct parameters', () => {
      const templateId = 'minimal-ats';
      const resumeData = { name: 'Test User' };
      const customization = { color_scheme: { primary: '#1e3a8a' } };

      const result = applyCustomization(templateId, resumeData, customization);

      expect(result).toContain('Rendered template');
      expect(result).toContain(templateId);
    });
  });
});
