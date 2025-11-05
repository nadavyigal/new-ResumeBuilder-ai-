import type { OptimizedResume } from "@/lib/ai-optimizer";
import { extractKeywords } from "@/lib/ai-optimizer";
import { bucketizeText, combineBuckets, diffBuckets } from "../utils/language-buckets";
import { log } from "../utils/logger";
import "../validators"; // ensure validators loaded in tool context

export interface SkillsMinerResult {
  keywords: string[];
  languages: Record<
    string,
    {
      resume: string[];
      job: string[];
      gaps: string[];
    }
  >;
}

export const SkillsMiner = {
  extract({ resume_json, job_text }: { resume_json?: OptimizedResume; job_text?: string }): SkillsMinerResult {
    try {
      const resumeText = [
        resume_json?.summary,
        ...(resume_json?.skills?.technical ?? []),
        ...(resume_json?.skills?.soft ?? []),
        ...(resume_json?.experience ?? []).flatMap((exp) => exp.achievements ?? []),
      ]
        .filter(Boolean)
        .join("\n\n");

      const resumeBuckets = bucketizeText(resumeText);
      const resumeKeywords = new Set(extractKeywords(resumeText));
      const resumeOther = resumeBuckets["other"] ?? new Set<string>();
      for (const token of resumeOther) {
        resumeKeywords.add(token);
      }
      const jobKeywords = new Set(extractKeywords(job_text ?? ""));

      const jobBuckets = bucketizeText(job_text ?? "");
      const combined = combineBuckets(resumeBuckets, jobBuckets);
      const languageGaps = diffBuckets(resumeBuckets, jobBuckets);

      const languages: SkillsMinerResult["languages"] = {};
      for (const [lang] of Object.entries(combined)) {
        languages[lang] = {
          resume: Array.from(resumeBuckets[lang] ?? []),
          job: Array.from(jobBuckets[lang] ?? []),
          gaps: languageGaps[lang] ?? [],
        };
      }

      const keywords = Array.from(new Set([...resumeKeywords, ...jobKeywords])).slice(0, 100);
      return { keywords, languages };
    } catch (e: any) {
      log("tool_error", "SkillsMiner.extract failed", { error: e?.message });
      return { keywords: [], languages: {} };
    }
  },
};
