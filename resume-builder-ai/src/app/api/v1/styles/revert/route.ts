/**
 * POST /api/v1/styles/revert
 * Phase 4, Task T031
 *
 * Revert to a previous style customization from history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

interface RevertRequest {
  optimization_id: string;
  customization_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as RevertRequest;
    const { optimization_id, customization_id } = body;

    if (!optimization_id || !customization_id) {
      return NextResponse.json(
        { error: 'Missing optimization_id or customization_id' },
        { status: 400 }
      );
    }

    // Verify user owns this optimization
    const { data: optimization, error: optError } = await supabase
      .from('optimizations')
      .select('id, user_id')
      .eq('id', optimization_id)
      .eq('user_id', user.id)
      .single();

    if (optError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the customization exists and belongs to this user
    const { data: customization, error: customError } = await supabase
      .from('design_customizations')
      .select('*')
      .eq('id', customization_id)
      .eq('user_id', user.id)
      .single();

    if (customError || !customization) {
      return NextResponse.json(
        { error: 'Customization not found or access denied' },
        { status: 404 }
      );
    }

    // Get current design assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('resume_design_assignments')
      .select('id, customization_id')
      .eq('optimization_id', optimization_id)
      .eq('user_id', user.id)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: 'Design assignment not found' },
        { status: 404 }
      );
    }

    // Update the assignment to use the historical customization
    const { error: updateError } = await supabase
      .from('resume_design_assignments')
      .update({
        customization_id,
        previous_customization_id: assignment.customization_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);

    if (updateError) {
      console.error('Error reverting customization:', updateError);
      return NextResponse.json(
        { error: 'Failed to revert customization' },
        { status: 500 }
      );
    }

    // Log the revert action in history
    const { error: historyError } = await supabase
      .from('style_customization_history')
      .insert({
        user_id: user.id,
        optimization_id,
        customization_id,
        style_type: 'revert',
        old_value: assignment.customization_id,
        new_value: customization_id,
      });

    if (historyError) {
      console.error('Error logging revert in history:', historyError);
      // Non-critical error, continue
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully reverted to previous customization',
      customization,
    });
  } catch (error) {
    console.error('Unexpected error in style revert endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
