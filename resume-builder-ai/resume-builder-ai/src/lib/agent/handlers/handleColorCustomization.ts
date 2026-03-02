/**
 * Handle color and font customization requests from chat
 * Enhanced with WCAG validation and font validation (Phase 4, Task T028)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { parseColorRequest, ColorRequest } from '../parseColorRequest';
import { validateWCAG, type WCAGValidationResult } from '../accessibilityValidator';
import { normalizeFont, isProfessional } from '../fontValidator';
import { createDesignCustomization, getDesignCustomizationById } from '@/lib/supabase/design-customizations';
import { getDesignAssignment, updateDesignCustomization as updateAssignmentCustomization } from '@/lib/supabase/resume-designs';

interface HandleColorCustomizationParams {
  message: string;
  optimizationId: string;
  userId: string;
  supabase: SupabaseClient;
}

interface DesignCustomization {
  id: string;
  color_scheme: Record<string, string>;
  font_family: Record<string, string>;
  spacing?: Record<string, string>;
  custom_css?: string;
  is_ats_safe: boolean;
}

interface HandleColorCustomizationResult {
  success: boolean;
  message: string;
  error?: string;
  warning?: string;
  customization?: DesignCustomization;
  wcagValidation?: WCAGValidationResult[];
}

export async function handleColorCustomization(
  params: HandleColorCustomizationParams
): Promise<HandleColorCustomizationResult> {
  const { message, optimizationId, userId, supabase } = params;

  try {
    const requests: ColorRequest[] = parseColorRequest(message);

    if (requests.length === 0) {
      return {
        success: false,
        error: 'No color or font customization requests found in message',
        message: 'I could not find any color or font changes in your request.'
      };
    }

    const assignment = await getDesignAssignment(supabase, optimizationId, userId);

    if (!assignment) {
      return {
        success: false,
        error: 'No design assignment found',
        message: 'Please select a template first.'
      };
    }

    let currentCustomization: DesignCustomization | null = null;
    if (assignment.customization_id) {
      currentCustomization = await getDesignCustomizationById(assignment.customization_id, userId) as DesignCustomization;
    }

    const defaultColorScheme = {
      primary: '#2563eb',
      secondary: '#64748b',
      accent: '#10b981',
      background: '#ffffff',
      text: '#1e293b'
    };
    const colorScheme = {
      ...defaultColorScheme,
      ...(currentCustomization?.color_scheme || {})
    };

    const defaultFontFamily = {
      heading: 'Arial',
      body: 'Arial'
    };
    const fontFamily = {
      ...defaultFontFamily,
      ...(currentCustomization?.font_family || {})
    };

    // Validate and apply changes
    const warnings: string[] = [];

    for (const request of requests) {
      // Font validation (Phase 4, Task T028)
      if (request.target === 'font' && request.font) {
        const normalizedFont = normalizeFont(request.font);

        if (!normalizedFont) {
          warnings.push(`Font "${request.font}" is not recognized. Using Arial as fallback.`);
          continue;
        }

        if (!isProfessional(request.font)) {
          warnings.push(`Font "${normalizedFont}" is not recommended for professional resumes.`);
        }

        fontFamily.heading = normalizedFont;
        fontFamily.body = normalizedFont;
      }
      // Color validation
      else if (request.color) {
        switch (request.target) {
          case 'background':
            colorScheme.background = request.color;
            break;
          case 'header':
            colorScheme.primary = request.color;
            break;
          case 'text':
            colorScheme.text = request.color;
            break;
          case 'primary':
          case 'accent':
            colorScheme.primary = request.color;
            colorScheme.accent = request.color;
            break;
        }
      }
    }

    // WCAG Accessibility Validation (Phase 4, Task T028)
    const wcagValidations: WCAGValidationResult[] = [];

    // Validate text on background (most critical)
    const textOnBg = validateWCAG(colorScheme.text, colorScheme.background, 'AA', 'normal');
    wcagValidations.push(textOnBg);

    if (!textOnBg.passes) {
      warnings.push(
        `Warning: Text color has insufficient contrast with background (${textOnBg.ratio.toFixed(2)}:1, needs 4.5:1 for WCAG AA). ` +
        `This may make your resume difficult to read.`
      );
    }

    // Validate header/primary on background (large text - less strict)
    const headerOnBg = validateWCAG(colorScheme.primary, colorScheme.background, 'AA', 'large');
    wcagValidations.push(headerOnBg);

    if (!headerOnBg.passes) {
      warnings.push(
        `Warning: Header color has insufficient contrast with background (${headerOnBg.ratio.toFixed(2)}:1, needs 3:1 for large text). ` +
        `Consider using a darker shade.`
      );
    }

    // Check for AAA compliance (recommended)
    const aaaCompliance = validateWCAG(colorScheme.text, colorScheme.background, 'AAA', 'normal');
    if (textOnBg.passes && !aaaCompliance.passes) {
      // AA passes but AAA fails - inform user
      warnings.push(
        `Info: Your color scheme meets WCAG AA standards (${textOnBg.ratio.toFixed(2)}:1) but not AAA (needs 7:1). ` +
        `Consider higher contrast for better accessibility.`
      );
    }

    const spacing = {
      section_gap: '1.5rem',
      line_height: '1.6',
      ...(currentCustomization?.spacing || {})
    };

    const newCustomization = await createDesignCustomization(userId, {
      color_scheme: colorScheme,
      font_family: fontFamily,
      spacing,
      custom_css: currentCustomization?.custom_css || '',
      is_ats_safe: true
    });

    await updateAssignmentCustomization(
      supabase,
      assignment.id,
      newCustomization.id,
      assignment.customization_id
    );

    const changes = requests.map(r => {
      if (r.target === 'font') {
        const normalized = normalizeFont(r.font || '') || r.font;
        return 'font to ' + normalized;
      }
      return r.target + ' color to ' + r.originalColor;
    }).join(', ');

    // Construct success message with warnings
    let successMessage = `I have updated your resume design: ${changes}. The changes should be visible in the preview.`;

    if (warnings.length > 0) {
      successMessage += '\n\n' + warnings.join('\n');
    }

    return {
      success: true,
      message: successMessage,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined,
      customization: newCustomization,
      wcagValidation: wcagValidations
    };

  } catch (error) {
    console.error('Error handling color customization:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Sorry, I encountered an error while updating your design. Please try again.'
    };
  }
}





