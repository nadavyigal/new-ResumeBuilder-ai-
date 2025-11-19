/**
 * Handle color and font customization requests from chat
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { parseColorRequest, ColorRequest } from '../parseColorRequest';
import { createDesignCustomization, getDesignCustomizationById } from '@/lib/supabase/design-customizations';
import { getDesignAssignment, updateDesignCustomization as updateAssignmentCustomization } from '@/lib/supabase/resume-designs';

interface HandleColorCustomizationParams {
  message: string;
  optimizationId: string;
  userId: string;
  supabase: SupabaseClient;
}

interface HandleColorCustomizationResult {
  success: boolean;
  message: string;
  error?: string;
  customization?: any;
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

    let currentCustomization: any = null;
    if (assignment.customization_id) {
      currentCustomization = await getDesignCustomizationById(assignment.customization_id, userId);
    }

    const colorScheme = currentCustomization?.color_scheme || {
      primary: '#2563eb',
      secondary: '#64748b',
      accent: '#10b981',
      background: '#ffffff',
      text: '#1e293b'
    };

    const fontFamily = currentCustomization?.font_family || {
      heading: 'Arial',
      body: 'Arial'
    };

    for (const request of requests) {
      if (request.target === 'font' && request.font) {
        fontFamily.heading = request.font;
        fontFamily.body = request.font;
      } else if (request.color) {
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

    const newCustomization = await createDesignCustomization(userId, {
      color_scheme: colorScheme,
      font_family: fontFamily,
      spacing: currentCustomization?.spacing || {
        section_gap: '1.5rem',
        line_height: '1.6'
      },
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
        return 'font to ' + r.font;
      }
      return r.target + ' color to ' + r.originalColor;
    }).join(', ');

    return {
      success: true,
      message: 'I have updated your resume design: ' + changes + '. The changes should be visible in the preview.',
      customization: newCustomization
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



