/**
 * Supabase Database Wrapper: resume_design_assignments table
 * Provides type-safe access to design assignments with RLS enforcement
 *
 * Reference: specs/003-i-want-to/data-model.md
 * Task: T024 (partial)
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ResumeDesignAssignment {
  id: string;
  user_id: string;
  optimization_id: string;
  template_id: string;
  customization_id: string | null;
  previous_customization_id: string | null;
  original_template_id: string;
  is_active: boolean;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get design assignment for an optimization
 * @param supabase - Authenticated Supabase client
 * @param optimizationId - Optimization UUID
 * @param userId - User ID for RLS enforcement
 * @returns Design assignment or null if not found
 */
export async function getDesignAssignment(
  supabase: SupabaseClient,
  optimizationId: string,
  userId: string
): Promise<ResumeDesignAssignment | null> {
  const { data, error } = await supabase
    .from('resume_design_assignments')
    .select('*')
    .eq('optimization_id', optimizationId)
    .eq('user_id', userId) // Add user_id filter for defense in depth against 406 errors
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch design assignment: ${error.message}`);
  }

  return data;
}

/**
 * Create or update design assignment for an optimization
 * @param supabase - Authenticated Supabase client
 * @param optimizationId - Optimization UUID
 * @param templateId - Template UUID
 * @param userId - User ID for RLS enforcement
 * @returns Created/updated design assignment
 */
export async function upsertDesignAssignment(
  supabase: SupabaseClient,
  optimizationId: string,
  templateId: string,
  userId: string
): Promise<ResumeDesignAssignment> {
  const { data, error} = await supabase
    .from('resume_design_assignments')
    .upsert(
      {
        user_id: userId,
        optimization_id: optimizationId,
        template_id: templateId,
        original_template_id: templateId,
        customization_id: null, // Reset customization when changing template
        previous_customization_id: null,
        is_active: true
      },
      {
        onConflict: 'optimization_id'
      }
    )
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to upsert design assignment: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to upsert design assignment: No data returned');
  }

  return data;
}

/**
 * Update customization for a design assignment
 * @param supabase - Authenticated Supabase client
 * @param assignmentId - Assignment UUID
 * @param customizationId - New customization UUID
 * @param previousCustomizationId - Previous customization UUID (for undo)
 * @returns Updated assignment
 */
export async function updateDesignCustomization(
  supabase: SupabaseClient,
  assignmentId: string,
  customizationId: string,
  previousCustomizationId: string | null
): Promise<ResumeDesignAssignment> {
  const { data, error } = await supabase
    .from('resume_design_assignments')
    .update({
      customization_id: customizationId,
      previous_customization_id: previousCustomizationId
    })
    .eq('id', assignmentId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update design customization: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to update design customization: No data returned');
  }

  return data;
}

/**
 * Delete design assignment for an optimization
 * @param supabase - Authenticated Supabase client
 * @param optimizationId - Optimization UUID
 * @param userId - User ID for RLS enforcement
 */
export async function deleteDesignAssignment(
  supabase: SupabaseClient,
  optimizationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('resume_design_assignments')
    .delete()
    .eq('optimization_id', optimizationId);

  if (error) {
    throw new Error(`Failed to delete design assignment: ${error.message}`);
  }
}
