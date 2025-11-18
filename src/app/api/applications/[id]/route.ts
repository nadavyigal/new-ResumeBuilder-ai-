import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";

/**
 * Application Detail API Endpoint
 * Epic 6: Application Tracking
 *
 * FR-027: Link resume versions to applications
 * FR-028: Update application status and notes
 */

/**
 * GET /api/applications/[id]
 * FR-027: Get specific application with linked data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // FR-027: Get application with full optimization and resume data
    const { data: application, error } = await supabase
      .from("applications")
      .select(`
        *,
        optimizations (
          id,
          match_score,
          gaps_data,
          rewrite_data,
          template_key,
          created_at,
          job_descriptions (
            id,
            title,
            company,
            source_url,
            raw_text
          ),
          resumes (
            id,
            filename,
            created_at
          )
        )
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Application fetch error:", error);
      return NextResponse.json({
        error: "Error fetching application: " + error.message,
      }, { status: 500 });
    }

    if (!application) {
      return NextResponse.json({
        error: "Application not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      application,
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Application fetch error:", error);

    return NextResponse.json({
      error: "Failed to fetch application",
      details: err.message || "Unknown error",
    }, { status: 500 });
  }
}

/**
 * PATCH /api/applications/[id]
 * FR-028: Update application status and notes
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const {
      status,
      appliedDate,
      notes,
      jobTitle,
      companyName,
      jobUrl,
    } = body;

    // Build update object with only provided fields
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) updates.status = status;
    if (appliedDate !== undefined) updates.applied_date = appliedDate;
    if (notes !== undefined) updates.notes = notes;
    if (jobTitle !== undefined) updates.job_title = jobTitle;
    if (companyName !== undefined) updates.company_name = companyName;
    if (jobUrl !== undefined) updates.job_url = jobUrl;

    // Validate status if provided
    const validStatuses = ['saved', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({
        error: "Invalid status value",
        validStatuses,
      }, { status: 400 });
    }

    // FR-028: Update application
    const { data: application, error } = await supabase
      .from("applications")
      // @ts-expect-error - dynamic updates object is compatible at runtime
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
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

    if (error) {
      console.error("Error updating application:", error);
      return NextResponse.json({
        error: "Failed to update application",
        details: error.message,
      }, { status: 500 });
    }

    if (!application) {
      return NextResponse.json({
        error: "Application not found or access denied",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      application,
      message: "Application updated successfully",
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Application update error:", error);

    return NextResponse.json({
      error: "Failed to update application",
      details: err.message || "Unknown error",
    }, { status: 500 });
  }
}

/**
 * DELETE /api/applications/[id]
 * Delete application
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting application:", error);
      return NextResponse.json({
        error: "Failed to delete application",
        details: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Application deleted successfully",
    });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Application deletion error:", error);

    return NextResponse.json({
      error: "Failed to delete application",
      details: err.message || "Unknown error",
    }, { status: 500 });
  }
}
