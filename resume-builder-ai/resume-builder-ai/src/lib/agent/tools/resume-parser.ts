import { parsePdf } from "@/lib/pdf-parser";
import { log } from "../utils/logger";
import "../validators"; // ensure validators loaded in tool context

export const ResumeParser = {
  async parse(filePathOrBytes: string | Uint8Array): Promise<string> {
    if (typeof filePathOrBytes === "string") {
      // Node filesystem access may not be available everywhere; prefer bytes
      throw new Error("Reading from file path not supported in this environment. Pass bytes instead.");
    }
    try {
      const buffer = Buffer.isBuffer(filePathOrBytes)
        ? filePathOrBytes
        : Buffer.from(filePathOrBytes);
      const pdfData = await parsePdf(buffer);
      return pdfData.text || "";
    } catch (e: any) {
      log("tool_error", "ResumeParser.parse failed", { error: e?.message });
      return "";
    }
  },
};
