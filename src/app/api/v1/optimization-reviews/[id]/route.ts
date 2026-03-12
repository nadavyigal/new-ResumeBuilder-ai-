import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { getOptimizationReviewRun } from "@/lib/optimization-review/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const reviewRun = await getOptimizationReviewRun(supabase, id, user.id);

    if (!reviewRun) {
      return NextResponse.json({ error: "Review run not found." }, { status: 404 });
    }

    const [{ data: resume }, { data: jobDescription }] = await Promise.all([
      supabase
        .from("resumes")
        .select("filename, raw_text")
        .eq("id", reviewRun.resume_id)
        .maybeSingle(),
      supabase
        .from("job_descriptions")
        .select("title, company, source_url, raw_text, clean_text")
        .eq("id", reviewRun.jd_id)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      review: reviewRun,
      resume: resume || null,
      jobDescription: jobDescription || null,
    });
  } catch (error) {
    console.error("Failed to load optimization review run:", error);
    return NextResponse.json(
      { error: "Failed to load optimization review run." },
      { status: 500 }
    );
  }
}
