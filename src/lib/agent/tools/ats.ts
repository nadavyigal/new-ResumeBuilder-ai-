import { calculateMatchScore, extractKeywords } from "@/lib/ai-optimizer";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { safeParseATSReport } from "../validators";
import { getFallbackATS } from "../runtime/fallbacks";
import { log } from "../utils/logger";
import { scoreResume, extractResumeText, extractJobData } from "@/lib/ats";
import type { SubScores } from "@/lib/ats/types";
import { bucketizeText, combineBuckets, diffBuckets } from "../utils/language-buckets";
import { RTL_LANGUAGE_CODES } from "../utils/language";

interface LanguageScore {
  score: number;
  rtl: boolean;
  subscores: SubScores;
  missing_keywords: string[];
  gaps: string[];
}

function zeroSubscores(): SubScores {
  return {
    keyword_exact: 0,
    keyword_phrase: 0,
    semantic_relevance: 0,
    title_alignment: 0,
    metrics_presence: 0,
    section_completeness: 0,
    format_parseability: 0,
    recency_fit: 0,
  };
}

function buildLanguageBreakdown({
  resumeText,
  jobText,
  subscores,
}: {
  resumeText: string;
  jobText: string;
  subscores: SubScores;
}): Record<string, LanguageScore> {
  const resumeBuckets = bucketizeText(resumeText);
  const jobBuckets = bucketizeText(jobText);
  const combinedBuckets = combineBuckets(resumeBuckets, jobBuckets);
  const gaps = diffBuckets(resumeBuckets, jobBuckets);
  const breakdown: Record<string, LanguageScore> = {};

  for (const [lang] of Object.entries(combinedBuckets)) {
    const jobTokens = jobBuckets[lang] ?? new Set<string>();
    const resumeTokens = resumeBuckets[lang] ?? new Set<string>();
    const missing = new Set(gaps[lang] ?? []);
    const overlap = new Set<string>();
    for (const token of jobTokens) {
      if (resumeTokens.has(token)) {
        overlap.add(token);
      }
    }

    const score = jobTokens.size
      ? Math.round((overlap.size / jobTokens.size) * 100)
      : 0;

    breakdown[lang] = {
      score,
      rtl: RTL_LANGUAGE_CODES.has(lang),
      subscores: resumeTokens.size ? subscores : zeroSubscores(),
      missing_keywords: Array.from(missing),
      gaps: Array.from(missing),
    };
  }

  return breakdown;
}

export const ATS = {
  async score({ resume_json, job_text }: { resume_json: OptimizedResume; job_text?: string }) {
    try {
      // Try ATS v2 scoring first
      if (process.env.ENABLE_ATS_V2 !== 'false') {
        try {
          const resumeText = extractResumeText(resume_json);
          const jobData = extractJobData(job_text ?? '');

          const result = await scoreResume({
            resume_original_text: resumeText,
            resume_optimized_text: resumeText,
            job_clean_text: job_text ?? '',
            job_extracted_json: jobData,
            format_report: {
              has_tables: false,
              has_images: false,
              has_headers_footers: false,
              has_nonstandard_fonts: false,
              has_odd_glyphs: false,
              has_multi_column: false,
              format_safety_score: 85,
              issues: [],
            },
            resume_original_json: resume_json,
            resume_optimized_json: resume_json,
          });

          const keywordSuggestions = result.suggestions
            .filter((s) => s.category === 'keywords')
            .map((s) => s.text)
            .slice(0, 10);
          const recommendations = result.suggestions.slice(0, 10).map((s) => s.text);

          const languages = buildLanguageBreakdown({
            resumeText,
            jobText: job_text ?? '',
            subscores: result.subscores,
          });

          // Convert to legacy format for compatibility
          return safeParseATSReport({
            score: result.ats_score_optimized,
            missing_keywords: keywordSuggestions,
            recommendations,
            languages,
          });
        } catch (v2Error) {
          log("tool_error", "ATS v2 scoring failed, falling back to v1", { error: (v2Error as Error).message });
          // Fall through to v1 scoring
        }
      }

      // Fallback to legacy v1 scoring
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
      const recommendations = missing_keywords.slice(0, 10).map((k) => `Consider adding keyword: ${k}`);
      const languages = buildLanguageBreakdown({
        resumeText,
        jobText: job_text ?? '',
        subscores: zeroSubscores(),
      });
      return safeParseATSReport({ score, missing_keywords, recommendations, languages });
    } catch (e: any) {
      log("tool_error", "ATS.score failed", { error: e?.message });
      return getFallbackATS();
    }
  },
};
