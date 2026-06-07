import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export interface ConversionResult {
  markdown: string;
  format: "pdf" | "docx";
  char_count: number;
}

export async function convertResumeBuffer(
  fileBuffer: Buffer,
  fileName: string
): Promise<ConversionResult> {
  const name = fileName.toLowerCase();

  if (name.endsWith(".pdf")) {
    const data = await pdfParse(fileBuffer);
    const markdown = data.text.trim();
    return { markdown, format: "pdf", char_count: markdown.length };
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const markdown = result.value.trim();
    return { markdown, format: "docx", char_count: markdown.length };
  }

  throw new Error(`Unsupported file format: ${fileName}`);
}
