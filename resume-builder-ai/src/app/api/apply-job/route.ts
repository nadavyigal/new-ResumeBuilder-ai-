import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { generatePdf } from "@/lib/export";
import type { OptimizedResume } from "@/lib/ai-optimizer";

/**
 * Apply to a job with the optimized resume
 * This endpoint generates the resume PDF and provides metadata for application
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { optimizationId } = await req.json();

    if (!optimizationId) {
      return NextResponse.json({ error: "Optimization ID is required" }, { status: 400 });
    }

    // Fetch optimization data with job description URL
    const { data: optimizationData, error: optError } = await supabase
      .from("optimizations")
      .select(`
        id,
        rewrite_data,
        match_score,
        job_descriptions (
          source_url,
          title,
          company
        )
      `)
      .eq("id", optimizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (optError || !optimizationData) {
      return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
    }

    const resumeData = optimizationData.rewrite_data as OptimizedResume;
    const jobDescription = optimizationData.job_descriptions as { source_url: string | null; title: string; company: string };

    // Generate PDF resume
    const pdfBuffer = await generatePdf(resumeData);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Log the application event
    await supabase.from("events").insert([
      {
        user_id: user.id,
        type: "job_application",
        payload_data: {
          optimization_id: optimizationId,
          job_url: jobDescription.source_url,
          job_title: jobDescription.title,
          company: jobDescription.company,
          match_score: optimizationData.match_score,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      jobUrl: jobDescription.source_url,
      jobTitle: jobDescription.title,
      company: jobDescription.company,
      matchScore: optimizationData.match_score,
      resumePdfBase64: pdfBase64,
      message: jobDescription.source_url
        ? "Resume generated! Opening job application page..."
        : "Resume generated and ready to download!",
    });
  } catch (error: unknown) {
    console.error("Error applying to job:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process application";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
