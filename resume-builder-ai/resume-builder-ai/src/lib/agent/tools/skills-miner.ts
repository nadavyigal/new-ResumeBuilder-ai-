import type { OptimizedResume } from "@/lib/ai-optimizer";
import { extractKeywords } from "@/lib/ai-optimizer";
import { log } from "../utils/logger";
import "../validators"; // ensure validators loaded in tool context

export const SkillsMiner = {
  extract({ resume_json, job_text }: { resume_json?: OptimizedResume; job_text?: string }) {
    try {
      const text = [
        resume_json?.summary,
        ...(resume_json?.skills?.technical ?? []),
        ...(resume_json?.skills?.soft ?? []),
        job_text ?? "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const keywords = extractKeywords(text);
      return Array.from(new Set(keywords)).slice(0, 50);
    } catch (e: any) {
      log("tool_error", "SkillsMiner.extract failed", { error: e?.message });
      return [];
    }
  },
};
