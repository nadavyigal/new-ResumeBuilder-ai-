import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { generatePdfWithDesign, generateDocxWithDesign } from "@/lib/export";
import type { OptimizedResume } from "@/lib/ai-optimizer";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("fmt") ?? "pdf").toLowerCase();

  console.log(`[DOWNLOAD] Starting download for optimization ${id}, format: ${format}`);

  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "Invalid format specified. Use 'pdf' or 'docx'." }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();

  // Verify user authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[DOWNLOAD] User not authenticated');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[DOWNLOAD] User authenticated: ${user.id}`);

  const { data: optimizationData, error } = await supabase
    .from("optimizations")
    .select("rewrite_data")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error('[DOWNLOAD] Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!optimizationData) {
    console.error('[DOWNLOAD] Optimization not found');
    return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
  }

  console.log('[DOWNLOAD] Optimization data fetched successfully');

  const resumeData = optimizationData.rewrite_data as OptimizedResume;

  let fileBuffer: Buffer;
  let contentType: string;
  let filename: string;
  const safeName = resumeData?.contact?.name?.trim() || "Resume";

  try {
    if (format === "pdf") {
      console.log('[DOWNLOAD] Generating PDF with HTML template/design (fallbacks enabled)');
      fileBuffer = await generatePdfWithDesign(resumeData, id);

      contentType = "application/pdf";
      filename = `${safeName.replace(/\s+/g, '_')}_Resume.pdf`;

      console.log(`[DOWNLOAD] PDF generated successfully, size: ${fileBuffer.length} bytes`);
    } else {
      console.log('[DOWNLOAD] Generating DOCX (design support is limited)');
      fileBuffer = await generateDocxWithDesign(resumeData, id);

      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      filename = `${safeName.replace(/\s+/g, '_')}_Resume.docx`;

      console.log(`[DOWNLOAD] DOCX generated successfully, size: ${fileBuffer.length} bytes`);
    }
  } catch (error) {
    console.error('[DOWNLOAD] Error generating file:', error);
    console.error('[DOWNLOAD] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Cache-Control", "no-store");

  console.log(`[DOWNLOAD] Sending file: ${filename}`);
  return new NextResponse(fileBuffer, { headers });
}
