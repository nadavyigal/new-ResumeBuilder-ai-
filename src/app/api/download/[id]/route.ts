import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { generatePdf, generateDocx, generatePdfWithDesign, generateDocxWithDesign } from "@/lib/export";
import { hasDesignAssignment } from "@/lib/template-engine";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { downloadRateLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("fmt");

  if (!format || (format !== "pdf" && format !== "docx")) {
    return NextResponse.json({ error: "Invalid format specified. Use 'pdf' or 'docx'." }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();

  // Verify user authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Apply rate limiting for PDF/DOCX downloads
  const rateLimitResult = await downloadRateLimiter.check(user.id);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  // Verify optimization belongs to user (CRITICAL SECURITY FIX)
  const { data: optimizationData, error } = await supabase
    .from("optimizations")
    .select("rewrite_data")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !optimizationData) {
    return NextResponse.json({ error: error?.message || "Optimization not found" }, { status: 404 });
  }

  const resumeData = optimizationData.rewrite_data as OptimizedResume;

  // Check if optimization has a design assignment
  const hasDesign = await hasDesignAssignment(id);

  let fileBuffer: Buffer;
  let contentType: string;
  let filename: string;

  if (format === "pdf") {
    // Use design-aware PDF generation if design exists
    fileBuffer = hasDesign
      ? await generatePdfWithDesign(resumeData, id)
      : await generatePdf(resumeData);
    contentType = "application/pdf";
    filename = `${resumeData.contact.name.replace(/\s+/g, '_')}_Resume.pdf`;
  } else {
    // Use design-aware DOCX generation if design exists
    fileBuffer = hasDesign
      ? await generateDocxWithDesign(resumeData, id)
      : await generateDocx(resumeData);
    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    filename = `${resumeData.contact.name.replace(/\s+/g, '_')}_Resume.docx`;
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  return new NextResponse(fileBuffer, { headers });
}
