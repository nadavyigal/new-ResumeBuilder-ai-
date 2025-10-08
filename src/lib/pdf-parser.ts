/**
 * Safe wrapper around pdf-parse to avoid test code execution
 * pdf-parse is externalized in next.config.ts to prevent webpack from bundling test code
 */

export async function parsePdf(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
  // Use require instead of import to load the externalized module at runtime
  const pdfParse = require('pdf-parse');
  return pdfParse(dataBuffer);
}
