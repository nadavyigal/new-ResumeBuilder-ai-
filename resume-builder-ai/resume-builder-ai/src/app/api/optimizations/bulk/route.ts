import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import type { BulkDeleteRequest, BulkDeleteResponse } from '@/types/history';

/**
 * DELETE /api/optimizations/bulk
 * Feature: 005-history-view-previous (User Story 4 - T036)
 *
 * Bulk delete optimizations with ownership verification via RLS
 *
 * Request Body:
 * - ids: string[] (array of optimization IDs, max 50)
 *
 * Response:
 * - success: boolean
 * - deleted: number (count of deleted optimizations)
 * - errors: Array<{id, error}> (any failures)
 * - preserved: {applications: number} (application records preserved)
 */
export async function DELETE(req: NextRequest) {
  // Initialize Supabase client with auth
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authentication check
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      },
      { status: 401 }
    );
  }

  try {
    // Parse and validate request body
    const body: BulkDeleteRequest = await req.json();

    if (!body.ids || !Array.isArray(body.ids)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: 'ids must be an array of strings',
          code: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }

    // Validate array length
    if (body.ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No IDs provided',
          code: 'EMPTY_IDS',
        },
        { status: 400 }
      );
    }

    if (body.ids.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many IDs',
          details: 'Maximum 50 IDs allowed per request',
          code: 'TOO_MANY_IDS',
        },
        { status: 400 }
      );
    }

    // Validate all IDs are strings
    if (!body.ids.every((id) => typeof id === 'string' && id.trim().length > 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid ID format',
          details: 'All IDs must be non-empty strings',
          code: 'INVALID_IDS',
        },
        { status: 400 }
      );
    }

    // First, check how many have associated applications
    const { data: applicationsData, error: appsError } = await supabase
      .from('applications')
      .select('optimization_id')
      .in('optimization_id', body.ids);

    if (appsError) {
      console.error('Error checking applications:', appsError);
    }

    const preservedApplicationsCount = applicationsData?.length || 0;

    // Attempt to delete optimizations
    // RLS will ensure user can only delete their own
    const { data: deletedData, error: deleteError } = await supabase
      .from('optimizations')
      .delete()
      .in('id', body.ids)
      .eq('user_id', user.id)
      .select('id');

    if (deleteError) {
      console.error('Error deleting optimizations:', deleteError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete optimizations',
          details: deleteError.message,
          code: 'DELETE_FAILED',
        },
        { status: 500 }
      );
    }

    const deletedCount = deletedData?.length || 0;
    const deletedIds = new Set(deletedData?.map(item => item.id) || []);

    // Check for any IDs that couldn't be deleted (either don't exist or don't belong to user)
    const errors = body.ids
      .filter((id) => !deletedIds.has(id))
      .map((id) => ({
        id,
        error: 'Optimization not found or unauthorized',
      }));

    // Build response
    const response: BulkDeleteResponse = {
      success: deletedCount > 0,
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined,
      preserved: {
        applications: preservedApplicationsCount,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store', // Don't cache delete operations
      },
    });

  } catch (error: unknown) {
    console.error('Error in DELETE /api/optimizations/bulk:', error);
    const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process bulk delete',
        details: errorMessage,
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
