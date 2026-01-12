import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { cleanResumeData, generatePdfWithDesign } from "@/lib/export";
import { resolvePdfDesignContext, type PdfDesignContext } from "@/lib/pdf-design-context";
import { callPDFService } from "@/lib/pdf-service-client";
import type { OptimizedResume } from "@/lib/ai-optimizer";

export const runtime = "nodejs";

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
    const cleanedResumeData = cleanResumeData(resumeData);
    let designContext: PdfDesignContext | null = null;
    let dockerAttempted = false;
    let pdfBuffer: Buffer | null = null;

    try {
      designContext = await resolvePdfDesignContext(supabase, optimizationId, user.id);
      dockerAttempted = true;

      const dockerResult = await callPDFService(
        cleanedResumeData,
        designContext.templateSlug,
        designContext.customization
      );

      if (dockerResult.success && dockerResult.pdfBase64) {
        pdfBuffer = Buffer.from(dockerResult.pdfBase64, "base64");
        console.log(`[APPLY-JOB] Docker PDF generated successfully, size: ${pdfBuffer.length} bytes`);
      } else {
        console.warn('[APPLY-JOB] Docker PDF service returned error:', dockerResult.error);
      }
    } catch (dockerError) {
      console.warn('[APPLY-JOB] Docker PDF service failed, falling back:', dockerError);
    }

    if (!pdfBuffer) {
      let pdfResult: Awaited<ReturnType<typeof generatePdfWithDesign>>;
      if (dockerAttempted && designContext) {
        pdfResult = await generatePdfWithDesign(resumeData, optimizationId, { skipDocker: true, designContext });
      } else {
        pdfResult = await generatePdfWithDesign(resumeData, optimizationId);
      }
      pdfBuffer = pdfResult.buffer;
    }
    if (!pdfBuffer) {
      throw new Error("PDF generation failed");
    }
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
