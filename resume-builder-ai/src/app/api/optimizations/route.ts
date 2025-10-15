import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import type {
  OptimizationsQueryParams,
  OptimizationsResponse,
  OptimizationHistoryEntry,
} from "@/types/history";

/**
 * GET /api/optimizations
 * Feature: 005-history-view-previous
 *
 * Fetch paginated, filtered, sorted optimization history for the authenticated user
 *
 * Query Parameters:
 * - page: number (default: 1, min: 1)
 * - limit: number (default: 20, min: 1, max: 100)
 * - sort: 'date' | 'score' | 'company' (default: 'date')
 * - order: 'asc' | 'desc' (default: 'desc')
 * - dateFrom: ISO 8601 date string (inclusive)
 * - dateTo: ISO 8601 date string (inclusive)
 * - minScore: number (0-1 scale)
 * - search: string (case-insensitive partial match on job title/company)
 */
export async function GET(req: NextRequest) {
  // Initialize Supabase client with auth
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authentication check
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const params = parseQueryParams(searchParams);

    if (!params.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: params.errors.join(", "),
          code: "INVALID_PARAMS",
        },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      sort,
      order,
      dateFrom,
      dateTo,
      minScore,
    } = params.data;

    // Calculate pagination offset
    const offset = (page - 1) * limit;

    // Build base query - fetch base data first
    let query = supabase
      .from('optimizations')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply date range filters (server-side)
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Apply score filter (server-side)
    if (minScore !== null && minScore !== undefined) {
      query = query.gte('match_score', minScore);
    }

    // Apply sorting
    const sortField = getSortField(sort);
    query = query.order(sortField, { ascending: order === 'asc', nullsFirst: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching optimizations:', error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch optimizations",
          details: error.message,
          code: "SERVER_ERROR",
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        optimizations: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
          totalPages: 0,
        },
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=300',
        },
      });
    }

    // Fetch related data separately to avoid 406 errors
    const optimizationIds = data.map(opt => opt.id);
    const jdIds = data.map(opt => opt.jd_id).filter(Boolean);

    // Fetch job descriptions
    const { data: jobDescriptions } = await supabase
      .from('job_descriptions')
      .select('id, title, company, source_url')
      .in('id', jdIds);

    const jdMap = new Map(
      (jobDescriptions || []).map(jd => [jd.id, jd])
    );

    // Fetch applications (may not exist yet)
    let applicationsMap = new Map();
    try {
      const { data: applications } = await supabase
        .from('applications')
        .select('id, optimization_id, status, applied_date')
        .in('optimization_id', optimizationIds);

      applicationsMap = new Map(
        (applications || []).map(app => [app.optimization_id, app])
      );
    } catch (err) {
      console.warn('Applications table may not exist yet:', err);
    }

    // Transform data to match API contract
    const optimizations: OptimizationHistoryEntry[] = data.map(opt => {
      const jd = jdMap.get(opt.jd_id);
      const app = applicationsMap.get(opt.id);

      return {
        id: opt.id,
        createdAt: opt.created_at,
        jobTitle: jd?.title || null,
        company: jd?.company || null,
        matchScore: opt.match_score,
        status: opt.status,
        jobUrl: jd?.source_url || null,
        templateKey: opt.template_key,
        hasApplication: app !== undefined,
        applicationStatus: app?.status || undefined,
        applicationDate: app?.applied_date || undefined,
        applicationId: app?.id || undefined,
      };
    });

    // Build response
    const total = count || 0;
    const response: OptimizationsResponse = {
      success: true,
      optimizations,
      pagination: {
        page,
        limit,
        total,
        hasMore: total > (page * limit),
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minutes cache
      },
    });

  } catch (error: unknown) {
    console.error("Error in GET /api/optimizations:", error);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch optimizations",
        details: errorMessage,
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(searchParams: URLSearchParams): {
  valid: boolean;
  data: Required<OptimizationsQueryParams>;
  errors: string[];
} {
  const errors: string[] = [];

  // Parse page (default: 1)
  let page = parseInt(searchParams.get('page') || '1');
  if (isNaN(page) || page < 1) {
    errors.push('page must be a positive integer');
    page = 1;
  }

  // Parse limit (default: 20, max: 100)
  let limit = parseInt(searchParams.get('limit') || '20');
  if (isNaN(limit) || limit < 1) {
    errors.push('limit must be a positive integer');
    limit = 20;
  } else if (limit > 100) {
    errors.push('limit must not exceed 100');
    limit = 100;
  }

  // Parse sort (default: 'date')
  const sort = searchParams.get('sort') || 'date';
  if (!['date', 'score', 'company'].includes(sort)) {
    errors.push('sort must be one of: date, score, company');
  }

  // Parse order (default: 'desc')
  const order = searchParams.get('order') || 'desc';
  if (!['asc', 'desc'].includes(order)) {
    errors.push('order must be one of: asc, desc');
  }

  // Parse dateFrom (optional)
  const dateFrom = searchParams.get('dateFrom') || undefined;
  if (dateFrom && !isValidISODate(dateFrom)) {
    errors.push('dateFrom must be a valid ISO 8601 date');
  }

  // Parse dateTo (optional)
  const dateTo = searchParams.get('dateTo') || undefined;
  if (dateTo && !isValidISODate(dateTo)) {
    errors.push('dateTo must be a valid ISO 8601 date');
  }

  // Validate date range logic
  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    errors.push('dateFrom must be before or equal to dateTo');
  }

  // Parse minScore (optional)
  let minScore: number | undefined = undefined;
  const minScoreParam = searchParams.get('minScore');
  if (minScoreParam) {
    minScore = parseFloat(minScoreParam);
    if (isNaN(minScore) || minScore < 0 || minScore > 1) {
      errors.push('minScore must be a number between 0 and 1');
      minScore = undefined;
    }
  }

  // Parse search (optional)
  const search = searchParams.get('search') || undefined;
  if (search && search.length > 100) {
    errors.push('search query must be 100 characters or less');
  }

  return {
    valid: errors.length === 0,
    data: {
      page,
      limit,
      sort: sort as 'date' | 'score' | 'company',
      order: order as 'asc' | 'desc',
      dateFrom,
      dateTo,
      minScore,
      search,
    },
    errors,
  };
}

/**
 * Map sort parameter to database column
 */
function getSortField(sort: string): string {
  switch (sort) {
    case 'score':
      return 'match_score';
    case 'company':
      // Note: company is in job_descriptions table, but we'll sort by created_at
      // and handle company sorting client-side for MVP
      return 'created_at';
    case 'date':
    default:
      return 'created_at';
  }
}

/**
 * Validate ISO 8601 date string
 */
function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
