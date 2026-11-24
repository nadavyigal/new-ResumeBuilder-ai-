import OpenAI from "openai";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { adaptChatParams, logModelUsage, readUsage, selectModel } from "@/lib/model-tiers";

/**
 * Lightweight LLM planner: suggests tool actions for a given command.
 * This enhances the agent with OpenAI while keeping execution local and deterministic.
 */
export async function planWithLLM(params: {
  command: string;
  resume?: OptimizedResume;
  job_text?: string;
}): Promise<{ tool: string; args: Record<string, any>; rationale: string }[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const openai = new OpenAI({ apiKey });
  const sys = `You plan resume-edit actions as JSON array of {tool,args,rationale}. Tools: JobLinkScraper.getJob, ResumeParser.parse, ResumeWriter.applyDiff, DesignOps.theme, LayoutEngine.render, SkillsMiner.extract, ATS.score, HistoryStore.save, Versioning.commit.`;
  const user = `Command: ${params.command}\nReturn 2-5 concise actions. Avoid chain-of-thought.`;
  try {
    // WRITER tier, not FAST: on gpt-6-luna this prompt returns a single action
    // object instead of an array at every effort (0/8 in the 2026-11-23 smoke);
    // gpt-6.1-terra returns the array (3/3). Prompt unchanged; tuning is a follow-up.
    const selection = selectModel("WRITER", "gpt-4o-mini");
    const startedAt = Date.now();
    const resp = await openai.chat.completions.create(adaptChatParams(selection, {
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }));
    logModelUsage("agent.llmPlanner", selection, readUsage(resp.usage), Date.now() - startedAt);
    const content = resp.choices?.[0]?.message?.content;
    if (!content) return [];
    const json = JSON.parse(content);
    const actions = Array.isArray(json) ? json : json.actions;
    if (!Array.isArray(actions)) return [];
    return actions
      .slice(0, 5)
      .map((a) => ({ tool: String(a.tool), args: a.args || {}, rationale: String(a.rationale || "") }));
  } catch {
    return [];
  }
}

