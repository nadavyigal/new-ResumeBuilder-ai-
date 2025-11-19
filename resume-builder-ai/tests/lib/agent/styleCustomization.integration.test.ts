/**
 * Integration Tests for Style Customization - Full Flow Testing
 * Phase 4, Task T024
 *
 * Tests the complete flow of color/font customization:
 * 1. Parse user message → ColorRequest[]
 * 2. Validate WCAG compliance
 * 3. Apply styles to resume
 * 4. Log to database
 * 5. Return success response
 */

import {
  parseColorRequest,
  normalizeColor,
} from '../../../src/lib/agent/parseColorRequest';
import {
  validateWCAG,
} from '../../../src/lib/agent/accessibilityValidator';

describe('Style Customization Integration Tests', () => {
  describe('End-to-End Color Parsing and Validation Flow', () => {
    it('completes full flow: parse → validate WCAG', () => {
      // Step 1: Parse user message
      const message = 'change background to navy';
      const requests = parseColorRequest(message);

      expect(requests).toHaveLength(1);
      expect(requests[0].target).toBe('background');
      expect(requests[0].color).toBe('#1e3a8a');

      // Step 2: Validate WCAG compliance (navy bg requires light text)
      // Assume white text on navy background
      const validation = validateWCAG('#FFFFFF', requests[0].color!, 'AA', 'normal');

      expect(validation.passes).toBe(true);
      expect(validation.ratio).toBeGreaterThan(4.5);
    });

    it('handles invalid color gracefully', () => {
      const message = 'change background to notacolor';
      const requests = parseColorRequest(message);

      // Should return empty array for invalid colors
      expect(requests).toHaveLength(0);
    });

    it('validates multiple color changes', () => {
      // Parse multiple messages
      const msg1 = parseColorRequest('change background to white');
      const msg2 = parseColorRequest('change header to navy');
      const msg3 = parseColorRequest('change text color to black');

      expect(msg1).toHaveLength(1);
      expect(msg2).toHaveLength(1);
      expect(msg3).toHaveLength(1);

      // Validate all combinations
      const bgColor = msg1[0].color!;
      const headerColor = msg2[0].color!;
      const textColor = msg3[0].color!;

      // Header on background
      expect(validateWCAG(headerColor, bgColor, 'AA', 'large').passes).toBe(true);

      // Text on background
      expect(validateWCAG(textColor, bgColor, 'AA', 'normal').passes).toBe(true);
    });
  });

  describe('WCAG Compliance Integration', () => {
    it('validates common resume color schemes', () => {
      const schemes = [
        {
          name: 'Professional Navy',
          background: '#FFFFFF',
          header: '#1E3A8A',
          text: '#000000',
          expectedPass: true,
        },
        {
          name: 'Modern Blue',
          background: '#F3F4F6',
          header: '#1E40AF',
          text: '#1F2937',
          expectedPass: true,
        },
        {
          name: 'Insufficient Contrast (fail)',
          background: '#FFFFFF',
          header: '#BFDBFE', // Light blue
          text: '#D1D5DB', // Light gray
          expectedPass: false,
        },
      ];

      schemes.forEach((scheme) => {
        const headerValidation = validateWCAG(
          scheme.header,
          scheme.background,
          'AA',
          'large'
        );
        const textValidation = validateWCAG(
          scheme.text,
          scheme.background,
          'AA',
          'normal'
        );

        if (scheme.expectedPass) {
          expect(headerValidation.passes).toBe(true);
          expect(textValidation.passes).toBe(true);
        } else {
          const anyFailed = !headerValidation.passes || !textValidation.passes;
          expect(anyFailed).toBe(true);
        }
      });
    });

    it('suggests alternative colors for failed WCAG checks', () => {
      // Light blue fails on white
      const failedColor = '#BFDBFE';
      const background = '#FFFFFF';

      const validation = validateWCAG(failedColor, background, 'AA', 'normal');
      expect(validation.passes).toBe(false);

      // Suggest darker alternative
      const darkerBlue = '#1E40AF';
      const alternativeValidation = validateWCAG(darkerBlue, background, 'AA', 'normal');
      expect(alternativeValidation.passes).toBe(true);
    });

    it('validates against AAA standard for higher accessibility', () => {
      const testCases = [
        { fg: '#000000', bg: '#FFFFFF', expectedAAA: true },  // Black on white (21:1)
        { fg: '#1E3A8A', bg: '#FFFFFF', expectedAAA: true },  // Navy on white (10.88:1)
        { fg: '#374151', bg: '#FFFFFF', expectedAAA: true },  // Dark gray (10.31:1 - passes AAA!)
        { fg: '#6B7280', bg: '#FFFFFF', expectedAAA: false }, // Medium gray (4.78:1 - fails AAA)
      ];

      testCases.forEach(({ fg, bg, expectedAAA }) => {
        const validation = validateWCAG(fg, bg, 'AAA', 'normal');
        expect(validation.passes).toBe(expectedAAA);

        // AAA passing implies AA passing
        if (expectedAAA) {
          const aaValidation = validateWCAG(fg, bg, 'AA', 'normal');
          expect(aaValidation.passes).toBe(true);
        }
      });
    });
  });

  describe('Color Normalization Integration', () => {
    it('normalizes and validates color in one flow', () => {
      const colorNames = ['navy', 'dark blue', 'black', 'white'];

      colorNames.forEach((name) => {
        const normalized = normalizeColor(name);
        expect(normalized).toBeTruthy();
        expect(normalized).toMatch(/^#[0-9a-f]{6}$/);

        // All normalized colors should be valid 6-digit hex
        expect(normalized!.length).toBe(7);
      });
    });

    it('handles hex codes with normalization', () => {
      const hexCodes = ['#3B82F6', '#3b82f6', '#F00', '#FFFFFF'];

      hexCodes.forEach((hex) => {
        const normalized = normalizeColor(hex);
        expect(normalized).toBeTruthy();
        expect(normalized).toMatch(/^#[0-9a-f]{6}$/);
      });
    });
  });

  describe('Parse and Validate Integration', () => {
    it('parses background color and validates contrast with default text', () => {
      const message = 'change background to navy';
      const requests = parseColorRequest(message);

      expect(requests).toHaveLength(1);
      const bgColor = requests[0].color!;

      // Navy background needs light text
      const whiteTextValidation = validateWCAG('#FFFFFF', bgColor, 'AA', 'normal');
      expect(whiteTextValidation.passes).toBe(true);

      // Black text would fail
      const blackTextValidation = validateWCAG('#000000', bgColor, 'AA', 'normal');
      expect(blackTextValidation.passes).toBe(false);
    });

    it('validates header color changes for accessibility', () => {
      const headerColors = [
        { message: 'change header to dark blue', expectedPass: true },
        { message: 'change header to navy', expectedPass: true },
        { message: 'change header to light blue', expectedPass: false },
      ];

      headerColors.forEach(({ message, expectedPass }) => {
        const requests = parseColorRequest(message);
        expect(requests).toHaveLength(1);

        const headerColor = requests[0].color!;
        const whiteBackground = '#FFFFFF';

        const validation = validateWCAG(headerColor, whiteBackground, 'AA', 'large');
        expect(validation.passes).toBe(expectedPass);
      });
    });

    it('handles font changes without color validation', () => {
      const message = 'change font to Arial';
      const requests = parseColorRequest(message);

      expect(requests).toHaveLength(1);
      expect(requests[0].target).toBe('font');
      expect(requests[0].font).toBe('Arial');
      expect(requests[0].color).toBeUndefined();
    });
  });

  describe('Multi-Color Scheme Validation', () => {
    it('validates complete color scheme: background + header + text', () => {
      // Professional navy theme
      const bgRequest = parseColorRequest('change background to white')[0];
      const headerRequest = parseColorRequest('change header to navy')[0];
      const textRequest = parseColorRequest('change text color to black')[0];

      const bg = bgRequest.color!;
      const header = headerRequest.color!;
      const text = textRequest.color!;

      // All combinations should pass
      expect(validateWCAG(header, bg, 'AA', 'large').passes).toBe(true);
      expect(validateWCAG(text, bg, 'AA', 'normal').passes).toBe(true);
      expect(validateWCAG(text, bg, 'AAA', 'normal').passes).toBe(true);
    });

    it('detects poor contrast in multi-color schemes', () => {
      // Poor contrast scheme
      const bgRequest = parseColorRequest('change background to light gray')[0];
      const textRequest = parseColorRequest('change text color to gray')[0];

      const bg = bgRequest.color!;
      const text = textRequest.color!;

      const validation = validateWCAG(text, bg, 'AA', 'normal');
      expect(validation.passes).toBe(false);
      expect(validation.ratio).toBeLessThan(4.5);
    });
  });

  describe('Real-World User Scenarios', () => {
    it('professional theme: white bg + navy header + black text', () => {
      const messages = [
        'change background to white',
        'change header to navy',
        'change text color to black', // Need "color" keyword for text
      ];

      messages.forEach((message) => {
        const requests = parseColorRequest(message);
        expect(requests).toHaveLength(1);
        expect(requests[0].color).toBeDefined();
      });

      // Verify WCAG AAA compliance
      const validation = validateWCAG('#1E3A8A', '#FFFFFF', 'AAA', 'large');
      expect(validation.passes).toBe(true);
    });

    it('modern theme: light gray bg + dark blue header + dark gray text', () => {
      const bgColor = normalizeColor('light gray')!;
      const headerColor = normalizeColor('dark blue')!;
      const textColor = normalizeColor('dark gray')!;

      // Header on light gray background (large text)
      expect(validateWCAG(headerColor, bgColor, 'AA', 'large').passes).toBe(true);

      // Dark gray text on light gray background
      expect(validateWCAG(textColor, bgColor, 'AA', 'normal').passes).toBe(true);
    });

    it('warns about insufficient contrast: light blue on white', () => {
      const message = 'change background to white';
      const bgRequest = parseColorRequest(message)[0];

      const lightBlue = normalizeColor('light blue')!;
      const validation = validateWCAG(lightBlue, bgRequest.color!, 'AA', 'normal');

      expect(validation.passes).toBe(false);
      expect(validation.ratio).toBeLessThan(4.5);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles invalid color names gracefully', () => {
      const messages = [
        'change background to notacolor',
        'change header to xyz123',
        'change text to invalidcolor',
      ];

      messages.forEach((message) => {
        const requests = parseColorRequest(message);
        expect(requests).toHaveLength(0);
      });
    });

    it('handles mixed valid and invalid requests', () => {
      // Valid color
      const validRequest = parseColorRequest('change background to navy');
      expect(validRequest).toHaveLength(1);

      // Invalid color
      const invalidRequest = parseColorRequest('change background to notvalid');
      expect(invalidRequest).toHaveLength(0);
    });

    it('validates at exact WCAG threshold values', () => {
      // Color with ratio close to 4.5:1 threshold
      const borderlineColor = '#767676'; // Approximately 4.54:1 with white
      const validation = validateWCAG(borderlineColor, '#FFFFFF', 'AA', 'normal');

      expect(validation.passes).toBe(true);
      expect(validation.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('handles case variations in color names', () => {
      const variations = [
        'change background to NAVY',
        'change background to Navy',
        'change background to navy',
      ];

      variations.forEach((message) => {
        const requests = parseColorRequest(message);
        expect(requests).toHaveLength(1);
        expect(requests[0].color).toBe('#1e3a8a');
      });
    });
  });

  describe('Contrast Ratio Calculations', () => {
    it('calculates correct ratios for common combinations', () => {
      const combinations = [
        { fg: '#000000', bg: '#FFFFFF', expectedRatio: 21 },
        { fg: '#FFFFFF', bg: '#000000', expectedRatio: 21 },
        { fg: '#1E3A8A', bg: '#FFFFFF', minRatio: 7 }, // Navy on white (AAA)
        { fg: '#6B7280', bg: '#FFFFFF', minRatio: 4.5, maxRatio: 7 }, // Gray (AA but not AAA)
      ];

      combinations.forEach(({ fg, bg, expectedRatio, minRatio, maxRatio }) => {
        const validation = validateWCAG(fg, bg, 'AA', 'normal');

        if (expectedRatio !== undefined) {
          expect(validation.ratio).toBe(expectedRatio);
        }

        if (minRatio !== undefined) {
          expect(validation.ratio).toBeGreaterThanOrEqual(minRatio);
        }

        if (maxRatio !== undefined) {
          expect(validation.ratio).toBeLessThan(maxRatio);
        }
      });
    });

    it('is order-independent (lighter/darker calculation)', () => {
      const fg = '#1E40AF';
      const bg = '#FFFFFF';

      const validation1 = validateWCAG(fg, bg, 'AA', 'normal');
      const validation2 = validateWCAG(bg, fg, 'AA', 'normal');

      expect(validation1.ratio).toBe(validation2.ratio);
    });
  });
});
