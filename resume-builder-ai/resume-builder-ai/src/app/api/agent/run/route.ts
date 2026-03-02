import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { AgentRuntime } from "@/lib/agent";
import { log } from "@/lib/agent/utils/logger";
import { agentFlags } from "@/lib/agent/config";
import { optimizeResume } from "@/lib/ai-optimizer";
import { ATS } from "@/lib/agent/tools/ats";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const command = String(body.command || "");

    // Gate by flags: disabled and not shadow => 501
    if (!agentFlags.enabled && !agentFlags.shadow) {
      return NextResponse.json({ error: "Agent SDK disabled" }, { status: 501 });
    }

    // Shadow mode: return legacy response, run agent in background
    if (agentFlags.shadow && !agentFlags.enabled) {
      // Legacy: use ai-optimizer to produce an optimized resume (no schema or DB coupling)
      const resumeText = typeof body.resume_text === 'string' ? body.resume_text : (body.resume_json?.summary ?? "");
      const jobText = body.job_text ?? "";
      const legacy = await optimizeResume(resumeText, jobText);

      // Compute baseline ATS (before agent)
      const beforeATS = (() => {
        try {
          if (!body.resume_json) return 0;
          return ATS.score({ resume_json: body.resume_json, job_text: jobText }).score;
        } catch { return 0; }
      })();

      // Fire-and-forget agent run
      const runtime = new AgentRuntime();
      runtime.run({
        userId: user.id,
        command,
        resume_file_path: body.resume_file_path,
        resume_json: body.resume_json,
        job_url: body.job_url,
        job_text: body.job_text,
        design: body.design,
      })
        .then(async (agentResult) => {
          try {
            // Compute metrics and log into agent_shadow_logs
            const afterATS = agentResult.ats_report?.score ?? null;
            const diffCount = agentResult.diffs?.length ?? 0;
            const warnings = agentResult.ui_prompts ?? [];
            await supabase
              .from('agent_shadow_logs')
              .insert([
                {
                  user_id: user.id,
                  intent: [agentResult.intent],
                  ats_before: beforeATS,
                  ats_after: afterATS,
                  diff_count: diffCount,
                  warnings,
                },
              ]);
          } catch (e: any) {
            log('tool_error', 'shadow logging failed', { error: e?.message });
          }
        })
        .catch((e: any) => log('tool_error', 'background agent run failed', { error: e?.message }));

      log("agent_run", "shadow mode responded with legacy optimizer", { userId: user.id });
      return NextResponse.json({
        shadow: true,
        legacy: legacy,
      });
    }

    // Enabled path: return AgentResult
    const runtime = new AgentRuntime();
    const result = await runtime.run({
      userId: user.id,
      command,
      resume_file_path: body.resume_file_path,
      resume_json: body.resume_json,
      job_url: body.job_url,
      job_text: body.job_text,
      design: body.design,
    });
    log("agent_run", "agent run completed", { userId: user.id, intent: result.intent });
    return NextResponse.json(result);
  } catch (e: any) {
    log("tool_error", "agent run crashed", { error: e?.message });
    return NextResponse.json({ error: e?.message || "Agent error" }, { status: 500 });
  }
}
