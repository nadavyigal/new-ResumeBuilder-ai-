import { parseColorRequest, validateColor, getColorName } from '../parseColorRequest';
import { createClient } from '@supabase/supabase-js';

interface AgentContext {
  message: string;
  optimizationId: string;
  userId: string;
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
  const { message, optimizationId, userId } = context;
  console.log('🎨 [handleColorCustomization] INVOKED with:', { message, optimizationId, userId });

  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return {
      intent: 'color_customization',
      success: false,
      error: 'Supabase configuration missing',
    };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // 1. Parse color requests
  const colorRequests = parseColorRequest(message);
  console.log('🎨 [handleColorCustomization] Parsed color requests:', colorRequests);

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
    fonts: {},
  };

  for (const request of colorRequests) {
    switch (request.target) {
      case 'background':
        if (request.color) {
          customization.colors.background = request.color;
        }
        break;
      case 'header':
        if (request.color) {
          customization.colors.heading = request.color;
          customization.colors.primary = request.color; // Also set as primary
        }
        break;
      case 'text':
        if (request.color) {
          customization.colors.text = request.color;
        }
        break;
      case 'accent':
      case 'primary':
        if (request.color) {
          customization.colors.primary = request.color;
          customization.colors.accent = request.color;
        }
        break;
      case 'font':
        if (request.font) {
          customization.fonts.body = request.font;
          customization.fonts.headings = request.font;
        }
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
    fonts: {
      ...(existing?.customization?.fonts || {}),
      ...customization.fonts,
    },
  };
  
  // 6. Upsert design assignment
  console.log('🎨 [handleColorCustomization] Upserting design_assignments with:', {
    optimization_id: optimizationId,
    user_id: userId,
    template_id: existing?.template_id || null,
    customization: mergedCustomization,
  });

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
    console.error('❌ [handleColorCustomization] Error upserting design assignment:', upsertError);
    return {
      intent: 'color_customization',
      success: false,
      error: 'Failed to save color customization',
    };
  }
  
  // 7. Build success message
  const changes = colorRequests.map(r => {
    if (r.target === 'font' && r.font) {
      return `font to ${r.font}`;
    } else if (r.color) {
      const colorName = getColorName(r.color);
      return `${r.target} to ${colorName}`;
    }
    return null;
  }).filter(Boolean);

  const changesList = changes.length === 1
    ? changes[0]
    : changes.slice(0, -1).join(', ') + ' and ' + changes[changes.length - 1];

  const hasColorChanges = Object.keys(customization.colors).length > 0;
  const hasFontChanges = Object.keys(customization.fonts).length > 0;

  let successType = 'customizations';
  if (hasColorChanges && !hasFontChanges) successType = 'colors';
  if (hasFontChanges && !hasColorChanges) successType = 'fonts';

  console.log('✅ [handleColorCustomization] SUCCESS! Returning:', {
    color_customization: customization.colors,
    font_customization: customization.fonts,
    design_customization: mergedCustomization,
    message: `✅ Changed ${changesList}! Your resume ${successType} have been updated.`,
  });

  return {
    intent: 'color_customization',
    success: true,
    color_customization: customization.colors,
    design_customization: mergedCustomization,
    message: `✅ Changed ${changesList}! Your resume ${successType} have been updated.`,
  };
}




