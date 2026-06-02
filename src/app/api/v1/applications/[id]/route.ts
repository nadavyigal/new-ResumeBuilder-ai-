import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase-server";

/**
 * GET /api/v1/applications/[id]
 * Returns application details with signed URLs for HTML and metadata JSON
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { data: application, error } = await supabase
      .from("applications")
      .select(
        "id, job_title, company_name, applied_date, apply_clicked_at, ats_score, contact, optimization_id, resume_html_path, resume_json_path, optimized_resume_id, optimized_resume_url, job_extraction"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Error fetching application: " + error.message }, { status: 500 });
    }

    if (!application) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const storage = (await createServiceRoleClient()).storage.from("applications");
    const signed: Record<string, string | null> = { htmlUrl: null, jsonUrl: null };

    if (application.resume_html_path) {
      const { data: urlData, error: urlErr } = await storage.createSignedUrl(application.resume_html_path as string, 60);
      if (!urlErr && urlData) signed.htmlUrl = urlData.signedUrl;
    }
    if (application.resume_json_path) {
      const { data: urlData, error: urlErr } = await storage.createSignedUrl(application.resume_json_path as string, 60);
      if (!urlErr && urlData) signed.jsonUrl = urlData.signedUrl;
    }

    return NextResponse.json({ success: true, application, ...signed });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}

const VALID_STATUSES = ['saved', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn'] as const;

/**
 * PATCH /api/v1/applications/[id]
 * Body: { status: string }
 * Updates the application status for the tracker.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const status = body?.status as string | undefined;

    if (!status || !VALID_STATUSES.includes(status as any)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    const { error } = await supabase
      .from("applications")
      .update({ status } as any)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}



