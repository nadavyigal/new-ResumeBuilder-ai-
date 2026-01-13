/**
 * POST /api/v1/modifications/[id]/revert
 *
 * Revert a specific modification
 * Restores the old value and creates a new modification record
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { setFieldValue } from '@/lib/resume/field-path-resolver';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const modificationId = id;

    // Get the modification to revert
    const { data: modification, error: modError } = await supabase
      .from('content_modifications')
      .select('*')
      .eq('id', modificationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (modError || !modification) {
      return NextResponse.json(
        { error: 'Modification not found or access denied' },
        { status: 404 }
      );
    }

    // Get current resume data
    const { data: optimization, error: optError } = await supabase
      .from('optimizations')
      .select('rewrite_data')
      .eq('id', modification.optimization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (optError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found' },
        { status: 404 }
      );
    }

    // Revert the modification by restoring old_value
    const currentResumeData = optimization.rewrite_data || {};
    const revertedResumeData = setFieldValue(
      currentResumeData,
      modification.field_path,
      modification.old_value
    );

    // Update the optimization
    const { error: updateError } = await supabase
      .from('optimizations')
      .update({ rewrite_data: revertedResumeData })
      .eq('id', modification.optimization_id);

    if (updateError) {
      console.error('Error reverting modification:', updateError);
      return NextResponse.json(
        { error: 'Failed to revert modification' },
        { status: 500 }
      );
    }

    // Create a new modification record for the revert
    const { data: revertRecord, error: revertError } = await supabase
      .from('content_modifications')
      .insert({
        user_id: user.id,
        optimization_id: modification.optimization_id,
        operation_type: 'replace', // Revert is always a replace
        field_path: modification.field_path,
        old_value: modification.new_value, // Current (new) becomes old
        new_value: modification.old_value, // Old becomes new
        ats_score_before: modification.ats_score_after,
        ats_score_after: modification.ats_score_before,
      })
      .select()
      .maybeSingle();

    if (revertError) {
      console.error('Error creating revert record:', revertError);
      // Non-critical error, modification was still reverted
    }

    return NextResponse.json({
      success: true,
      message: 'Modification reverted successfully',
      reverted_modification: modification,
      revert_record: revertRecord,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/modifications/[id]/revert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
