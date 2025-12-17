import OpenAI from "openai";
import type { Intent } from "./types";

const INTENT_REGEX: Array<{ intent: Intent; pattern: RegExp }> = [
  { intent: "tip_implementation", pattern: /(implement|apply|use|do)\s+tip[s]?\s+(?:number\s+|#\s*)?\d+/i },
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
    const prompt = `Classify this resume-edit command into one intent: rewrite | add_skills | design | layout | ats_optimize | export | undo | redo | compare | save_history. Reply with just the label.\n\nCommand: ${command}`;
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 5,
      messages: [
        { role: "system", content: "You return only one word from the provided labels." },
        { role: "user", content: prompt },
      ],
    });
    const label = resp.choices?.[0]?.message?.content?.trim().toLowerCase();
    const intents: Intent[] = [
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

