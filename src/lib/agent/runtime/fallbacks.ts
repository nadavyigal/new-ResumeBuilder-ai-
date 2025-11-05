import type { AgentArtifacts, Diff } from "../types";

export function getFallbackATS() {
  return {
    score: 0,
    missing_keywords: [],
    recommendations: [
      "We could not compute ATS score due to a transient issue. Try again shortly.",
    ],
    languages: {},
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

