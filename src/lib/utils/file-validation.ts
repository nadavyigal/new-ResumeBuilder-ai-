const PDF_MAGIC = "%PDF-";
// DOCX is a ZIP file — all ZIP files start with PK\x03\x04
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function hasPdfMagicHeader(buffer: Buffer): boolean {
  return (
    buffer.length >= PDF_MAGIC.length &&
    buffer.subarray(0, PDF_MAGIC.length).toString("ascii") === PDF_MAGIC
  );
}

export function hasDocxMagicHeader(buffer: Buffer): boolean {
  return (
    buffer.length >= DOCX_MAGIC.length &&
    buffer.subarray(0, DOCX_MAGIC.length).equals(DOCX_MAGIC)
  );
}

export function isSupportedResumeFile(file: File, buffer: Buffer): boolean {
  const name = (file?.name ?? "").toLowerCase();
  const type = (file?.type ?? "").toLowerCase();

  const looksLikePdf =
    name.endsWith(".pdf") ||
    type === "application/pdf" ||
    type === "application/x-pdf";

  const looksLikeDocx =
    name.endsWith(".docx") ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (looksLikePdf) return hasPdfMagicHeader(buffer);
  if (looksLikeDocx) return hasDocxMagicHeader(buffer);
  return false;
}
