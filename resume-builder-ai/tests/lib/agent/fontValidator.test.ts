/**
 * Unit Tests for Font Validator - Professional Resume Fonts
 * Phase 4, Task T027
 *
 * Tests font validation, normalization, and metadata retrieval
 */

import {
  validateFont,
  normalizeFont,
  isATSSafe,
  isProfessional,
  getFontFamilyCSS,
  getAvailableFonts,
  getFontCategory,
} from '../../../src/lib/agent/fontValidator';

describe('Font Validator - Professional Resume Fonts', () => {
  describe('validateFont - Font Validation', () => {
    it('validates common serif fonts', () => {
      const fonts = ['Times New Roman', 'Georgia', 'Garamond'];
      fonts.forEach(font => {
        const mapping = validateFont(font);
        expect(mapping).toBeTruthy();
        expect(mapping?.category).toBe('serif');
      });
    });

    it('validates common sans-serif fonts', () => {
      const fonts = ['Arial', 'Helvetica', 'Calibri', 'Verdana'];
      fonts.forEach(font => {
        const mapping = validateFont(font);
        expect(mapping).toBeTruthy();
        expect(mapping?.category).toBe('sans-serif');
      });
    });

    it('validates modern web fonts', () => {
      const fonts = ['Roboto', 'Lato', 'Open Sans', 'Montserrat', 'Poppins'];
      fonts.forEach(font => {
        const mapping = validateFont(font);
        expect(mapping).toBeTruthy();
        expect(mapping?.professional).toBe(true);
      });
    });

    it('handles case insensitivity', () => {
      const variations = ['ARIAL', 'Arial', 'arial', 'ArIaL'];
      variations.forEach(variant => {
        const mapping = validateFont(variant);
        expect(mapping).toBeTruthy();
        expect(mapping?.name).toBe('Arial');
      });
    });

    it('handles font aliases', () => {
      expect(validateFont('times')?.name).toBe('Times New Roman');
      expect(validateFont('tnr')?.name).toBe('Times New Roman');
      expect(validateFont('courier')?.name).toBe('Courier New');
      expect(validateFont('helvetica neue')?.name).toBe('Helvetica');
    });

    it('returns null for invalid fonts', () => {
      expect(validateFont('Comic Sans')).toBeNull();
      expect(validateFont('Papyrus')).toBeNull();
      expect(validateFont('InvalidFont')).toBeNull();
    });

    it('handles extra whitespace', () => {
      expect(validateFont('  Arial  ')?.name).toBe('Arial');
      expect(validateFont('  Times New Roman  ')?.name).toBe('Times New Roman');
    });
  });

  describe('normalizeFont - Font Name Normalization', () => {
    it('normalizes to proper capitalization', () => {
      expect(normalizeFont('arial')).toBe('Arial');
      expect(normalizeFont('GEORGIA')).toBe('Georgia');
      expect(normalizeFont('times new roman')).toBe('Times New Roman');
    });

    it('handles aliases correctly', () => {
      expect(normalizeFont('times')).toBe('Times New Roman');
      expect(normalizeFont('courier')).toBe('Courier New');
      expect(normalizeFont('opensans')).toBe('Open Sans');
    });

    it('returns null for invalid fonts', () => {
      expect(normalizeFont('Comic Sans')).toBeNull();
      expect(normalizeFont('Invalid Font')).toBeNull();
    });

    it('preserves proper spacing', () => {
      expect(normalizeFont('open sans')).toBe('Open Sans');
      expect(normalizeFont('trebuchet ms')).toBe('Trebuchet MS');
      expect(normalizeFont('eb garamond')).toBe('EB Garamond');
    });
  });

  describe('isATSSafe - ATS Compatibility Check', () => {
    it('confirms all professional fonts are ATS-safe', () => {
      const fonts = ['Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Roboto'];
      fonts.forEach(font => {
        expect(isATSSafe(font)).toBe(true);
      });
    });

    it('returns false for invalid fonts', () => {
      expect(isATSSafe('InvalidFont')).toBe(false);
      expect(isATSSafe('Comic Sans')).toBe(false);
    });

    it('returns true for monospace fonts (even if not professional)', () => {
      expect(isATSSafe('Courier New')).toBe(true);
      expect(isATSSafe('Consolas')).toBe(true);
    });
  });

  describe('isProfessional - Professional Resume Suitability', () => {
    it('confirms serif fonts are professional', () => {
      expect(isProfessional('Times New Roman')).toBe(true);
      expect(isProfessional('Georgia')).toBe(true);
      expect(isProfessional('Garamond')).toBe(true);
    });

    it('confirms sans-serif fonts are professional', () => {
      expect(isProfessional('Arial')).toBe(true);
      expect(isProfessional('Calibri')).toBe(true);
      expect(isProfessional('Helvetica')).toBe(true);
    });

    it('flags monospace fonts as not professional', () => {
      expect(isProfessional('Courier New')).toBe(false);
      expect(isProfessional('Consolas')).toBe(false);
    });

    it('returns false for invalid fonts', () => {
      expect(isProfessional('InvalidFont')).toBe(false);
    });
  });

  describe('getFontFamilyCSS - CSS Font Stack Generation', () => {
    it('generates CSS with fallbacks for serif fonts', () => {
      const css = getFontFamilyCSS('Times New Roman');
      expect(css).toContain('Times New Roman');
      expect(css).toContain('Georgia');
      expect(css).toContain('serif');
    });

    it('generates CSS with fallbacks for sans-serif fonts', () => {
      const css = getFontFamilyCSS('Arial');
      expect(css).toContain('Arial');
      expect(css).toContain('Helvetica');
      expect(css).toContain('sans-serif');
    });

    it('quotes font names with spaces', () => {
      const css = getFontFamilyCSS('Times New Roman');
      expect(css).toMatch(/"Times New Roman"/);
    });

    it('does not quote single-word fonts', () => {
      const css = getFontFamilyCSS('Arial');
      expect(css).not.toMatch(/"Arial"/);
      expect(css).toMatch(/^Arial,/);
    });

    it('provides safe default for invalid fonts', () => {
      const css = getFontFamilyCSS('InvalidFont');
      expect(css).toBe('Arial, sans-serif');
    });

    it('generates complete font stack', () => {
      const css = getFontFamilyCSS('Roboto');
      expect(css).toContain('Roboto');
      expect(css).toContain('Arial');
      expect(css).toContain('sans-serif');
    });
  });

  describe('getAvailableFonts - List Professional Fonts', () => {
    it('returns array of professional font names', () => {
      const fonts = getAvailableFonts();
      expect(Array.isArray(fonts)).toBe(true);
      expect(fonts.length).toBeGreaterThan(10);
    });

    it('excludes non-professional fonts', () => {
      const fonts = getAvailableFonts();
      expect(fonts).not.toContain('Courier New');
      expect(fonts).not.toContain('Consolas');
    });

    it('includes all serif professional fonts', () => {
      const fonts = getAvailableFonts();
      expect(fonts).toContain('Times New Roman');
      expect(fonts).toContain('Georgia');
      expect(fonts).toContain('Garamond');
    });

    it('includes all sans-serif professional fonts', () => {
      const fonts = getAvailableFonts();
      expect(fonts).toContain('Arial');
      expect(fonts).toContain('Calibri');
      expect(fonts).toContain('Roboto');
      expect(fonts).toContain('Lato');
    });

    it('returns sorted array', () => {
      const fonts = getAvailableFonts();
      const sorted = [...fonts].sort();
      expect(fonts).toEqual(sorted);
    });
  });

  describe('getFontCategory - Font Category Retrieval', () => {
    it('returns "serif" for serif fonts', () => {
      expect(getFontCategory('Times New Roman')).toBe('serif');
      expect(getFontCategory('Georgia')).toBe('serif');
      expect(getFontCategory('Garamond')).toBe('serif');
    });

    it('returns "sans-serif" for sans-serif fonts', () => {
      expect(getFontCategory('Arial')).toBe('sans-serif');
      expect(getFontCategory('Calibri')).toBe('sans-serif');
      expect(getFontCategory('Roboto')).toBe('sans-serif');
    });

    it('returns "monospace" for monospace fonts', () => {
      expect(getFontCategory('Courier New')).toBe('monospace');
      expect(getFontCategory('Consolas')).toBe('monospace');
    });

    it('returns null for invalid fonts', () => {
      expect(getFontCategory('InvalidFont')).toBeNull();
      expect(getFontCategory('Comic Sans')).toBeNull();
    });
  });

  describe('Real-World Resume Font Scenarios', () => {
    it('validates traditional resume fonts', () => {
      const traditional = ['Times New Roman', 'Georgia', 'Garamond'];
      traditional.forEach(font => {
        expect(isProfessional(font)).toBe(true);
        expect(getFontCategory(font)).toBe('serif');
        expect(isATSSafe(font)).toBe(true);
      });
    });

    it('validates modern resume fonts', () => {
      const modern = ['Arial', 'Calibri', 'Helvetica', 'Roboto'];
      modern.forEach(font => {
        expect(isProfessional(font)).toBe(true);
        expect(getFontCategory(font)).toBe('sans-serif');
        expect(isATSSafe(font)).toBe(true);
      });
    });

    it('validates web fonts for online resumes', () => {
      const web = ['Lato', 'Open Sans', 'Montserrat', 'Poppins'];
      web.forEach(font => {
        expect(isProfessional(font)).toBe(true);
        expect(isATSSafe(font)).toBe(true);
      });
    });

    it('handles user typos with aliases', () => {
      expect(normalizeFont('times')).toBe('Times New Roman');
      expect(normalizeFont('helvetica neue')).toBe('Helvetica');
      expect(normalizeFont('opensans')).toBe('Open Sans');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles empty string', () => {
      expect(validateFont('')).toBeNull();
      expect(normalizeFont('')).toBeNull();
      expect(isATSSafe('')).toBe(false);
      expect(isProfessional('')).toBe(false);
    });

    it('handles whitespace-only string', () => {
      expect(validateFont('   ')).toBeNull();
      expect(normalizeFont('   ')).toBeNull();
    });

    it('handles special characters', () => {
      expect(validateFont('Arial!')).toBeNull();
      expect(validateFont('Times@New@Roman')).toBeNull();
    });

    it('handles numeric input (as string)', () => {
      expect(validateFont('123')).toBeNull();
      expect(validateFont('Arial123')).toBeNull();
    });

    it('handles mixed case with aliases', () => {
      expect(validateFont('TIMES')?.name).toBe('Times New Roman');
      expect(validateFont('TNR')?.name).toBe('Times New Roman');
    });
  });

  describe('Font Metadata Consistency', () => {
    it('ensures all fonts have required fields', () => {
      const allFonts = getAvailableFonts();
      allFonts.forEach(fontName => {
        const mapping = validateFont(fontName);
        expect(mapping).toBeTruthy();
        expect(mapping?.name).toBeTruthy();
        expect(mapping?.category).toBeTruthy();
        expect(typeof mapping?.atsSafe).toBe('boolean');
        expect(typeof mapping?.professional).toBe('boolean');
        expect(Array.isArray(mapping?.aliases)).toBe(true);
        expect(Array.isArray(mapping?.fallbacks)).toBe(true);
      });
    });

    it('ensures professional fonts are ATS-safe', () => {
      const professionalFonts = getAvailableFonts();
      professionalFonts.forEach(font => {
        expect(isATSSafe(font)).toBe(true);
      });
    });

    it('ensures fallbacks are provided', () => {
      const allFonts = getAvailableFonts();
      allFonts.forEach(font => {
        const css = getFontFamilyCSS(font);
        expect(css.split(',').length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
