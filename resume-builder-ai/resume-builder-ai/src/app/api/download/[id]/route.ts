import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { cleanResumeData, generatePdfWithDesign, generateDocxWithDesign, type PdfWithDesignResult } from "@/lib/export";
import { resolvePdfDesignContext, type PdfDesignContext } from "@/lib/pdf-design-context";
import { callPDFService } from "@/lib/pdf-service-client";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { logger } from "@/lib/agent/utils/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { RESUME_EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("fmt") ?? "pdf").toLowerCase();

  logger.info('Starting download request', { optimizationId: id, format });

  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "Invalid format specified. Use 'pdf' or 'docx'." }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();

  // Verify user authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logger.warn('Download request rejected due to missing authentication', { optimizationId: id });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info('Download request authenticated', { optimizationId: id, userId: user.id });

  const { data: optimizationData, error } = await supabase
    .from("optimizations")
    .select("rewrite_data")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logger.error('Database error while fetching optimization for download', { optimizationId: id, userId: user.id }, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!optimizationData) {
    logger.error('Optimization not found for download request', { optimizationId: id, userId: user.id });
    return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
  }

  logger.info('Optimization data fetched successfully for download', { optimizationId: id, userId: user.id });

  const resumeData = optimizationData.rewrite_data as OptimizedResume;

  let fileBuffer: Buffer | null = null;
  let contentType: string;
  let filename: string;
  const safeName = resumeData?.contact?.name?.trim() || "Resume";
  let pdfResult: PdfWithDesignResult | null = null;

  try {
    if (format === "pdf") {
      logger.info('Generating PDF for download with docker fallback', { optimizationId: id });
      const cleanedResumeData = cleanResumeData(resumeData);
      let designContext: PdfDesignContext | null = null;
      let dockerAttempted = false;

      try {
        designContext = await resolvePdfDesignContext(supabase, id, user.id);
        dockerAttempted = true;

        const dockerResult = await callPDFService(
          cleanedResumeData,
          designContext.templateSlug,
          designContext.customization
        );

        if (dockerResult.success && dockerResult.pdfBase64) {
          const buffer = Buffer.from(dockerResult.pdfBase64, "base64");
          pdfResult = {
            buffer,
            renderer: "docker",
            templateSlug: dockerResult.metadata?.templateSlug ?? designContext.templateSlug,
            usedDesignAssignment: designContext.usedDesignAssignment,
          };
          fileBuffer = buffer;
          logger.info('Docker PDF generated successfully', {
            optimizationId: id,
            size: buffer.length,
            templateSlug: pdfResult.templateSlug,
          });
        } else {
          logger.warn('Docker PDF service returned error', {
            optimizationId: id,
            error: dockerResult.error,
          });
        }
      } catch (dockerError) {
        logger.warn('Docker PDF service failed, falling back to local renderer', { optimizationId: id }, dockerError);
      }

      if (!pdfResult) {
        logger.info('Falling back to local PDF generation', { optimizationId: id, dockerAttempted });
        if (dockerAttempted && designContext) {
          pdfResult = await generatePdfWithDesign(resumeData, id, { skipDocker: true, designContext });
        } else {
          pdfResult = await generatePdfWithDesign(resumeData, id);
        }
        const buffer = pdfResult.buffer;
        fileBuffer = buffer;
        logger.info('Local PDF generated successfully', {
          optimizationId: id,
          size: buffer.length,
        });
      }

      contentType = "application/pdf";
      filename = `${safeName.replace(/\s+/g, '_')}_Resume.pdf`;

    } else {
      logger.info('Generating DOCX for download', { optimizationId: id });
      const buffer = await generateDocxWithDesign(resumeData, id);
      fileBuffer = buffer;

      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      filename = `${safeName.replace(/\s+/g, '_')}_Resume.docx`;

      logger.info('DOCX generated successfully', {
        optimizationId: id,
        size: buffer.length,
      });
    }
  } catch (error) {
    const errorDetails: Record<string, unknown> = {
      optimizationId: id,
      format,
      message: error instanceof Error ? error.message : String(error),
    };
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      errorDetails.stack = error.stack;
    }
    logger.error('Error generating download file', errorDetails, error);

    // Track download failure
    await captureServerEvent(user.id, RESUME_EVENTS.DOWNLOAD_ERROR, {
      optimization_id: id,
      format,
      error_message: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }

  // Safety check: ensure fileBuffer was generated
  if (!fileBuffer) {
    logger.error('File buffer missing after download generation', { optimizationId: id, format });
    return NextResponse.json({ error: "Failed to generate file" }, { status: 500 });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Cache-Control", "no-store");
  if (format === "pdf" && pdfResult) {
    // Helpful for debugging production issues via DevTools/Network.
    headers.set("X-Resume-Pdf-Renderer", pdfResult.renderer);
    if (pdfResult.templateSlug) {
      headers.set("X-Resume-Template", pdfResult.templateSlug);
    }
    headers.set("X-Resume-Design-Assigned", pdfResult.usedDesignAssignment ? "1" : "0");
  }

  // Track successful download
  await captureServerEvent(user.id, RESUME_EVENTS.DOWNLOADED, {
    format,
    optimization_id: id,
    template_slug: pdfResult?.templateSlug || null,
    renderer: pdfResult?.renderer || 'docx',
    file_size_bytes: fileBuffer.length,
  });

  logger.info('Sending download response', { optimizationId: id, filename, contentType });
  const body = fileBuffer as unknown as BodyInit;
  return new NextResponse(body, { headers });
}
