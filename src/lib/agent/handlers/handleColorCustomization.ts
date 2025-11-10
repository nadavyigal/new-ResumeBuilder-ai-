import { parseColorRequest, validateColor, getColorName } from '../parseColorRequest';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AgentContext {
  message: string;
  optimizationId: string;
  userId: string;
  supabase: SupabaseClient;
}

interface AgentResponse {
  intent: string;
  success: boolean;
  error?: string;
  color_customization?: Record<string, string>;
  design_customization?: any;
  message?: string;
}

export async function handleColorCustomization(
  context: AgentContext
): Promise<AgentResponse> {
  const { message, optimizationId, userId, supabase } = context;
  
  // 1. Parse color requests
  const colorRequests = parseColorRequest(message);
  
  if (colorRequests.length === 0) {
    return {
      intent: 'color_customization',
      success: false,
      error: 'No valid color change request found. Try: "change background to blue" or "make headers green"',
    };
  }
  
  // 2. Validate all colors
  for (const request of colorRequests) {
    if (!validateColor(request.color)) {
      return {
        intent: 'color_customization',
        success: false,
        error: `Invalid color format: ${request.originalColor}`,
      };
    }
  }
  
  // 3. Build customization object
  const customization: any = {
    colors: {},
  };
  
  for (const request of colorRequests) {
    switch (request.target) {
      case 'background':
        customization.colors.background = request.color;
        break;
      case 'header':
        customization.colors.heading = request.color;
        customization.colors.primary = request.color; // Also set as primary
        break;
      case 'text':
        customization.colors.text = request.color;
        break;
      case 'accent':
      case 'primary':
        customization.colors.primary = request.color;
        customization.colors.accent = request.color;
        break;
    }
  }
  
  // 4. Fetch or create design assignment
  const { data: existing } = await supabase
    .from('design_assignments')
    .select('*')
    .eq('optimization_id', optimizationId)
    .maybeSingle();
  
  // 5. Merge with existing customizations
  const mergedCustomization = {
    ...(existing?.customization || {}),
    colors: {
      ...(existing?.customization?.colors || {}),
      ...customization.colors,
    },
  };
  
  // 6. Upsert design assignment
  const { error: upsertError } = await supabase
    .from('design_assignments')
    .upsert({
      optimization_id: optimizationId,
      user_id: userId,
      template_id: existing?.template_id || null,
      customization: mergedCustomization,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'optimization_id'
    });
  
  if (upsertError) {
    console.error('Error upserting design assignment:', upsertError);
    return {
      intent: 'color_customization',
      success: false,
      error: 'Failed to save color customization',
    };
  }
  
  // 7. Build success message
  const changes = colorRequests.map(r => {
    const colorName = getColorName(r.color);
    return `${r.target} to ${colorName}`;
  });
  
  const changesList = changes.length === 1 
    ? changes[0]
    : changes.slice(0, -1).join(', ') + ' and ' + changes[changes.length - 1];
  
  return {
    intent: 'color_customization',
    success: true,
    color_customization: customization.colors,
    design_customization: mergedCustomization,
    message: `✅ Changed ${changesList}! Your resume colors have been updated.`,
  };
}




