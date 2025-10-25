import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { generatePdf, generateDocx } from "@/lib/export";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { z } from 'zod';
import { downloadRateLimiter, createRateLimitResponse } from "@/lib/rate-limit";

// Validation schema for download request
const DownloadParamsSchema = z.object({
  id: z.string().uuid('Invalid optimization ID format'),
  format: z.enum(['pdf', 'docx'], {
    errorMap: () => ({ message: "Format must be either 'pdf' or 'docx'" }),
  }),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("fmt");

  // Validate input parameters
  const validation = DownloadParamsSchema.safeParse({ id, format });
  if (!validation.success) {
    const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return NextResponse.json({ error: errors }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();

  // SECURITY: Verify user authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting: 20 downloads per hour per user
  const rateLimitResult = await downloadRateLimiter.check(user.id);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  // SECURITY: Verify user owns the optimization (prevents authorization bypass)
  const { data: optimizationData, error } = await supabase
    .from("optimizations")
    .select("rewrite_data, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!optimizationData) {
    return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
  }

  const resumeData = optimizationData.rewrite_data as OptimizedResume;

  let fileBuffer: Buffer;
  let contentType: string;
  let filename: string;

  if (format === "pdf") {
    fileBuffer = await generatePdf(resumeData);
    contentType = "application/pdf";
    filename = `${resumeData.contact.name.replace(/\s+/g, '_')}_Resume.pdf`;
  } else {
    fileBuffer = await generateDocx(resumeData);
    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    filename = `${resumeData.contact.name.replace(/\s+/g, '_')}_Resume.docx`;
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  return new NextResponse(fileBuffer, { headers });
}
