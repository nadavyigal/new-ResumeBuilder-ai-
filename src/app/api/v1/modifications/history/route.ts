/**
 * GET /api/v1/modifications/history
 *
 * Get modification history for an optimization
 * Shows audit trail of all resume changes with ATS score impact
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
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

    // Get optimization_id from query params
    const { searchParams } = new URL(request.url);
    const optimizationId = searchParams.get('optimization_id');

    if (!optimizationId) {
      return NextResponse.json(
        { error: 'optimization_id is required' },
        { status: 400 }
      );
    }

    // Verify user owns the optimization
    const { data: optimization, error: optError } = await supabase
      .from('optimizations')
      .select('id')
      .eq('id', optimizationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (optError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found or access denied' },
        { status: 404 }
      );
    }

    // Get modification history
    const { data: modifications, error: modsError } = await supabase
      .from('content_modifications')
      .select('*')
      .eq('optimization_id', optimizationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (modsError) {
      console.error('Error fetching modifications:', modsError);
      return NextResponse.json(
        { error: 'Failed to fetch modification history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      modifications: modifications || [],
      total: modifications?.length || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/modifications/history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
