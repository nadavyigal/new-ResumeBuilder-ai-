import { LanguageDetection } from "../types";

export interface DetectLanguageModelResult {
  lang?: string;
  confidence?: number;
  rtl?: boolean;
}

export type DetectLanguageModel = (input: {
  text: string;
  signal?: AbortSignal;
}) => Promise<DetectLanguageModelResult | null>;

export interface DetectLanguageOptions {
  callModel?: DetectLanguageModel;
  preferModel?: boolean;
  minConfidenceForModel?: number;
  defaultLanguage?: string;
  signal?: AbortSignal;
}

const DEFAULT_LANGUAGE = "en";

const RTL_LANGUAGE_CODES = new Set(["ar", "he", "fa", "ur"]);

const LANGUAGE_RULES: Array<{
  code: string;
  pattern: RegExp;
  rtl?: boolean;
}> = [
  { code: "he", pattern: /[\u0590-\u05FF]/g, rtl: true },
  { code: "ar", pattern: /[\u0600-\u06FF]/g, rtl: true },
  { code: "fa", pattern: /[\u0750-\u077F\u08A0-\u08FF]/g, rtl: true },
  { code: "ru", pattern: /[\u0400-\u04FF]/g },
  { code: "es", pattern: /[áéíóúñüÁÉÍÓÚÑÜ]/g },
  { code: "en", pattern: /[A-Za-z]/g },
];

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function heuristicDetection(
  text: string,
  defaultLanguage: string
): LanguageDetection {
  const sanitized = text.trim();
  if (!sanitized) {
    return {
      lang: defaultLanguage,
      confidence: 0,
      rtl: RTL_LANGUAGE_CODES.has(defaultLanguage),
      source: "heuristic",
    };
  }

  const letterMatches = sanitized.match(/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g);
  const totalLetters = letterMatches ? letterMatches.length : 0;

  if (!totalLetters) {
    return {
      lang: defaultLanguage,
      confidence: 0.2,
      rtl: RTL_LANGUAGE_CODES.has(defaultLanguage),
      source: "heuristic",
    };
  }

  const counts = new Map<string, number>();
  for (const rule of LANGUAGE_RULES) {
    const count = countMatches(sanitized, rule.pattern);
    if (count > 0) {
      counts.set(rule.code, count);
    }
  }

  if (!counts.size) {
    return {
      lang: defaultLanguage,
      confidence: 0.25,
      rtl: RTL_LANGUAGE_CODES.has(defaultLanguage),
      source: "heuristic",
    };
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const [primaryCode, primaryCount] = ranked[0];
  const primaryRatio = primaryCount / totalLetters;
  const secondEntry = ranked[1];
  const secondaryRatio = secondEntry ? secondEntry[1] / totalLetters : 0;

  const likelyMixed =
    secondEntry &&
    secondaryRatio >= 0.25 &&
    Math.abs(primaryRatio - secondaryRatio) <= 0.2;

  let lang = likelyMixed ? "mixed" : primaryCode;
  let rtl =
    likelyMixed
      ? ranked
          .slice(0, 2)
          .some(([code]) => RTL_LANGUAGE_CODES.has(code))
      : RTL_LANGUAGE_CODES.has(primaryCode);

  let confidence: number;
  if (likelyMixed) {
    confidence = clamp((primaryRatio + secondaryRatio) / 1.5, 0.4, 0.65);
  } else if (primaryRatio >= 0.75) {
    confidence = 0.92;
  } else if (primaryRatio >= 0.55) {
    confidence = 0.78;
  } else if (primaryRatio >= 0.35) {
    confidence = 0.62;
  } else {
    confidence = 0.45;
  }

  if (totalLetters < 6) {
    confidence = Math.min(confidence, 0.6);
  }

  return {
    lang,
    confidence,
    rtl,
    source: "heuristic",
  };
}

export async function detectLanguage(
  rawText: string,
  options: DetectLanguageOptions = {}
): Promise<LanguageDetection> {
  const text = rawText ?? "";
  const defaultLanguage = options.defaultLanguage ?? DEFAULT_LANGUAGE;
  const heuristic = heuristicDetection(text, defaultLanguage);

  if (!options.callModel) {
    return heuristic;
  }

  const threshold = clamp(
    options.minConfidenceForModel ?? 0.75,
    0,
    1
  );
  const shouldCallModel = options.preferModel || heuristic.confidence < threshold;

  if (!shouldCallModel) {
    return heuristic;
  }

  try {
    const modelResult = await options.callModel({
      text,
      signal: options.signal,
    });
    if (modelResult && modelResult.lang) {
      const lang = modelResult.lang.toLowerCase();
      const confidence = clamp(
        modelResult.confidence ?? heuristic.confidence,
        heuristic.confidence,
        1
      );
      const rtl =
        typeof modelResult.rtl === "boolean"
          ? modelResult.rtl
          : RTL_LANGUAGE_CODES.has(lang);
      return {
        lang,
        confidence,
        rtl,
        source: "model",
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("detectLanguage model call failed", error);
    }
  }

  return heuristic;
}

export { RTL_LANGUAGE_CODES };
