import { createServiceRoleClient } from "@/lib/supabase-server";
import { log } from "../utils/logger";
import "../validators"; // ensure validators loaded in tool context

export const HistoryStore = {
  async save(params: {
    user_id: string;
    resume_version_id: string;
    job?: any;
    ats_score?: number;
    artifacts?: any[];
    notes?: string;
  }): Promise<{ id: string; created_at: string }> {
    try {
      const supabase = createServiceRoleClient() as any;
      const { data, error } = await supabase
        .from("history")
        .insert([
          {
            user_id: params.user_id,
            resume_version_id: params.resume_version_id,
            job: params.job ?? null,
            ats_score: params.ats_score ?? null,
            artifacts: params.artifacts ?? null,
            notes: params.notes ?? null,
          },
        ])
        .select("id, created_at")
        .maybeSingle();
      if (error || !data) throw error || new Error("Failed to save history");
      return { id: data.id, created_at: data.created_at };
    } catch (e: any) {
      log("tool_error", "HistoryStore.save failed", { error: e?.message });
      return { id: `local_hist_${Date.now()}`, created_at: new Date().toISOString() };
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
};
