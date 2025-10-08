/**
 * API Routes: GET/PUT /api/v1/design/[optimizationId]
 * Get and update design assignment for an optimization
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T029, T030
 * Test: tests/contract/design-assignment.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import {
  getDesignAssignment,
  upsertDesignAssignment
} from '@/lib/supabase/resume-designs';
import { getDesignTemplateById } from '@/lib/supabase/design-templates';

/**
 * GET /api/v1/design/[optimizationId]
 * Returns current design assignment with template and customization details
 *
 * Response: 200 OK
 * {
 *   "assignment": {
 *     "id": "uuid",
 *     "optimization_id": "uuid",
 *     "template": {...},
 *     "customization": {...} | null,
 *     "previous_customization_id": "uuid" | null
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ optimizationId: string }> }
) {
  try {
    // Authentication check
    const supabase = await createRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { optimizationId } = await params;

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

    // Fetch template details
    const template = await getDesignTemplateById(assignment.template_id);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 500 }
      );
    }

    // Fetch customization if exists
    let customization = null;
    if (assignment.customization_id) {
      const { data: customizationData } = await supabase
        .from('design_customizations')
        .select('*')
        .eq('id', assignment.customization_id)
        .single();

      customization = customizationData;
    }

    return NextResponse.json(
      {
        assignment: {
          id: assignment.id,
          optimization_id: assignment.optimization_id,
          template,
          customization,
          previous_customization_id: assignment.previous_customization_id
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching design assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/design/[optimizationId]
 * Update design assignment (change template, reset customizations)
 *
 * Request Body:
 * {
 *   "templateId": "uuid"
 * }
 *
 * Response: 200 OK
 * {
 *   "assignment": {...}
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ optimizationId: string }> }
) {
  try {
    // Authentication check
    const supabase = await createRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { optimizationId } = await params;

    // Parse request body
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }

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

    // Verify template exists
    const template = await getDesignTemplateById(templateId);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check premium access if template is premium
    if (template.is_premium) {
      // TODO: Implement subscription check when premium feature is ready
      // For now, allow all users to assign premium templates
    }

    // Upsert design assignment (creates if doesn't exist, updates if exists)
    const assignment = await upsertDesignAssignment(
      optimizationId,
      templateId,
      session.user.id
    );

    // Fetch full assignment details for response
    const updatedAssignment = await getDesignAssignment(optimizationId, session.user.id);

    if (!updatedAssignment) {
      return NextResponse.json(
        { error: 'Failed to retrieve updated assignment' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        assignment: {
          id: updatedAssignment.id,
          optimization_id: updatedAssignment.optimization_id,
          template,
          customization: null, // Reset when changing template
          previous_customization_id: null
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating design assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
