import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export interface ConversionResult {
  markdown: string;
  format: "pdf" | "docx";
  char_count: number;
}

const NUL_BYTE_PATTERN = new RegExp(String.fromCharCode(0), "g");

// Postgres `text` columns reject the NUL byte with "unsupported Unicode
// escape sequence" (22P05). Some PDF encoders emit stray NUL bytes in
// extracted text, which would otherwise crash the resumes insert with a
// generic 500 well after parsing succeeded.
export function sanitizeExtractedText(text: string): string {
  return text.replace(NUL_BYTE_PATTERN, "").trim();
}

export async function convertResumeBuffer(
  fileBuffer: Buffer,
  fileName: string
): Promise<ConversionResult> {
  const name = fileName.toLowerCase();

  if (name.endsWith(".pdf")) {
    const data = await pdfParse(fileBuffer);
    const markdown = sanitizeExtractedText(data.text);
    return { markdown, format: "pdf", char_count: markdown.length };
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const markdown = sanitizeExtractedText(result.value);
    return { markdown, format: "docx", char_count: markdown.length };
  }

  throw new Error(`Unsupported file format: ${fileName}`);
}
