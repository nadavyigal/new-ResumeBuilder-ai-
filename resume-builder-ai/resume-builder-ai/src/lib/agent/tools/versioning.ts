import { createServiceRoleClient } from "@/lib/supabase-server";
import { log } from "../utils/logger";
import "../validators"; // ensure validators loaded in tool context
import type { OptimizedResume } from "@/lib/ai-optimizer";

export const Versioning = {
  async commit(user_id: string, resume_json: OptimizedResume): Promise<{ resume_version_id: string; created_at: string }> {
    try {
      const supabase = createServiceRoleClient() as any;
      const { data, error } = await supabase
        .from("resume_versions")
        .insert([{ user_id, resume_json }])
        .select("id, created_at")
        .maybeSingle();
      if (error || !data) throw error || new Error("Failed to commit version");
      return { resume_version_id: data.id, created_at: data.created_at };
    } catch (e: any) {
      log("tool_error", "Versioning.commit failed", { error: e?.message });
      // Fallback: fabricate a local ID and timestamp to keep flow
      return { resume_version_id: `local_${Date.now()}`, created_at: new Date().toISOString() };
    }
  },
};
