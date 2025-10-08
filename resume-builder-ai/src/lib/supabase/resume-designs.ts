/**
 * Supabase Database Wrapper: resume_design_assignments table
 * Provides type-safe access to design assignments with RLS enforcement
 *
 * Reference: specs/003-i-want-to/data-model.md
 * Task: T024 (partial)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface ResumeDesignAssignment {
  id: string;
  optimization_id: string;
  template_id: string;
  customization_id: string | null;
  previous_customization_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get design assignment for an optimization
 * @param optimizationId - Optimization UUID
 * @param userId - User ID for RLS enforcement
 * @returns Design assignment or null if not found
 */
export async function getDesignAssignment(
  optimizationId: string,
  userId: string
): Promise<ResumeDesignAssignment | null> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('resume_design_assignments')
    .select('*')
    .eq('optimization_id', optimizationId)
    .single();

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
 * @param optimizationId - Optimization UUID
 * @param templateId - Template UUID
 * @param userId - User ID for RLS enforcement
 * @returns Created/updated design assignment
 */
export async function upsertDesignAssignment(
  optimizationId: string,
  templateId: string,
  userId: string
): Promise<ResumeDesignAssignment> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('resume_design_assignments')
    .upsert(
      {
        optimization_id: optimizationId,
        template_id: templateId,
        customization_id: null, // Reset customization when changing template
        previous_customization_id: null
      },
      {
        onConflict: 'optimization_id'
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert design assignment: ${error.message}`);
  }

  return data;
}

/**
 * Update customization for a design assignment
 * @param assignmentId - Assignment UUID
 * @param customizationId - New customization UUID
 * @param previousCustomizationId - Previous customization UUID (for undo)
 * @returns Updated assignment
 */
export async function updateDesignCustomization(
  assignmentId: string,
  customizationId: string,
  previousCustomizationId: string | null
): Promise<ResumeDesignAssignment> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('resume_design_assignments')
    .update({
      customization_id: customizationId,
      previous_customization_id: previousCustomizationId
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update design customization: ${error.message}`);
  }

  return data;
}

/**
 * Delete design assignment for an optimization
 * @param optimizationId - Optimization UUID
 * @param userId - User ID for RLS enforcement
 */
export async function deleteDesignAssignment(
  optimizationId: string,
  userId: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('resume_design_assignments')
    .delete()
    .eq('optimization_id', optimizationId);

  if (error) {
    throw new Error(`Failed to delete design assignment: ${error.message}`);
  }
}
