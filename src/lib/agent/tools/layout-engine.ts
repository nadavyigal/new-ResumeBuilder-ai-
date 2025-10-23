import { renderTemplate, TemplateType } from "@/lib/template-engine";
import { generatePdf } from "@/lib/export";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { safeParseAgentArtifacts } from "../validators";
import { getFallbackArtifacts } from "../runtime/fallbacks";
import { log } from "../utils/logger";

export const LayoutEngine = {
  async render(resume_json: OptimizedResume, theme: any): Promise<{ html: string; preview_pdf_path?: string }> {
    const templateKey: TemplateType = (theme?.layout as TemplateType) || "ats-safe";
    const html = renderTemplate(resume_json, templateKey);

    // Try to generate a PDF preview and upload to Supabase Storage
    try {
      if (process.env.BENCH_SKIP_PDF === '1') {
        const htmlOnly = renderTemplate(resume_json, templateKey);
        return { html: htmlOnly };
      }
      const pdfBuffer = await generatePdf(resume_json);
      const supabase = createServiceRoleClient();
      const bucket = "artifacts";
      const userId = resume_json?.contact?.email || "anon";
      const filename = `preview_${Date.now()}.pdf`;
      const key = `${userId}/${filename}`;

      // Ensure bucket exists (ignore errors if already exists)
      try {
        await supabase.storage.createBucket(bucket, { public: false });
      } catch {}

      const upload = await supabase.storage.from(bucket).upload(key, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

      if (upload.error) throw upload.error;
      const path = `${bucket}/${key}`;
      const artifacts = safeParseAgentArtifacts({ preview_pdf_path: path, export_files: [{ type: "pdf", path }] });
      return { html, preview_pdf_path: artifacts.preview_pdf_path };
    } catch (e: any) {
      log("storage_warn", "LayoutEngine.render PDF/storage failed", { error: e?.message });
      const fb = getFallbackArtifacts();
      return { html, preview_pdf_path: fb.preview_pdf_path };
    }
  },
};
