/**
 * Customization CSS Module
 * Generates CSS from design customization objects
 *
 * Extracted from: resume-builder-ai/src/lib/design-manager/template-renderer.ts (lines 74-136)
 * Phase 2: PDF Generation Logic
 */

/**
 * Generates CSS for design customization
 *
 * @param {Object|null} customization - Design customization object
 * @param {Object} customization.color_scheme - Color scheme configuration
 * @param {string} customization.color_scheme.primary - Primary color
 * @param {string} customization.color_scheme.secondary - Secondary color
 * @param {string} customization.color_scheme.accent - Accent color
 * @param {string} customization.color_scheme.background - Background color
 * @param {string} customization.color_scheme.text - Text color
 * @param {Object} customization.font_family - Font family configuration
 * @param {string} customization.font_family.heading - Heading font
 * @param {string} customization.font_family.body - Body font
 * @param {Object} customization.spacing - Spacing configuration
 * @param {string} customization.spacing.line_height - Line height
 * @param {string} customization.spacing.section_gap - Section gap
 * @param {string} customization.custom_css - Custom CSS string
 * @returns {string} Generated CSS string
 */
function generateCustomizationCSS(customization) {
  if (!customization) return '';

  let css = '';

  // Color scheme
  if (customization.color_scheme) {
    const colors = customization.color_scheme;
    css += `
      :root {
        --resume-primary: ${colors.primary || '#2563eb'};
        --resume-secondary: ${colors.secondary || '#64748b'};
        --resume-accent: ${colors.accent || '#0ea5e9'};
        --resume-background: ${colors.background || '#ffffff'};
        --resume-text: ${colors.text || '#1f2937'};
      }
    `;
  }

  // Font families
  if (customization.font_family) {
    const fonts = customization.font_family;
    if (fonts.heading) {
      css += `
        h1, h2, h3, h4, h5, h6 {
          font-family: ${fonts.heading}, sans-serif !important;
        }
      `;
    }
    if (fonts.body) {
      css += `
        body, p, li, span {
          font-family: ${fonts.body}, sans-serif !important;
        }
      `;
    }
  }

  // Spacing
  if (customization.spacing) {
    if (customization.spacing.line_height) {
      css += `
        body {
          line-height: ${customization.spacing.line_height} !important;
        }
      `;
    }
    if (customization.spacing.section_gap) {
      css += `
        .resume-section, section {
          margin-bottom: ${customization.spacing.section_gap} !important;
        }
      `;
    }
  }

  // Custom CSS
  if (customization.custom_css) {
    css += `\n${customization.custom_css}`;
  }

  return css;
}

/**
 * Validates customization object structure
 * @param {Object} customization - Customization to validate
 * @returns {Object} Validation result
 */
function validateCustomization(customization) {
  if (!customization) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  // Validate color scheme
  if (customization.color_scheme) {
    const validColorRegex = /^#[0-9A-Fa-f]{6}$|^rgb\(|^rgba\(|^hsl\(|^hsla\(/;
    const colors = customization.color_scheme;

    ['primary', 'secondary', 'accent', 'background', 'text'].forEach((colorKey) => {
      if (colors[colorKey] && !validColorRegex.test(colors[colorKey])) {
        errors.push(`Invalid color format for ${colorKey}: ${colors[colorKey]}`);
      }
    });
  }

  // Validate fonts
  if (customization.font_family) {
    const fonts = customization.font_family;
    ['heading', 'body'].forEach((fontKey) => {
      if (fonts[fontKey] && typeof fonts[fontKey] !== 'string') {
        errors.push(`Font ${fontKey} must be a string`);
      }
    });
  }

  // Validate spacing
  if (customization.spacing) {
    const spacing = customization.spacing;
    const validSpacingRegex = /^[\d.]+(?:px|em|rem|%)$/;

    ['line_height', 'section_gap'].forEach((spacingKey) => {
      if (
        spacing[spacingKey] &&
        !validSpacingRegex.test(spacing[spacingKey]) &&
        !/^[\d.]+$/.test(spacing[spacingKey]) // Allow unitless for line-height
      ) {
        errors.push(`Invalid spacing format for ${spacingKey}: ${spacing[spacingKey]}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes customization to remove potentially dangerous CSS
 * @param {Object} customization - Customization object
 * @returns {Object} Sanitized customization
 */
function sanitizeCustomization(customization) {
  if (!customization) return null;

  const sanitized = { ...customization };

  // Remove potentially dangerous CSS
  if (sanitized.custom_css) {
    // Remove @import, expression(), and other dangerous patterns
    sanitized.custom_css = sanitized.custom_css
      .replace(/@import/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<script/gi, '')
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }

  return sanitized;
}

module.exports = {
  generateCustomizationCSS,
  validateCustomization,
  sanitizeCustomization,
};
