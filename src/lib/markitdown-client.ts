const MARKITDOWN_URL = process.env.MARKITDOWN_SERVICE_URL;

export interface ConversionResult {
  markdown: string;
  format: "pdf" | "docx";
  char_count: number;
}

export async function convertResumeFile(file: File): Promise<ConversionResult> {
  if (!MARKITDOWN_URL) {
    throw new Error(
      "MARKITDOWN_SERVICE_URL is not configured. Add it to your environment variables."
    );
  }

  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${MARKITDOWN_URL}/convert`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`MarkItDown service unreachable: ${msg}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail || body?.error || "";
    } catch {
      // ignore parse error
    }
    throw new Error(
      `MarkItDown conversion failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  return res.json() as Promise<ConversionResult>;
}
