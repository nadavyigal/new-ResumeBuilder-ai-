import OpenAI from "openai";
import type { OptimizedResume } from "@/lib/ai-optimizer";

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
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
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

