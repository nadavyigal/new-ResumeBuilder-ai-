import type { AgentArtifacts, Diff } from "../types";

export function getFallbackATS(): {
  score: number;
  missing_keywords: string[];
  recommendations: string[];
} {
  return {
    score: 0,
    missing_keywords: [],
    recommendations: [
      "ATS scoring is temporarily unavailable. Please retry in a moment.",
    ],
  };
}

export function getFallbackDiffs(): Diff[] {
  return [{ scope: "style", before: "", after: "Applied safe defaults (font/color)." }];
}

export function getFallbackArtifacts(): AgentArtifacts {
  return {
    export_files: [],
    preview_pdf_path: `artifacts/preview_fallback.pdf`,
  };
}

