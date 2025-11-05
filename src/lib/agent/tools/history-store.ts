import { createServiceRoleClient } from "@/lib/supabase-server";
import { log } from "../utils/logger";
import "../validators"; // ensure validators loaded in tool context
import type { Diff, ProposedChange } from "../types";

interface HistoryEntry {
  id: string;
  created_at: string;
  user_id: string;
  resume_version_id: string;
  job?: any;
  ats_score?: number;
  artifacts?: any[];
  notes?: string;
  diffs?: Diff[];
  proposed_changes?: ProposedChange[];
}

interface HistoryTransition {
  current: HistoryEntry | null;
  moved?: HistoryEntry | null;
}

const timelines = new Map<string, { past: HistoryEntry[]; future: HistoryEntry[] }>();

function ensureTimeline(userId: string) {
  if (!timelines.has(userId)) {
    timelines.set(userId, { past: [], future: [] });
  }
  return timelines.get(userId)!;
}

function recordLocalHistory(userId: string, entry: HistoryEntry) {
  const timeline = ensureTimeline(userId);
  timeline.past.push(entry);
  timeline.future = [];
}

function moveToFuture(userId: string): HistoryTransition {
  const timeline = ensureTimeline(userId);
  const moved = timeline.past.pop() ?? null;
  if (moved) {
    timeline.future.push(moved);
  }
  const current = timeline.past[timeline.past.length - 1] ?? null;
  return { current, moved };
}

function moveFromFuture(userId: string): HistoryTransition {
  const timeline = ensureTimeline(userId);
  const moved = timeline.future.pop() ?? null;
  if (moved) {
    timeline.past.push(moved);
  }
  const current = timeline.past[timeline.past.length - 1] ?? null;
  return { current, moved };
}

function buildEntry(params: {
  id: string;
  created_at: string;
  user_id: string;
  resume_version_id: string;
  job?: any;
  ats_score?: number;
  artifacts?: any[];
  notes?: string;
  diffs?: Diff[];
  proposed_changes?: ProposedChange[];
}): HistoryEntry {
  return {
    id: params.id,
    created_at: params.created_at,
    user_id: params.user_id,
    resume_version_id: params.resume_version_id,
    job: params.job,
    ats_score: params.ats_score,
    artifacts: params.artifacts,
    notes: params.notes,
    diffs: params.diffs,
    proposed_changes: params.proposed_changes,
  };
}

export const HistoryStore = {
  async save(params: {
    user_id: string;
    resume_version_id: string;
    job?: any;
    ats_score?: number;
    artifacts?: any[];
    notes?: string;
    diffs?: Diff[];
    proposed_changes?: ProposedChange[];
  }): Promise<HistoryEntry> {
    try {
      const supabase = createServiceRoleClient() as any;
      const payload = {
        user_id: params.user_id,
        resume_version_id: params.resume_version_id,
        job: params.job ?? null,
        ats_score: params.ats_score ?? null,
        artifacts: params.artifacts ?? null,
        notes: params.notes ?? null,
      };
      const { data, error } = await supabase
        .from("history")
        .insert([payload])
        .select("id, created_at")
        .maybeSingle();
      if (error || !data) throw error || new Error("Failed to save history");
      const entry = buildEntry({
        id: data.id,
        created_at: data.created_at,
        user_id: params.user_id,
        resume_version_id: params.resume_version_id,
        job: params.job,
        ats_score: params.ats_score,
        artifacts: params.artifacts,
        notes: params.notes,
        diffs: params.diffs,
        proposed_changes: params.proposed_changes,
      });
      recordLocalHistory(params.user_id, entry);
      return entry;
    } catch (e: any) {
      log("tool_error", "HistoryStore.save failed", { error: e?.message });
      const entry = buildEntry({
        id: `local_hist_${Date.now()}`,
        created_at: new Date().toISOString(),
        user_id: params.user_id,
        resume_version_id: params.resume_version_id,
        job: params.job,
        ats_score: params.ats_score,
        artifacts: params.artifacts,
        notes: params.notes,
        diffs: params.diffs,
        proposed_changes: params.proposed_changes,
      });
      recordLocalHistory(params.user_id, entry);
      return entry;
    }
  },

  async linkApply(params: { history_id: string; apply_date: string }) {
    try {
      const supabase = createServiceRoleClient() as any;
      const { data, error } = await supabase
        .from("history")
        .update({ apply_date: params.apply_date })
        .eq("id", params.history_id)
        .select("id, apply_date")
        .maybeSingle();
      if (error || !data) throw error || new Error("Failed to link apply date");
      return data;
    } catch (e: any) {
      log("tool_error", "HistoryStore.linkApply failed", { error: e?.message });
      return { id: params.history_id, apply_date: params.apply_date } as any;
    }
  },

  async undo(user_id: string): Promise<HistoryTransition> {
    return moveToFuture(user_id);
  },

  async redo(user_id: string): Promise<HistoryTransition> {
    return moveFromFuture(user_id);
  },

  getTimeline(user_id: string): { past: HistoryEntry[]; future: HistoryEntry[] } {
    const timeline = ensureTimeline(user_id);
    return {
      past: [...timeline.past],
      future: [...timeline.future],
    };
  },

  clearTimeline(user_id: string) {
    timelines.set(user_id, { past: [], future: [] });
  },
};
