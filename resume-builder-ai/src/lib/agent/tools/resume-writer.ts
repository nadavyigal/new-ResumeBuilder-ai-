import type { Diff } from "../types";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { safeParseOptimizedResume, safeParseDiffs } from "../validators";
import { log } from "../utils/logger";

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const ResumeWriter = {
  applyDiff(resume_json: OptimizedResume, diffs: Diff[]): OptimizedResume {
    try {
      const updated = clone(resume_json);
      const safeDiffs = safeParseDiffs(diffs);
      for (const d of safeDiffs) {
        if (d.scope === "paragraph" || d.scope === "section" || d.scope === "bullet") {
          // Very simple text replacement for v1
          if (updated.summary && d.before && updated.summary.includes(d.before)) {
            updated.summary = updated.summary.replace(d.before, d.after);
          }
          // Apply to achievements too
          updated.experience = updated.experience.map((exp) => ({
            ...exp,
            achievements: exp.achievements.map((a) => (a.includes(d.before) ? a.replace(d.before, d.after) : a)),
          }));
        }
        // style/layout diffs are handled in design ops/layout pipeline; we keep as metadata only
      }
      return safeParseOptimizedResume(updated) as OptimizedResume;
    } catch (e: any) {
      log("tool_error", "ResumeWriter.applyDiff failed", { error: e?.message });
      return safeParseOptimizedResume(resume_json) as OptimizedResume;
    }
  },
};
