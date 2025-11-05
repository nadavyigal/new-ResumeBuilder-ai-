import OpenAI from "openai";
import type { Intent } from "./types";

type IntentSource = "user" | "automation" | "integration";

export interface IntentMetadata {
  id: Intent;
  label: string;
  description: string;
  source: IntentSource;
}

export const INTENT_METADATA: Record<Intent, IntentMetadata> = Object.freeze({
  rewrite: {
    id: "rewrite",
    label: "Rewrite resume",
    description: "Rewrite or strengthen resume content for clarity and impact.",
    source: "user",
  },
  add_skills: {
    id: "add_skills",
    label: "Add skills",
    description: "Include additional skills or keywords in the resume.",
    source: "user",
  },
  design: {
    id: "design",
    label: "Adjust design",
    description: "Tweak visual design elements like fonts, colors, or styles.",
    source: "user",
  },
  layout: {
    id: "layout",
    label: "Modify layout",
    description: "Change resume layout, spacing, or density preferences.",
    source: "user",
  },
  ats_optimize: {
    id: "ats_optimize",
    label: "ATS optimize",
    description: "Optimize resume content for applicant tracking systems.",
    source: "user",
  },
  export: {
    id: "export",
    label: "Export resume",
    description: "Generate downloadable resume files like PDF or DOCX.",
    source: "user",
  },
  undo: {
    id: "undo",
    label: "Undo change",
    description: "Revert the most recent resume change.",
    source: "user",
  },
  redo: {
    id: "redo",
    label: "Redo change",
    description: "Reapply the most recently undone change.",
    source: "user",
  },
  compare: {
    id: "compare",
    label: "Compare versions",
    description: "Compare resume versions to review differences.",
    source: "user",
  },
  save_history: {
    id: "save_history",
    label: "Save history",
    description: "Store the current resume progress in history.",
    source: "automation",
  },
  "resume.guide.optimize": {
    id: "resume.guide.optimize",
    label: "Resume Guide optimize",
    description: "Trigger optimization workflow from Resume Guide integrations.",
    source: "integration",
  },
});

const INTENT_REGEX: Array<{ intent: Intent; pattern: RegExp }> = [
  { intent: "add_skills", pattern: /(add|include)\s+skills?/i },
  { intent: "rewrite", pattern: /(rewrite|strengthen|improve)\b/i },
  { intent: "design", pattern: /(font|color|theme|style)\b/i },
  { intent: "layout", pattern: /layout|spacing|density/i },
  { intent: "ats_optimize", pattern: /optimi[sz]e\b|ats/i },
  { intent: "export", pattern: /export|download|pdf|docx/i },
  { intent: "undo", pattern: /\bundo\b/i },
  { intent: "redo", pattern: /\bredo\b/i },
  { intent: "compare", pattern: /compare|diff/i },
  { intent: "save_history", pattern: /save(\s+to)?\s+history/i },
  { intent: "resume.guide.optimize", pattern: /resume\.guide\.optimize/i },
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
    const prompt = `Classify this resume-edit command into one intent: rewrite | add_skills | design | layout | ats_optimize | export | undo | redo | compare | save_history | resume.guide.optimize. Reply with just the label.\n\nCommand: ${command}`;
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
      "export",
      "undo",
      "redo",
      "compare",
      "save_history",
      "resume.guide.optimize",
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

