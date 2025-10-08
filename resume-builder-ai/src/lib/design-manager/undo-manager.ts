/**
 * Undo Manager Module
 * Single-level undo for design customizations using database state swapping
 *
 * Reference: specs/003-i-want-to/research.md
 * Task: T022
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Checks if undo is available for an assignment
 * @param assignmentId - Assignment UUID
 * @returns true if previous_customization_id exists
 */
export async function canUndo(assignmentId: string): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('resume_design_assignments')
    .select('previous_customization_id')
    .eq('id', assignmentId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.previous_customization_id !== null;
}

/**
 * Performs undo by swapping current and previous customization IDs
 * This implements single-level undo as specified in research.md
 *
 * @param assignmentId - Assignment UUID
 * @returns Updated assignment with swapped customization IDs
 */
export async function performUndo(assignmentId: string): Promise<any> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch current assignment
  const { data: assignment, error: fetchError } = await supabase
    .from('resume_design_assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (fetchError || !assignment) {
    throw new Error('Assignment not found');
  }

  // Check if undo is possible
  if (!assignment.previous_customization_id) {
    throw new Error('No previous customization to undo to');
  }

  // Swap current and previous customization IDs
  const { data: updatedAssignment, error: updateError } = await supabase
    .from('resume_design_assignments')
    .update({
      customization_id: assignment.previous_customization_id,
      previous_customization_id: assignment.customization_id
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to perform undo: ${updateError.message}`);
  }

  return updatedAssignment;
}

/**
 * Reverts to original template design (removes all customizations)
 * @param assignmentId - Assignment UUID
 * @returns Updated assignment with null customization IDs
 */
export async function revertToOriginal(assignmentId: string): Promise<any> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Reset both customization IDs to null
  const { data: updatedAssignment, error } = await supabase
    .from('resume_design_assignments')
    .update({
      customization_id: null,
      previous_customization_id: null
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to revert to original: ${error.message}`);
  }

  return updatedAssignment;
}
