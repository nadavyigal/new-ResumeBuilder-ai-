/**
 * Unit Tests for ATS Validator
 * Feature 003: AI-Powered Resume Design Selection
 * Task: T043
 *
 * Tests validation rules for ATS compatibility:
 * - Blocked CSS properties
 * - Allowed CSS properties
 * - Blocked HTML tags
 * - Allowed HTML tags
 * - Color validation and contrast
 * - Font validation
 * - Spacing validation
 */

import {
  validateCustomization,
  ATS_SAFE_RULES,
  ATSValidationResult
} from '@/lib/design-manager/ats-validator';

describe('ATS Validator', () => {
  describe('validateCustomization', () => {
    it('should pass validation for empty customization', () => {
      const result = validateCustomization({});

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for valid ATS-safe customization', () => {
      const customization = {
        color_scheme: {
          primary: '#1e3a8a',
          secondary: '#3b82f6',
          text: '#000000',
          background: '#ffffff'
        },
        font_family: {
          heading: 'Arial',
          body: 'Times New Roman'
        },
        spacing: {
          section_gap: '1.5rem',
          line_height: '1.5'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should aggregate errors from all validation functions', () => {
      const customization = {
        color_scheme: {
          primary: 'invalid-color', // Invalid
          text: '#000000',
          background: '#111111' // Low contrast with text
        },
        font_family: {
          heading: 'Comic Sans MS' // Not ATS-safe
        },
        spacing: {
          line_height: '0.5' // Out of range
        },
        custom_css: 'background-image: url(test.jpg);' // Blocked property
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Color Validation', () => {
    it('should accept valid hex color codes', () => {
      const customization = {
        color_scheme: {
          primary: '#FF5733',
          secondary: '#00ff00',
          text: '#000000'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid hex color format - missing #', () => {
      const customization = {
        color_scheme: {
          primary: 'FF5733'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid color format'))).toBe(true);
    });

    it('should reject invalid hex color format - wrong length', () => {
      const customization = {
        color_scheme: {
          primary: '#FFF'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid color format'))).toBe(true);
    });

    it('should reject invalid hex color format - invalid characters', () => {
      const customization = {
        color_scheme: {
          primary: '#GGGGGG'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid color format'))).toBe(true);
    });

    it('should reject RGB or named colors', () => {
      const customization = {
        color_scheme: {
          primary: 'rgb(255, 87, 51)'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
    });

    it('should detect insufficient contrast between background and text', () => {
      const customization = {
        color_scheme: {
          background: '#ffffff',
          text: '#f0f0f0' // Very light text on white - poor contrast
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Insufficient contrast'))).toBe(true);
    });

    it('should accept sufficient contrast between background and text', () => {
      const customization = {
        color_scheme: {
          background: '#ffffff',
          text: '#000000' // Black on white - excellent contrast
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true);
    });

    it('should handle edge case: same background and text color', () => {
      const customization = {
        color_scheme: {
          background: '#000000',
          text: '#000000'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Insufficient contrast'))).toBe(true);
    });
  });

  describe('Font Validation', () => {
    it('should accept all ATS-safe fonts', () => {
      const atsSafeFonts = ATS_SAFE_RULES.allowedFonts;

      atsSafeFonts.forEach(font => {
        const customization = {
          font_family: {
            heading: font,
            body: font
          }
        };

        const result = validateCustomization(customization);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject non-ATS-safe fonts', () => {
      const unsafeFonts = [
        'Comic Sans MS',
        'Papyrus',
        'Brush Script MT',
        'Impact',
        'Lucida Handwriting'
      ];

      unsafeFonts.forEach(font => {
        const customization = {
          font_family: {
            heading: font
          }
        };

        const result = validateCustomization(customization);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('not ATS-safe'))).toBe(true);
      });
    });

    it('should validate heading and body fonts independently', () => {
      const customization = {
        font_family: {
          heading: 'Arial', // Safe
          body: 'Comic Sans MS' // Unsafe
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('body'))).toBe(true);
      expect(result.errors.some(e => e.includes('heading'))).toBe(false);
    });

    it('should provide helpful error messages with recommended fonts', () => {
      const customization = {
        font_family: {
          heading: 'Custom Font'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Arial');
      expect(result.errors[0]).toContain('Times New Roman');
    });
  });

  describe('Spacing Validation', () => {
    it('should accept valid CSS spacing values', () => {
      const validValues = ['1rem', '1.5rem', '2em', '16px', '10%', '2'];

      validValues.forEach(value => {
        const customization = {
          spacing: {
            section_gap: value
          }
        };

        const result = validateCustomization(customization);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid CSS spacing values', () => {
      const invalidValues = ['auto', 'calc(10px + 5%)', '10 px', 'inherit'];

      invalidValues.forEach(value => {
        const customization = {
          spacing: {
            section_gap: value
          }
        };

        const result = validateCustomization(customization);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Invalid CSS value'))).toBe(true);
      });
    });

    it('should accept valid line-height range (1.0 to 3.0)', () => {
      const validLineHeights = ['1.0', '1.5', '2.0', '2.5', '3.0'];

      validLineHeights.forEach(height => {
        const customization = {
          spacing: {
            line_height: height
          }
        };

        const result = validateCustomization(customization);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject line-height below 1.0', () => {
      const customization = {
        spacing: {
          line_height: '0.8'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('not ATS-safe'))).toBe(true);
    });

    it('should reject line-height above 3.0', () => {
      const customization = {
        spacing: {
          line_height: '4.0'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('not ATS-safe'))).toBe(true);
    });

    it('should reject non-numeric line-height', () => {
      const customization = {
        spacing: {
          line_height: 'normal'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
    });
  });

  describe('Custom CSS Validation', () => {
    it('should reject all blocked CSS properties', () => {
      const blockedProperties = ATS_SAFE_RULES.blockedCssProperties;

      blockedProperties.forEach(prop => {
        const customization = {
          custom_css: `${prop}: value;`
        };

        const result = validateCustomization(customization);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes(prop))).toBe(true);
      });
    });

    it('should detect blocked properties case-insensitively', () => {
      const customization = {
        custom_css: 'BACKGROUND-IMAGE: url(test.jpg); Transform: rotate(45deg);'
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject CSS containing blocked HTML tags', () => {
      const blockedTags = ATS_SAFE_RULES.blockedTags;

      blockedTags.forEach(tag => {
        const customization = {
          custom_css: `content: "<${tag}>test</${tag}>"`
        };

        const result = validateCustomization(customization);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes(tag))).toBe(true);
      });
    });

    it('should accept CSS with only allowed properties', () => {
      const customization = {
        custom_css: `
          color: #000000;
          font-size: 14px;
          margin: 10px;
          padding: 5px;
          line-height: 1.5;
        `
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true);
    });

    it('should handle empty custom CSS', () => {
      const customization = {
        custom_css: ''
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true);
    });
  });

  describe('ATS_SAFE_RULES Constants', () => {
    it('should have comprehensive list of allowed tags', () => {
      expect(ATS_SAFE_RULES.allowedTags).toContain('div');
      expect(ATS_SAFE_RULES.allowedTags).toContain('p');
      expect(ATS_SAFE_RULES.allowedTags).toContain('span');
      expect(ATS_SAFE_RULES.allowedTags).toContain('h1');
      expect(ATS_SAFE_RULES.allowedTags).toContain('ul');
      expect(ATS_SAFE_RULES.allowedTags).toContain('li');
    });

    it('should have comprehensive list of blocked tags', () => {
      expect(ATS_SAFE_RULES.blockedTags).toContain('img');
      expect(ATS_SAFE_RULES.blockedTags).toContain('svg');
      expect(ATS_SAFE_RULES.blockedTags).toContain('canvas');
      expect(ATS_SAFE_RULES.blockedTags).toContain('video');
      expect(ATS_SAFE_RULES.blockedTags).toContain('iframe');
    });

    it('should have comprehensive list of allowed CSS properties', () => {
      expect(ATS_SAFE_RULES.allowedCssProperties).toContain('color');
      expect(ATS_SAFE_RULES.allowedCssProperties).toContain('font-size');
      expect(ATS_SAFE_RULES.allowedCssProperties).toContain('margin');
      expect(ATS_SAFE_RULES.allowedCssProperties).toContain('padding');
    });

    it('should have comprehensive list of blocked CSS properties', () => {
      expect(ATS_SAFE_RULES.blockedCssProperties).toContain('background-image');
      expect(ATS_SAFE_RULES.blockedCssProperties).toContain('transform');
      expect(ATS_SAFE_RULES.blockedCssProperties).toContain('animation');
    });

    it('should have list of standard ATS-safe fonts', () => {
      expect(ATS_SAFE_RULES.allowedFonts).toContain('Arial');
      expect(ATS_SAFE_RULES.allowedFonts).toContain('Times New Roman');
      expect(ATS_SAFE_RULES.allowedFonts).toContain('Calibri');
      expect(ATS_SAFE_RULES.allowedFonts).toContain('Georgia');
    });

    it('should define reasonable max file size', () => {
      expect(ATS_SAFE_RULES.maxFileSize).toBe(200 * 1024);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null customization gracefully', () => {
      const result = validateCustomization(null);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle undefined customization gracefully', () => {
      const result = validateCustomization(undefined);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial customization objects', () => {
      const customization = {
        color_scheme: {
          primary: '#FF5733'
          // Missing other color properties
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true);
    });

    it('should validate all color properties independently', () => {
      const customization = {
        color_scheme: {
          primary: '#FF5733', // Valid
          secondary: 'invalid', // Invalid
          accent: '#00ff00' // Valid
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('secondary');
    });

    it('should handle multiple violations in one customization', () => {
      const customization = {
        color_scheme: {
          primary: 'bad-color-1',
          secondary: 'bad-color-2'
        },
        font_family: {
          heading: 'Bad Font 1',
          body: 'Bad Font 2'
        },
        spacing: {
          line_height: '0.5'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Contrast Calculation Edge Cases', () => {
    it('should handle pure black and white contrast', () => {
      const customization = {
        color_scheme: {
          background: '#000000',
          text: '#ffffff'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true); // Highest possible contrast
    });

    it('should handle near-black and near-white contrast', () => {
      const customization = {
        color_scheme: {
          background: '#111111',
          text: '#eeeeee'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(true);
    });

    it('should reject similar dark colors', () => {
      const customization = {
        color_scheme: {
          background: '#222222',
          text: '#333333'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
    });

    it('should reject similar light colors', () => {
      const customization = {
        color_scheme: {
          background: '#eeeeee',
          text: '#ffffff'
        }
      };

      const result = validateCustomization(customization);

      expect(result.isValid).toBe(false);
    });
  });
});
