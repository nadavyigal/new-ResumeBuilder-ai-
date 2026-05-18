/**
 * PDF text extraction using pdfjs-dist (legacy Node.js build).
 *
 * pdfjs-dist is externalized in next.config.ts so webpack does not try to
 * bundle the ESM worker. At runtime the legacy CJS-compatible build is
 * loaded via require(). It handles XRef errors that pdf-parse 1.x throws on
 * PDFs produced by print-to-PDF drivers, iOS export tools, and newer PDF
 * generators by falling back to a full linear object scan.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pdfWorkerSrc: string | null = null;

function getWorkerSrc(): string {
  if (!_pdfWorkerSrc) {
    // resolve once — works in both local dev and Vercel deployments
    _pdfWorkerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }
  return _pdfWorkerSrc;
}

export async function parsePdf(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

  pdfjsLib.GlobalWorkerOptions.workerSrc = getWorkerSrc();

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
