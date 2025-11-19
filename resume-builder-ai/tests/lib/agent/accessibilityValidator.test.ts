/**
 * Unit Tests for Accessibility Validator - WCAG Contrast Ratio Validation
 * Phase 4, Task T023
 *
 * Tests WCAG 2.1 color contrast requirements for accessibility compliance
 */

import {
  getRelativeLuminance,
  getContrastRatio,
  validateWCAG,
  type WCAGLevel,
  type TextSize,
} from '../../../src/lib/agent/accessibilityValidator';

describe('getRelativeLuminance - Relative Luminance Calculation', () => {
  describe('Pure Colors', () => {
    it('calculates luminance for pure white (#FFFFFF)', () => {
      // Pure white should have maximum luminance of 1.0
      expect(getRelativeLuminance('#FFFFFF')).toBe(1.0);
      expect(getRelativeLuminance('#ffffff')).toBe(1.0);
    });

    it('calculates luminance for pure black (#000000)', () => {
      // Pure black should have minimum luminance of 0.0
      expect(getRelativeLuminance('#000000')).toBe(0.0);
    });

    it('calculates luminance for pure red (#FF0000)', () => {
      // Red component: 1.0 * 0.2126 = 0.2126
      const luminance = getRelativeLuminance('#FF0000');
      expect(luminance).toBeCloseTo(0.2126, 4);
    });

    it('calculates luminance for pure green (#00FF00)', () => {
      // Green component: 1.0 * 0.7152 = 0.7152
      const luminance = getRelativeLuminance('#00FF00');
      expect(luminance).toBeCloseTo(0.7152, 4);
    });

    it('calculates luminance for pure blue (#0000FF)', () => {
      // Blue component: 1.0 * 0.0722 = 0.0722
      const luminance = getRelativeLuminance('#0000FF');
      expect(luminance).toBeCloseTo(0.0722, 4);
    });
  });

  describe('Grayscale Colors', () => {
    it('calculates luminance for medium gray (#808080)', () => {
      // RGB(128, 128, 128) normalized
      const luminance = getRelativeLuminance('#808080');
      expect(luminance).toBeGreaterThan(0.0);
      expect(luminance).toBeLessThan(1.0);
      expect(luminance).toBeCloseTo(0.2159, 4);
    });

    it('calculates luminance for light gray (#CCCCCC)', () => {
      const luminance = getRelativeLuminance('#CCCCCC');
      expect(luminance).toBeGreaterThan(0.5);
      expect(luminance).toBeCloseTo(0.6038, 4);
    });

    it('calculates luminance for dark gray (#333333)', () => {
      const luminance = getRelativeLuminance('#333333');
      expect(luminance).toBeLessThan(0.1);
      expect(luminance).toBeCloseTo(0.0335, 4);
    });
  });

  describe('Common UI Colors', () => {
    it('calculates luminance for Tailwind blue (#3B82F6)', () => {
      const luminance = getRelativeLuminance('#3B82F6');
      expect(luminance).toBeGreaterThan(0.0);
      expect(luminance).toBeLessThan(1.0);
    });

    it('calculates luminance for navy (#1E3A8A)', () => {
      const luminance = getRelativeLuminance('#1E3A8A');
      expect(luminance).toBeLessThan(0.2); // Dark color
    });

    it('calculates luminance for emerald (#10B981)', () => {
      const luminance = getRelativeLuminance('#10B981');
      expect(luminance).toBeGreaterThan(0.2);
      expect(luminance).toBeLessThan(0.6);
    });
  });

  describe('Case Insensitivity', () => {
    it('handles uppercase hex codes', () => {
      const upper = getRelativeLuminance('#3B82F6');
      const lower = getRelativeLuminance('#3b82f6');
      expect(upper).toBe(lower);
    });

    it('handles mixed case hex codes', () => {
      const mixed = getRelativeLuminance('#3b82F6');
      const lower = getRelativeLuminance('#3b82f6');
      expect(mixed).toBe(lower);
    });
  });

  describe('Invalid Input Handling', () => {
    it('throws error for invalid hex format', () => {
      expect(() => getRelativeLuminance('invalid')).toThrow();
      expect(() => getRelativeLuminance('#GG0000')).toThrow();
      expect(() => getRelativeLuminance('#12345')).toThrow();
    });

    it('throws error for 3-digit hex (not normalized)', () => {
      expect(() => getRelativeLuminance('#FFF')).toThrow();
    });

    it('throws error for missing hash', () => {
      expect(() => getRelativeLuminance('FFFFFF')).toThrow();
    });
  });
});

describe('getContrastRatio - Contrast Ratio Calculation', () => {
  describe('Maximum Contrast', () => {
    it('calculates black on white (21:1)', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBe(21);
    });

    it('calculates white on black (21:1)', () => {
      // Order shouldn't matter - always lighter / darker
      const ratio = getContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBe(21);
    });
  });

  describe('Minimum Contrast', () => {
    it('calculates same color contrast (1:1)', () => {
      expect(getContrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
      expect(getContrastRatio('#000000', '#000000')).toBe(1);
      expect(getContrastRatio('#3B82F6', '#3B82F6')).toBe(1);
    });
  });

  describe('Common Color Combinations', () => {
    it('calculates dark blue text on white background', () => {
      const ratio = getContrastRatio('#1E40AF', '#FFFFFF');
      expect(ratio).toBeGreaterThan(7); // Should pass AAA
    });

    it('calculates light blue on dark background', () => {
      const ratio = getContrastRatio('#BFDBFE', '#1E3A8A');
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('calculates gray text on white background', () => {
      const ratio = getContrastRatio('#6B7280', '#FFFFFF');
      expect(ratio).toBeGreaterThan(4.5);
      expect(ratio).toBeLessThan(7);
    });

    it('calculates emerald text on white background', () => {
      const ratio = getContrastRatio('#10B981', '#FFFFFF');
      expect(ratio).toBeGreaterThan(2); // May not pass AA
    });
  });

  describe('Order Independence', () => {
    it('returns same ratio regardless of parameter order', () => {
      const fg = '#3B82F6';
      const bg = '#FFFFFF';
      const ratio1 = getContrastRatio(fg, bg);
      const ratio2 = getContrastRatio(bg, fg);
      expect(ratio1).toBe(ratio2);
    });

    it('handles dark foreground, light background', () => {
      const ratio1 = getContrastRatio('#000000', '#CCCCCC');
      const ratio2 = getContrastRatio('#CCCCCC', '#000000');
      expect(ratio1).toBe(ratio2);
    });
  });

  describe('Precision', () => {
    it('rounds to 2 decimal places', () => {
      const ratio = getContrastRatio('#3B82F6', '#FFFFFF');
      const decimals = ratio.toString().split('.')[1];
      expect(decimals?.length || 0).toBeLessThanOrEqual(2);
    });

    it('returns whole numbers when applicable', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(Number.isInteger(ratio)).toBe(true);
    });
  });
});

describe('validateWCAG - WCAG Compliance Validation', () => {
  describe('WCAG AA - Normal Text (4.5:1 minimum)', () => {
    it('passes for black on white', () => {
      const result = validateWCAG('#000000', '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBe(21);
      expect(result.level).toBe('AA');
      expect(result.textSize).toBe('normal');
    });

    it('passes for dark blue on white', () => {
      const result = validateWCAG('#1E40AF', '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThan(4.5);
    });

    it('fails for light blue on white', () => {
      const result = validateWCAG('#BFDBFE', '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(false);
      expect(result.ratio).toBeLessThan(4.5);
    });

    it('passes for gray (#6B7280) on white', () => {
      const result = validateWCAG('#6B7280', '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThan(4.5);
    });

    it('fails for light gray (#D1D5DB) on white', () => {
      const result = validateWCAG('#D1D5DB', '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(false);
      expect(result.ratio).toBeLessThan(4.5);
    });
  });

  describe('WCAG AA - Large Text (3:1 minimum)', () => {
    it('passes for medium gray on white', () => {
      // Colors that fail AA normal may pass AA large
      const result = validateWCAG('#999999', '#FFFFFF', 'AA', 'large');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThan(3);
    });

    it('passes for Tailwind blue on white', () => {
      const result = validateWCAG('#3B82F6', '#FFFFFF', 'AA', 'large');
      expect(result.passes).toBe(true);
    });

    it('fails for very light colors', () => {
      const result = validateWCAG('#F3F4F6', '#FFFFFF', 'AA', 'large');
      expect(result.passes).toBe(false);
      expect(result.ratio).toBeLessThan(3);
    });
  });

  describe('WCAG AAA - Normal Text (7:1 minimum)', () => {
    it('passes for black on white', () => {
      const result = validateWCAG('#000000', '#FFFFFF', 'AAA', 'normal');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBe(21);
    });

    it('passes for very dark blue on white', () => {
      const result = validateWCAG('#1E3A8A', '#FFFFFF', 'AAA', 'normal');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThan(7);
    });

    it('fails for medium blue on white', () => {
      const result = validateWCAG('#3B82F6', '#FFFFFF', 'AAA', 'normal');
      expect(result.passes).toBe(false);
      expect(result.ratio).toBeLessThan(7);
    });

    it('fails for dark gray (#374151) on white', () => {
      const result = validateWCAG('#374151', '#FFFFFF', 'AAA', 'normal');
      expect(result.passes).toBe(false);
      expect(result.ratio).toBeLessThan(7);
    });
  });

  describe('WCAG AAA - Large Text (4.5:1 minimum)', () => {
    it('passes for dark blue on white', () => {
      const result = validateWCAG('#1E40AF', '#FFFFFF', 'AAA', 'large');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThan(4.5);
    });

    it('passes for gray (#6B7280) on white', () => {
      const result = validateWCAG('#6B7280', '#FFFFFF', 'AAA', 'large');
      expect(result.passes).toBe(true);
    });

    it('fails for light blue on white', () => {
      const result = validateWCAG('#BFDBFE', '#FFFFFF', 'AAA', 'large');
      expect(result.passes).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('validates resume header on white background', () => {
      // Dark blue header should pass AA normal
      const result = validateWCAG('#1E40AF', '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(true);
    });

    it('validates body text on light gray background', () => {
      // Black text on light gray should pass AAA
      const result = validateWCAG('#000000', '#F3F4F6', 'AAA', 'normal');
      expect(result.passes).toBe(true);
    });

    it('validates link color on white background', () => {
      // Blue links should pass at least AA for large text
      const result = validateWCAG('#3B82F6', '#FFFFFF', 'AA', 'large');
      expect(result.passes).toBe(true);
    });

    it('rejects insufficient contrast for normal text', () => {
      // Light gray on white fails AA
      const result = validateWCAG('#D1D5DB', '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(false);
      expect(result.ratio).toBeLessThan(4.5);
    });
  });

  describe('Return Value Structure', () => {
    it('returns all required fields', () => {
      const result = validateWCAG('#000000', '#FFFFFF', 'AA', 'normal');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('ratio');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('textSize');
      expect(typeof result.passes).toBe('boolean');
      expect(typeof result.ratio).toBe('number');
      expect(typeof result.level).toBe('string');
      expect(typeof result.textSize).toBe('string');
    });

    it('includes correct metadata in result', () => {
      const result = validateWCAG('#3B82F6', '#FFFFFF', 'AAA', 'large');
      expect(result.level).toBe('AAA');
      expect(result.textSize).toBe('large');
    });
  });

  describe('Edge Cases', () => {
    it('handles identical foreground and background', () => {
      const result = validateWCAG('#3B82F6', '#3B82F6', 'AA', 'normal');
      expect(result.passes).toBe(false);
      expect(result.ratio).toBe(1);
    });

    it('handles case insensitivity', () => {
      const result1 = validateWCAG('#3B82F6', '#FFFFFF', 'AA', 'normal');
      const result2 = validateWCAG('#3b82f6', '#ffffff', 'AA', 'normal');
      expect(result1.passes).toBe(result2.passes);
      expect(result1.ratio).toBe(result2.ratio);
    });

    it('validates at exact threshold values', () => {
      // Find a color that's exactly 4.5:1 with white (if possible)
      // For testing, verify threshold behavior
      const darkGray = '#767676'; // Approximately 4.54:1 with white
      const result = validateWCAG(darkGray, '#FFFFFF', 'AA', 'normal');
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('WCAG Compliance - Comprehensive Color Combinations', () => {
  describe('Common Resume Color Schemes', () => {
    const testCases: Array<{
      name: string;
      foreground: string;
      background: string;
      expectedAA: boolean;
      expectedAAA: boolean;
    }> = [
      {
        name: 'Black on white',
        foreground: '#000000',
        background: '#FFFFFF',
        expectedAA: true,
        expectedAAA: true,
      },
      {
        name: 'Navy header on white',
        foreground: '#1E3A8A',
        background: '#FFFFFF',
        expectedAA: true,
        expectedAAA: true,
      },
      {
        name: 'Dark gray text on white',
        foreground: '#374151',
        background: '#FFFFFF',
        expectedAA: true,
        expectedAAA: false,
      },
      {
        name: 'Gray text on white',
        foreground: '#6B7280',
        background: '#FFFFFF',
        expectedAA: true,
        expectedAAA: false,
      },
      {
        name: 'Light gray on white (insufficient)',
        foreground: '#D1D5DB',
        background: '#FFFFFF',
        expectedAA: false,
        expectedAAA: false,
      },
      {
        name: 'Blue accent on white',
        foreground: '#3B82F6',
        background: '#FFFFFF',
        expectedAA: false,
        expectedAAA: false,
      },
      {
        name: 'Dark blue on light blue background',
        foreground: '#1E40AF',
        background: '#BFDBFE',
        expectedAA: true,
        expectedAAA: false,
      },
    ];

    testCases.forEach(({ name, foreground, background, expectedAA, expectedAAA }) => {
      it(`validates ${name}`, () => {
        const aaResult = validateWCAG(foreground, background, 'AA', 'normal');
        const aaaResult = validateWCAG(foreground, background, 'AAA', 'normal');

        expect(aaResult.passes).toBe(expectedAA);
        expect(aaaResult.passes).toBe(expectedAAA);

        // AAA passing implies AA passing
        if (aaaResult.passes) {
          expect(aaResult.passes).toBe(true);
        }
      });
    });
  });

  describe('Minimum Contrast Ratios', () => {
    it('AA normal text requires 4.5:1', () => {
      // Test a color that's just above threshold
      const passingColor = '#767676'; // ~4.54:1
      const failingColor = '#8C8C8C'; // ~3.5:1

      expect(validateWCAG(passingColor, '#FFFFFF', 'AA', 'normal').passes).toBe(true);
      expect(validateWCAG(failingColor, '#FFFFFF', 'AA', 'normal').passes).toBe(false);
    });

    it('AA large text requires 3:1', () => {
      const passingColor = '#949494'; // ~3.1:1
      const failingColor = '#B8B8B8'; // ~2.5:1

      expect(validateWCAG(passingColor, '#FFFFFF', 'AA', 'large').passes).toBe(true);
      expect(validateWCAG(failingColor, '#FFFFFF', 'AA', 'large').passes).toBe(false);
    });

    it('AAA normal text requires 7:1', () => {
      const passingColor = '#595959'; // ~7.0:1
      const failingColor = '#6B7280'; // ~4.8:1

      expect(validateWCAG(passingColor, '#FFFFFF', 'AAA', 'normal').passes).toBe(true);
      expect(validateWCAG(failingColor, '#FFFFFF', 'AAA', 'normal').passes).toBe(false);
    });

    it('AAA large text requires 4.5:1', () => {
      const passingColor = '#767676'; // ~4.54:1
      const failingColor = '#8C8C8C'; // ~3.5:1

      expect(validateWCAG(passingColor, '#FFFFFF', 'AAA', 'large').passes).toBe(true);
      expect(validateWCAG(failingColor, '#FFFFFF', 'AAA', 'large').passes).toBe(false);
    });
  });
});
