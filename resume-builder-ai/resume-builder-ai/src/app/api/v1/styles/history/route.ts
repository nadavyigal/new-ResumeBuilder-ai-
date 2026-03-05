/**
 * GET /api/v1/styles/history
 * Phase 4, Task T029
 *
 * Retrieve style customization history for a user's optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

interface StyleHistoryEntry {
  id: string;
  created_at: string;
  style_type: string;
  old_value: string | null;
  new_value: string | null;
  customization_id: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    // Get user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const optimizationId = searchParams.get('optimization_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!optimizationId) {
      return NextResponse.json(
        { error: 'Missing optimization_id parameter' },
        { status: 400 }
      );
    }

    // Verify user owns this optimization
    const { data: optimization, error: optError } = await supabase
      .from('optimizations')
      .select('id, user_id')
      .eq('id', optimizationId)
      .eq('user_id', user.id)
      .single();

    if (optError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch style customization history
    const { data: history, error: historyError } = await supabase
      .from('style_customization_history')
      .select(
        `
        id,
        created_at,
        style_type,
        old_value,
        new_value,
        customization_id
      `
      )
      .eq('user_id', user.id)
      .eq('optimization_id', optimizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (historyError) {
      console.error('Error fetching style history:', historyError);
      return NextResponse.json(
        { error: 'Failed to fetch style history' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('style_customization_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('optimization_id', optimizationId);

    if (countError) {
      console.error('Error counting history:', countError);
    }

    return NextResponse.json({
      history: history as StyleHistoryEntry[],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Unexpected error in style history endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
