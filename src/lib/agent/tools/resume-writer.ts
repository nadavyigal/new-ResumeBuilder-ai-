import type { Diff, ProposedChange } from "../types";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { safeParseOptimizedResume, safeParseDiffs } from "../validators";
import { log } from "../utils/logger";
import { setByPointer, removeByPointer } from "../utils/json-pointer";

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getPointerFromMetadata(metadata?: Record<string, unknown>): string | undefined {
  if (!metadata) return undefined;
  const pointer = metadata["pointer"] ?? metadata["json_pointer"] ?? metadata["path"];
  return typeof pointer === "string" ? pointer : undefined;
}

function shouldRemoveChange(change: ProposedChange): boolean {
  const op = typeof change.metadata?.operation === "string" ? change.metadata.operation : undefined;
  if (op === "remove") return true;
  if (change.after === undefined || change.after === null) return true;
  if (typeof change.after === "string" && change.after.trim().length === 0) {
    return op !== "replace" && change.before !== undefined;
  }
  return false;
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

  applyProposedChanges(resume_json: OptimizedResume, changes: ProposedChange[]): OptimizedResume {
    try {
      let updated: OptimizedResume | any = clone(resume_json);
      for (const change of changes) {
        const pointer = getPointerFromMetadata(change.metadata);
        if (!pointer) {
          // Fallback: attempt textual replacement similar to applyDiff
          if (change.before && change.after) {
            updated = this.applyDiff(updated, [
              { scope: change.scope, before: change.before, after: change.after },
            ]);
          }
          continue;
        }

        try {
          if (shouldRemoveChange(change)) {
            updated = removeByPointer(updated, pointer);
          } else {
            updated = setByPointer(updated, pointer, change.after ?? "");
          }
        } catch (pointerError) {
          log("tool_error", "ResumeWriter.applyProposedChanges pointer failed", {
            error: (pointerError as Error).message,
            pointer,
            change_id: change.id,
          });
        }
      }
      return safeParseOptimizedResume(updated) as OptimizedResume;
    } catch (e: any) {
      log("tool_error", "ResumeWriter.applyProposedChanges failed", { error: e?.message });
      return safeParseOptimizedResume(resume_json) as OptimizedResume;
    }
  },
};
