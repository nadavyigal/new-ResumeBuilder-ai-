/**
 * ATS Validator Module
 * Validates design customizations for ATS compatibility
 *
 * Reference: specs/003-i-want-to/research.md
 * Task: T020
 */

export interface ATSValidationResult {
  isValid: boolean;
  errors: string[];
}

export const ATS_SAFE_RULES = {
  allowedTags: ['div', 'p', 'span', 'h1', 'h2', 'h3', 'ul', 'li', 'a', 'strong', 'em'],
  blockedTags: ['img', 'svg', 'canvas', 'video', 'iframe', 'object', 'embed'],
  allowedCssProperties: [
    'color',
    'background-color',
    'font-family',
    'font-size',
    'font-weight',
    'margin',
    'padding',
    'line-height',
    'text-align',
    'display',
    'flex-direction',
    'border',
    'width',
    'height'
  ],
  blockedCssProperties: [
    'background-image',
    'clip-path',
    'transform',
    'filter',
    'animation',
    'opacity',
    'z-index'
  ],
  allowedFonts: [
    'Arial',
    'Times New Roman',
    'Calibri',
    'Georgia',
    'Verdana',
    'Helvetica',
    'Courier New',
    'Tahoma'
  ],
  maxFileSize: 200 * 1024 // 200KB
};

/**
 * Validates customization configuration for ATS compatibility
 * Uses whitelist-based approach to ensure safety
 *
 * @param customization - Customization config to validate
 * @returns Validation result with errors if any
 */
export function validateCustomization(customization: any): ATSValidationResult {
  const errors: string[] = [];

  // Validate color scheme
  if (customization.color_scheme) {
    const colorErrors = validateColors(customization.color_scheme);
    errors.push(...colorErrors);
  }

  // Validate font families
  if (customization.font_family) {
    const fontErrors = validateFonts(customization.font_family);
    errors.push(...fontErrors);
  }

  // Validate spacing
  if (customization.spacing) {
    const spacingErrors = validateSpacing(customization.spacing);
    errors.push(...spacingErrors);
  }

  // Validate custom CSS
  if (customization.custom_css) {
    const cssErrors = validateCustomCSS(customization.custom_css);
    errors.push(...cssErrors);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates color values are valid hex codes
 */
function validateColors(colorScheme: any): string[] {
  const errors: string[] = [];
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;

  const colorKeys = ['primary', 'secondary', 'accent', 'background', 'text'];

  for (const key of colorKeys) {
    const color = colorScheme[key];

    if (color && !hexPattern.test(color)) {
      errors.push(`Invalid color format for ${key}: ${color}. Must be hex format (e.g., #FF5733)`);
    }
  }

  // Check for sufficient contrast (basic check)
  if (colorScheme.background && colorScheme.text) {
    const bgLuminance = getLuminance(colorScheme.background);
    const textLuminance = getLuminance(colorScheme.text);
    const contrast = calculateContrast(bgLuminance, textLuminance);

    if (contrast < 4.5) {
      errors.push(
        'Insufficient contrast between background and text colors. ATS systems may have difficulty reading the resume.'
      );
    }
  }

  return errors;
}

/**
 * Validates font families are ATS-safe
 */
function validateFonts(fontFamily: any): string[] {
  const errors: string[] = [];

  const fontKeys = ['heading', 'body'];

  for (const key of fontKeys) {
    const font = fontFamily[key];

    if (font && !ATS_SAFE_RULES.allowedFonts.includes(font)) {
      errors.push(
        `Font "${font}" for ${key} is not ATS-safe. Recommended fonts: ${ATS_SAFE_RULES.allowedFonts.join(', ')}`
      );
    }
  }

  return errors;
}

/**
 * Validates spacing values are reasonable
 */
function validateSpacing(spacing: any): string[] {
  const errors: string[] = [];

  // Validate section_gap
  if (spacing.section_gap) {
    if (!isValidCSSValue(spacing.section_gap)) {
      errors.push(`Invalid CSS value for section_gap: ${spacing.section_gap}`);
    }
  }

  // Validate line_height
  if (spacing.line_height) {
    const lineHeight = parseFloat(spacing.line_height);

    if (isNaN(lineHeight) || lineHeight < 1.0 || lineHeight > 3.0) {
      errors.push(
        `Line height ${spacing.line_height} is not ATS-safe. Recommended range: 1.0 to 3.0`
      );
    }
  }

  return errors;
}

/**
 * Validates custom CSS does not contain blocked properties
 */
function validateCustomCSS(css: string): string[] {
  const errors: string[] = [];

  // Check for blocked CSS properties
  for (const blockedProp of ATS_SAFE_RULES.blockedCssProperties) {
    if (css.toLowerCase().includes(blockedProp.toLowerCase())) {
      errors.push(
        `CSS property "${blockedProp}" is not ATS-safe and may cause parsing issues.`
      );
    }
  }

  // Check for blocked HTML tags in CSS (e.g., background-image with SVG)
  for (const blockedTag of ATS_SAFE_RULES.blockedTags) {
    if (css.toLowerCase().includes(blockedTag.toLowerCase())) {
      errors.push(
        `CSS contains reference to "${blockedTag}" which is not ATS-compatible.`
      );
    }
  }

  return errors;
}

/**
 * Validates CSS value format
 */
function isValidCSSValue(value: string): boolean {
  // Allow rem, em, px, %, or numeric values
  const validPattern = /^[\d.]+(?:rem|em|px|%)?$/;
  return validPattern.test(value.trim());
}

/**
 * Calculates relative luminance of a color
 * Formula from WCAG 2.0 spec
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const color = hex.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;

  // Apply gamma correction
  const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates contrast ratio between two luminance values
 */
function calculateContrast(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}
