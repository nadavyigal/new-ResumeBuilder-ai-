/**
 * API Route: POST /api/v1/design/[optimizationId]/revert
 * Revert to original template design (removes all customizations)
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T033
 * Test: tests/contract/design-undo.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revertToOriginal } from '@/lib/design-manager/undo-manager';
import { getDesignAssignment } from '@/lib/supabase/resume-designs';
import { getDesignTemplateById } from '@/lib/supabase/design-templates';

/**
 * POST /api/v1/design/[optimizationId]/revert
 * Removes all customizations and returns to original template design
 *
 * Response: 200 OK
 * {
 *   "assignment": {
 *     "id": "uuid",
 *     "template": {...},
 *     "customization": null,
 *     "previous_customization_id": null
 *   },
 *   "message": "Reverted to original template design"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { optimizationId: string } }
) {
  try {
    // Authentication check
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const optimizationId = params.optimizationId;

    // Verify optimization belongs to user
    const { data: optimization, error: optimizationError } = await supabase
      .from('optimizations')
      .select('id')
      .eq('id', optimizationId)
      .eq('user_id', session.user.id)
      .single();

    if (optimizationError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found' },
        { status: 404 }
      );
    }

    // Get design assignment
    const assignment = await getDesignAssignment(optimizationId, session.user.id);

    if (!assignment) {
      return NextResponse.json(
        { error: 'No design assigned to this optimization' },
        { status: 404 }
      );
    }

    // Perform revert (reset all customizations)
    await revertToOriginal(assignment.id);

    // Fetch updated assignment
    const updatedAssignment = await getDesignAssignment(optimizationId, session.user.id);

    if (!updatedAssignment) {
      return NextResponse.json(
        { error: 'Failed to retrieve updated assignment' },
        { status: 500 }
      );
    }

    // Fetch template details
    const template = await getDesignTemplateById(updatedAssignment.template_id);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        assignment: {
          id: updatedAssignment.id,
          optimization_id: updatedAssignment.optimization_id,
          template,
          customization: null,
          previous_customization_id: null
        },
        message: 'Reverted to original template design'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error reverting to original design:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
