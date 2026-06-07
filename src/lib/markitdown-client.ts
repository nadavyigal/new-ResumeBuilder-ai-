const MARKITDOWN_URL = process.env.MARKITDOWN_SERVICE_URL;
const INTERNAL_TOKEN = process.env.MARKITDOWN_INTERNAL_TOKEN;

export interface ConversionResult {
  markdown: string;
  format: "pdf" | "docx";
  char_count: number;
}

/**
 * Convert a resume file buffer to structured Markdown via the MarkItDown service.
 * Accepts a Buffer (already read for magic-byte validation) + filename to avoid
 * double-consuming the File stream in the request handler.
 */
export async function convertResumeBuffer(
  fileBuffer: Buffer,
  fileName: string
): Promise<ConversionResult> {
  if (!MARKITDOWN_URL) {
    throw new Error(
      "MARKITDOWN_SERVICE_URL is not configured. Add it to your environment variables."
    );
  }

  const form = new FormData();
  // Reconstruct a Blob from the already-read buffer — avoids double-consuming the File stream.
  form.append("file", new Blob([new Uint8Array(fileBuffer)]), fileName);

  const headers: Record<string, string> = {};
  if (INTERNAL_TOKEN) {
    headers["X-Internal-Token"] = INTERNAL_TOKEN;
  }

  let res: Response;
  try {
    res = await fetch(`${MARKITDOWN_URL}/convert`, {
      method: "POST",
      body: form,
      headers,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`MarkItDown service unreachable: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(`MarkItDown conversion failed (${res.status})`);
  }

  return res.json() as Promise<ConversionResult>;
}
