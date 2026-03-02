const PDF_MAGIC_HEADER = '%PDF-';

export function hasPdfMagicHeader(buffer: Buffer): boolean {
  if (!buffer || buffer.length < PDF_MAGIC_HEADER.length) {
    return false;
  }

  return buffer
    .subarray(0, PDF_MAGIC_HEADER.length)
    .toString('ascii') === PDF_MAGIC_HEADER;
}

export function isPdfUpload(file: File, buffer: Buffer): boolean {
  const name = file?.name?.toLowerCase() || '';
  const type = file?.type?.toLowerCase() || '';
  const looksLikePdf =
    name.endsWith('.pdf') ||
    type === 'application/pdf' ||
    type === 'application/x-pdf';

  return looksLikePdf && hasPdfMagicHeader(buffer);
}
