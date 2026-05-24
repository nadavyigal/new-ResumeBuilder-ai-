export type ParsedPdfData = {
  text: string;
  numpages: number;
  info: unknown;
};

type ResolvePdfDataOptions = {
  fileBuffer: Buffer;
  fileName: string;
  resumeTextFallback: string | null;
  parsePdf: (buffer: Buffer) => Promise<ParsedPdfData>;
  warn?: (message: string, metadata: Record<string, unknown>) => void;
};

export function normalizeResumeTextFallback(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return normalized.length > 0 ? normalized : null;
}

export function pdfDataFromResumeTextFallback(text: string): ParsedPdfData {
  return {
    text,
    numpages: 0,
    info: {
      source: 'client_resume_text_fallback',
    },
  };
}

export async function resolvePdfDataWithResumeTextFallback({
  fileBuffer,
  fileName,
  resumeTextFallback,
  parsePdf,
  warn,
}: ResolvePdfDataOptions): Promise<ParsedPdfData> {
  try {
    const parsed = await parsePdf(fileBuffer);
    if (parsed.text.trim().length > 0) {
      return parsed;
    }

    if (resumeTextFallback) {
      warn?.('PDF parse returned empty text; using client fallback text', { fileName });
      return pdfDataFromResumeTextFallback(resumeTextFallback);
    }

    throw new Error('PDF parser returned empty text');
  } catch (error) {
    if (resumeTextFallback) {
      const message = error instanceof Error ? error.message : String(error);
      warn?.('PDF parse failed; using client fallback text', { fileName, error: message });
      return pdfDataFromResumeTextFallback(resumeTextFallback);
    }

    throw error;
  }
}
