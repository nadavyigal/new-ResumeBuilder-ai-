/**
 * API Route: GET /api/v1/design/templates
 * Lists all available design templates with optional category filtering
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T026
 * Test: tests/contract/design-templates.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getDesignTemplates } from '@/lib/supabase/design-templates';

/**
 * GET /api/v1/design/templates
 * Returns list of design templates, optionally filtered by category
 *
 * Query Parameters:
 * - category: 'minimal' | 'professional' | 'creative' | 'modern'
 *
 * Response: 200 OK
 * {
 *   "templates": [
 *     {
 *       "id": "uuid",
 *       "slug": "card-ssr",
 *       "name": "Card Layout",
 *       "description": "Modern card-based layout",
 *       "category": "modern",
 *       "is_premium": false,
 *       "thumbnail_url": "...",
 *       "color_scheme": {...},
 *       "font_family": {...},
 *       "ats_score": 95
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createRouteHandlerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    // Validate category if provided
    const validCategories = ['traditional', 'modern', 'corporate', 'creative'];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: traditional, modern, corporate, creative' },
        { status: 400 }
      );
    }

    // Fetch templates from database
    const templates = await getDesignTemplates(supabase, category || undefined);

    console.log('[templates] fetched:', templates.length, 'templates');
    console.log('[templates] first:', templates[0] ? JSON.stringify(templates[0], null, 2) : 'none');

    return NextResponse.json(
      {
        templates
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching design templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
