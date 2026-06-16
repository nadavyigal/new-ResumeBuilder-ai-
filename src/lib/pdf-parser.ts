/**
 * PDF text extraction using pdfjs-dist (legacy Node.js build).
 *
 * The legacy build handles XRef errors that pdf-parse 1.x throws on PDFs
 * produced by print-to-PDF drivers, iOS export tools, and newer PDF generators
 * by falling back to a full linear object scan.
 *
 * It is loaded via a webpackIgnore'd native dynamic import(): pdf.mjs is an ES
 * module, and on the Vercel Node serverless runtime the route is CommonJS. A
 * plain import() of an externalized module is compiled by webpack into a
 * require(), and require() of an .mjs throws ERR_REQUIRE_ESM on Vercel's Node.
 * The webpackIgnore comment forces webpack to leave a real native import() in
 * the output, which Node loads as ESM correctly. The pdfjs files are kept in the
 * serverless bundle via outputFileTracingIncludes in next.config.ts.
 *
 * We deliberately do NOT set GlobalWorkerOptions.workerSrc — require.resolve() is
 * rewritten to a numeric webpack module id in production bundles (pdfjs rejects
 * it as "Invalid workerSrc type"), and in Node the legacy build runs parsing on
 * the main thread via a fake worker without one.
 */

export async function parsePdf(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
  const pdfjsLib: any = await import(/* webpackIgnore: true */ 'pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(dataBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const numpages: number = pdf.numPages;
  let text = '';

  for (let i = 1; i <= numpages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>)
      .filter((item) => typeof item.str === 'string')
      .map((item) => item.str as string)
      .join(' ');
    if (pageText.trim()) text += pageText + '\n';
  }

  return {
    text: text.trim(),
    numpages,
    info: {},
  };
}
