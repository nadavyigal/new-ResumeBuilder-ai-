import { calculateMatchScore, extractKeywords } from "@/lib/ai-optimizer";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { safeParseATSReport } from "../validators";
import { getFallbackATS } from "../runtime/fallbacks";
import { log } from "../utils/logger";

export const ATS = {
  score({ resume_json, job_text }: { resume_json: OptimizedResume; job_text?: string }) {
    try {
      const resumeText = [
      resume_json.summary,
      resume_json.skills?.technical?.join(", ") ?? "",
      resume_json.skills?.soft?.join(", ") ?? "",
      ...resume_json.experience.flatMap((e) => [e.title, e.company, ...e.achievements]),
    ]
        .filter(Boolean)
        .join("\n");

      const score = calculateMatchScore(resumeText, job_text ?? "");
      const missing_keywords: string[] = [];
      const jdKeywords = new Set(extractKeywords(job_text ?? ""));
      const present = new Set(extractKeywords(resumeText));
      for (const kw of jdKeywords) {
        if (!present.has(kw)) missing_keywords.push(kw);
      }
      const recommendations = missing_keywords
        .slice(0, 10)
        .map((k) => `Add "${k}" where it truthfully fits (Skills, Summary, or a relevant achievement).`);
      return safeParseATSReport({ score, missing_keywords, recommendations });
    } catch (e: any) {
      log("tool_error", "ATS.score failed", { error: e?.message });
      return getFallbackATS();
    }
  },
};
