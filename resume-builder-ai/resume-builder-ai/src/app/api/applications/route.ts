import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/agent/utils/logger";

/**
 * Applications API Endpoint
 * Epic 6: Application Tracking
 *
 * FR-025: Save job applications with resume versions
 * FR-026: List all saved applications
 */

/**
 * GET /api/applications
 * FR-026: Get all applications for the current user
 */
export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // FR-026 & FR-027: Get applications with linked optimization/resume data
    const { data: applications, error } = await supabase
      .from("applications")
      .select(`
        *,
        optimizations (
          id,
          match_score,
          template_key,
          rewrite_data,
          job_descriptions (
            id,
            title,
            company,
            source_url
          ),
          resumes (
            id,
            filename
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error('Error fetching applications', { userId: user.id }, error);
      return NextResponse.json({
        error: "Failed to fetch applications",
        details: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      applications: applications || [],
      count: applications?.length || 0,
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.error('Applications fetch failed unexpectedly', { userId: user.id }, error);

    return NextResponse.json({
      error: "Failed to fetch applications",
      details: err.message || "Unknown error",
    }, { status: 500 });
  }
}

/**
 * POST /api/applications
 * FR-025: Create new job application
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      optimizationId,
      jobTitle,
      companyName,
      jobUrl,
      status = 'saved',
      appliedDate,
      notes,
    } = body;

    // Validate required fields
    if (!optimizationId || !jobTitle || !companyName) {
      return NextResponse.json({
        error: "Missing required fields",
        required: ["optimizationId", "jobTitle", "companyName"],
      }, { status: 400 });
    }

    // FR-027: Verify optimization belongs to user
    const { data: optimization, error: optError } = await supabase
      .from("optimizations")
      .select("id, user_id")
      .eq("id", optimizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (optError || !optimization) {
      return NextResponse.json({
        error: "Optimization not found or access denied",
      }, { status: 404 });
    }

    // FR-025: Create application record
    const { data: application, error: insertError } = await supabase
      .from("applications")
      .insert([
        {
          user_id: user.id,
          optimization_id: optimizationId,
          job_title: jobTitle,
          company_name: companyName,
          job_url: jobUrl || null,
          status,
          applied_date: appliedDate || null,
          notes: notes || null,
        },
      ])
      .select(`
        *,
        optimizations (
          id,
          match_score,
          job_descriptions (
            title,
            company
          )
        )
      `)
      .maybeSingle();

    if (insertError) {
      logger.error('Error creating application record', {
        userId: user.id,
        optimizationId,
      }, insertError);
      return NextResponse.json({
        error: "Failed to create application",
        details: insertError.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      application,
      message: "Application saved successfully",
    }, { status: 201 });

  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.error('Application creation failed unexpectedly', { userId: user.id }, error);

    return NextResponse.json({
      error: "Failed to create application",
      details: err.message || "Unknown error",
    }, { status: 500 });
  }
}
