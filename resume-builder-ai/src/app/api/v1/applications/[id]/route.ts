import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase-server";

/**
 * GET /api/v1/applications/[id]
 * Returns application details with signed URLs for HTML and metadata JSON
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { data: application, error } = await supabase
      .from("applications")
      .select("id, job_title, company_name, applied_date, ats_score, contact, resume_html_path, resume_json_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !application) {
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



