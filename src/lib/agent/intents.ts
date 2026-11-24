import OpenAI from "openai";
import type { Intent } from "./types";
import { adaptChatParams, isReasoningModel, logModelUsage, readUsage, selectModel } from "@/lib/model-tiers";

const INTENT_REGEX: Array<{ intent: Intent; pattern: RegExp }> = [
  { intent: "tip_implementation", pattern: /(implement|apply|use|do)\s+tip[s]?\s+(?:number\s+|#\s*)?\d+/i },
  { intent: "expert_rewrite", pattern: /(run|do|start|create|generate)\s+(?:an?\s+)?(?:expert\s+)?(?:resume\s+)?rewrite/i },
  { intent: "expert_quantifier", pattern: /(quantify|quantifier|quantification|achievement[s]?\s+quantif)/i },
  { intent: "expert_ats_report", pattern: /(generate|create|run)\s+(?:an?\s+)?(?:expert\s+)?ats\s+(?:optimization\s+)?report/i },
  { intent: "expert_summary_lab", pattern: /(create|generate|write)\s+(?:5|five)\s+(?:professional\s+)?summar(?:y|ies)|summary\s+lab/i },
  { intent: "color_customization", pattern: /(change|make|set|update)\s+(?:the\s+)?(?:background|header[s]?|text|font|primary|accent)\s+(?:color\s+)?(?:to\s+)?/i },
  { intent: "add_skills", pattern: /(add|include)\s+skills?/i },
  { intent: "rewrite", pattern: /(rewrite|strengthen|improve)\b/i },
  { intent: "design", pattern: /(font|theme|style)\b/i },
  { intent: "layout", pattern: /layout|spacing|density/i },
  { intent: "ats_optimize", pattern: /\bats\b|\bats[ _-]?optimi[sz]e\b/i },
  { intent: "optimize", pattern: /\bresume\.?guide\.?optimi[sz]e\b|\boptimi[sz]e\b/i },
  { intent: "export", pattern: /export|download|pdf|docx/i },
  { intent: "undo", pattern: /\bundo\b/i },
  { intent: "redo", pattern: /\bredo\b/i },
  { intent: "compare", pattern: /compare|diff/i },
  { intent: "save_history", pattern: /save(\s+to)?\s+history/i },
];

export function detectIntentRegex(command: string): Intent | null {
  for (const item of INTENT_REGEX) {
    if (item.pattern.test(command)) return item.intent;
  }
  return null;
}

export async function classifyIntentLLM(command: string): Promise<Intent | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const openai = new OpenAI({ apiKey });
    // Lightweight classification; keep cost minimal
    const prompt = `Classify this resume-edit command into one intent: expert_rewrite | expert_quantifier | expert_ats_report | expert_summary_lab | rewrite | add_skills | design | layout | ats_optimize | optimize | export | undo | redo | compare | save_history. Reply with just the label.\n\nCommand: ${command}`;
    // Reasoning models (smoke-tested 2026-11-23 on gpt-6-luna): at effort "low" the
    // 5-token budget goes to reasoning and the label is empty, so effort is "none".
    // Their tokenizer also needs more than 5 tokens for labels such as
    // "add_skills" (cut to "add_sk"), so they get 16. gpt-4o-mini keeps 5.
    const selection = selectModel("FAST", "gpt-4o-mini", "none");
    const startedAt = Date.now();
    const resp = await openai.chat.completions.create(adaptChatParams(selection, {
      temperature: 0,
      max_tokens: isReasoningModel(selection.model) ? 16 : 5,
      messages: [
        { role: "system", content: "You return only one word from the provided labels." },
        { role: "user", content: prompt },
      ],
    }));
    logModelUsage("agent.classifyIntent", selection, readUsage(resp.usage), Date.now() - startedAt);
    const label = resp.choices?.[0]?.message?.content?.trim().toLowerCase();
    const intents: Intent[] = [
      "expert_rewrite",
      "expert_quantifier",
      "expert_ats_report",
      "expert_summary_lab",
      "rewrite",
      "add_skills",
      "design",
      "layout",
      "ats_optimize",
      "optimize",
      "export",
      "undo",
      "redo",
      "compare",
      "save_history",
    ];
    const match = intents.find((i) => i === label);
    return match ?? null;
  } catch {
    return null;
  }
}

export async function detectIntent(command: string): Promise<Intent> {
  const viaRegex = detectIntentRegex(command);
  if (viaRegex) return viaRegex;
  const viaLLM = await classifyIntentLLM(command);
  return viaLLM ?? "rewrite"; // sensible default
}

