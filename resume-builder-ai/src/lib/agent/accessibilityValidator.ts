/**
 * Accessibility Validator - WCAG 2.1 Color Contrast Compliance
 * Phase 4, Task T026 (Implementation)
 *
 * Validates color combinations for WCAG AA and AAA compliance.
 * Tests created in Phase 4, Task T023.
 */

export type WCAGLevel = 'AA' | 'AAA';
export type TextSize = 'normal' | 'large';

export interface WCAGValidationResult {
  passes: boolean;
  ratio: number;
  level: WCAGLevel;
  textSize: TextSize;
}

/**
 * Calculate relative luminance of a color
 * Formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * @param hexColor - 6-digit hex color code (e.g., "#3B82F6")
 * @returns Relative luminance value (0.0 to 1.0)
 * @throws Error if hex color is invalid
 */
export function getRelativeLuminance(hexColor: string): number {
  // Validate hex format (must be 6-digit hex with #)
  if (!/^#[0-9a-f]{6}$/i.test(hexColor)) {
    throw new Error(`Invalid hex color format: ${hexColor}. Expected format: #RRGGBB`);
  }

  // Extract RGB components
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  // Apply sRGB to linear RGB transformation
  const toLinear = (channel: number): number => {
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };

  const rLinear = toLinear(r);
  const gLinear = toLinear(g);
  const bLinear = toLinear(b);

  // Calculate relative luminance using ITU-R BT.709 coefficients
  const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;

  return luminance;
}

/**
 * Calculate contrast ratio between two colors
 * Formula: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * @param foreground - Foreground color (6-digit hex)
 * @param background - Background color (6-digit hex)
 * @returns Contrast ratio (1 to 21), rounded to 2 decimal places
 */
export function getContrastRatio(foreground: string, background: string): number {
  const L1 = getRelativeLuminance(foreground);
  const L2 = getRelativeLuminance(background);

  // Always divide lighter by darker (formula requires lighter + 0.05 / darker + 0.05)
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);

  const ratio = (lighter + 0.05) / (darker + 0.05);

  // Round to 2 decimal places, unless it's a whole number
  return Math.round(ratio * 100) / 100;
}

/**
 * Validate WCAG compliance for a color combination
 *
 * WCAG 2.1 Requirements:
 * - AA Normal: 4.5:1 minimum
 * - AA Large: 3:1 minimum
 * - AAA Normal: 7:1 minimum
 * - AAA Large: 4.5:1 minimum
 *
 * Large text: 18pt+ or 14pt+ bold
 *
 * @param foreground - Foreground color (6-digit hex)
 * @param background - Background color (6-digit hex)
 * @param level - WCAG level to validate against ('AA' or 'AAA')
 * @param textSize - Text size category ('normal' or 'large')
 * @returns Validation result with pass/fail status and contrast ratio
 */
export function validateWCAG(
  foreground: string,
  background: string,
  level: WCAGLevel,
  textSize: TextSize
): WCAGValidationResult {
  const ratio = getContrastRatio(foreground, background);

  // WCAG 2.1 minimum contrast ratios
  const thresholds = {
    AA: {
      normal: 4.5,
      large: 3.0,
    },
    AAA: {
      normal: 7.0,
      large: 4.5,
    },
  };

  const minimumRatio = thresholds[level][textSize];
  const passes = ratio >= minimumRatio;

  return {
    passes,
    ratio,
    level,
    textSize,
  };
}
