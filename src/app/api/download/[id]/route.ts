import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { generatePdf, generateDocx } from "@/lib/export";
import type { OptimizedResume } from "@/lib/ai-optimizer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("fmt");

  if (!format || (format !== "pdf" && format !== "docx")) {
    return NextResponse.json({ error: "Invalid format specified. Use 'pdf' or 'docx'." }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();

  const { data: optimizationData, error } = await supabase
    .from("optimizations")
    .select("rewrite_data")
    .eq("id", id)
    .single();

  if (error || !optimizationData) {
    return NextResponse.json({ error: error?.message || "Optimization not found" }, { status: 500 });
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
