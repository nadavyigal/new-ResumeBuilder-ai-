/**
 * PDF text extraction using unpdf.
 *
 * unpdf wraps a serverless-first build of pdfjs that bundles the browser/DOM
 * polyfills (DOMMatrix, Path2D, ImageData, ...) pdfjs needs at parse time. The
 * raw pdfjs legacy build does not: on the Vercel Node runtime it failed first
 * with ERR_REQUIRE_ESM (require() of the .mjs build) and then, once loaded, with
 * "ReferenceError: DOMMatrix is not defined" — neither reproducible on local
 * Node, which made every pdfjs fix a false green. unpdf avoids the whole class:
 * it is a normal ESM dependency webpack bundles, with no worker or DOM globals
 * required. Verified to extract text with DOMMatrix/Path2D/ImageData deleted
 * from globalThis (the condition that broke pdfjs on Vercel).
 */

import { extractText, getDocumentProxy } from 'unpdf';

export async function parsePdf(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
  const data = new Uint8Array(dataBuffer);
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });

  return {
    text: text.trim(),
    numpages: totalPages,
    info: {},
  };
}
