/**
 * API Route: POST /api/v1/design/[optimizationId]/undo
 * Undo last design customization (single-level undo)
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T032
 * Test: tests/contract/design-undo.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { performUndo } from '@/lib/design-manager/undo-manager';
import { getDesignAssignment } from '@/lib/supabase/resume-designs';
import { getDesignTemplateById } from '@/lib/supabase/design-templates';
import { getDesignCustomizationById } from '@/lib/supabase/design-customizations';

/**
 * POST /api/v1/design/[optimizationId]/undo
 * Swaps current and previous customization (single-level undo)
 *
 * Response: 200 OK
 * {
 *   "assignment": {
 *     "id": "uuid",
 *     "template": {...},
 *     "customization": {...} | null,
 *     "previous_customization_id": "uuid" | null
 *   },
 *   "message": "Undo successful"
 * }
 *
 * Response: 400 Bad Request
 * {
 *   "error": "No previous customization to undo to"
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

    // Check if undo is possible
    if (!assignment.previous_customization_id) {
      return NextResponse.json(
        { error: 'No previous customization to undo to' },
        { status: 400 }
      );
    }

    // Perform undo (swap current and previous)
    await performUndo(assignment.id);

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

    // Fetch customization if exists
    let customization = null;
    if (updatedAssignment.customization_id) {
      customization = await getDesignCustomizationById(
        updatedAssignment.customization_id,
        session.user.id
      );
    }

    return NextResponse.json(
      {
        assignment: {
          id: updatedAssignment.id,
          optimization_id: updatedAssignment.optimization_id,
          template,
          customization,
          previous_customization_id: updatedAssignment.previous_customization_id
        },
        message: 'Undo successful'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error performing undo:', error);

    if (error instanceof Error && error.message.includes('No previous customization')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
