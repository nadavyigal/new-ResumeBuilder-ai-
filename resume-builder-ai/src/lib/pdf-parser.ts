/**
 * Safe wrapper around pdf-parse to avoid test code execution
 * pdf-parse is externalized in next.config.ts to prevent webpack from bundling test code
 */

export async function parsePdf(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
  // Load the externalized module at runtime
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = pdfParseModule.default ?? pdfParseModule;
  return pdfParse(dataBuffer);
}
