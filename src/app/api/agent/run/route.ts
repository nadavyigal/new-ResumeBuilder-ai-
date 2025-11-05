import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { AgentRuntime } from "@/lib/agent";
import { log } from "@/lib/agent/utils/logger";
import { AGENT_SDK_ENABLED, AGENT_SDK_SHADOW } from "@/lib/agent/config";
import { optimizeResume } from "@/lib/ai-optimizer";
import { ATS } from "@/lib/agent/tools/ats";
import { JobLinkScraper } from "@/lib/agent/tools/job-link-scraper";
import { detectLanguage } from "@/lib/agent/utils/language";
import { safeParseATSReport, safeParseOptimizedResume } from "@/lib/agent/validators";
import {
  CoachingFocusArea,
  CoachingTone,
  ProposedChangeCategory,
  type CoachingPayload,
  type LanguageDetection,
  type ProposedChange,
} from "@/lib/agent/types";
import { extractResumeText } from "@/lib/ats";
import { getFallbackATS } from "@/lib/agent/runtime/fallbacks";

const TEXT_TEMPLATES = {
  en: {
    headline: "ATS Coaching Summary",
    guidance_primary: "Your current ATS match score is {score}%. Focus updates to reach at least 75%.",
    guidance_keywords: "Weave the missing keywords naturally into high-impact bullets.",
    guidance_metrics: "Quantify achievements with clear metrics to build credibility.",
    guidance_format: "Keep formatting consistent so parsers and recruiters scan quickly.",
    summary_keyword: "Add keyword \"{keyword}\" to mirror the job posting",
    rationale_keyword: "Including \"{keyword}\" signals alignment with the requirements and increases keyword coverage.",
    summary_metrics: "Quantify recent accomplishments with measurable outcomes",
    rationale_metrics: "Metrics-backed bullets improve recruiter confidence and raise semantic and metrics subscores.",
    summary_summary: "Refresh the professional summary to highlight role fit",
    rationale_summary: "Tie your headline to the employer's priorities so relevance is immediately clear.",
    summary_format: "Tighten formatting for consistent spacing and hierarchy",
    rationale_format: "Consistent layout reduces parsing risk and keeps the document skimmable.",
    summary_review: "Spot-check leadership and collaboration stories for clarity",
    rationale_review: "Clarifying leadership outcomes reassures hiring managers and can lift qualitative subscores.",
  },
  es: {
    headline: "Resumen de coaching ATS",
    guidance_primary: "Tu puntaje de coincidencia ATS actual es {score}%. Realiza ajustes puntuales para acercarte al 75%.",
    guidance_keywords: "Integra las palabras clave faltantes de forma natural en tus logros más fuertes.",
    guidance_metrics: "Cuantifica los logros con métricas claras para aumentar la credibilidad.",
    guidance_format: "Mantén un formato coherente para que los reclutadores y el ATS lo analicen con facilidad.",
    summary_keyword: "Agrega la palabra clave \"{keyword}\" para alinearte con la vacante",
    rationale_keyword: "Incluir \"{keyword}\" demuestra alineación con los requisitos y mejora la cobertura de palabras clave.",
    summary_metrics: "Cuantifica los logros recientes con resultados medibles",
    rationale_metrics: "Las viñetas con métricas elevan la confianza del reclutador y mejoran las subpuntuaciones de impacto.",
    summary_summary: "Actualiza el resumen profesional para resaltar el ajuste con el rol",
    rationale_summary: "Conecta tu titular con las prioridades de la empresa para aumentar la relevancia inmediata.",
    summary_format: "Ajusta el formato para conservar la coherencia entre secciones",
    rationale_format: "Un formato consistente reduce riesgos de parseo y facilita una lectura ágil.",
    summary_review: "Revisa ejemplos de liderazgo y colaboración para mayor claridad",
    rationale_review: "Aportar resultados claros de liderazgo genera confianza y puede elevar las subpuntuaciones cualitativas.",
  },
} as const;

type SupportedLanguage = keyof typeof TEXT_TEMPLATES;

function formatTemplate(template: string, params: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}

function getTranslator(langCode: string) {
  const normalized = (langCode || "en").toLowerCase();
  const key: SupportedLanguage = normalized.startsWith("es") ? "es" : "en";
  const strings = TEXT_TEMPLATES[key];
  return (token: keyof typeof strings, params?: Record<string, string | number>) =>
    formatTemplate(strings[token], params);
}

function sanitizeJobText(text?: string | null): string | undefined {
  if (!text) return undefined;
  const cleaned = text
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\t+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ +/g, " ")
    .trim();
  return cleaned || undefined;
}

function createProposedChange(options: {
  summary: string;
  rationale: string;
  category: ProposedChangeCategory;
  scope: "section" | "paragraph" | "bullet" | "style" | "layout";
  confidence: "low" | "medium" | "high";
  priority: number;
  risk: "low" | "medium" | "high";
  atsDelta: number;
  tags?: string[];
  requiresReview?: boolean;
}): ProposedChange {
  return {
    id: randomUUID(),
    summary: options.summary,
    scope: options.scope,
    category: options.category,
    confidence: options.confidence,
    rationale: options.rationale,
    requires_human_review: options.requiresReview,
    tags: options.tags,
    metadata: {
      priority: options.priority,
      risk: options.risk,
      ats_delta: { estimated: options.atsDelta },
    },
  };
}

function buildProposedChanges(params: {
  atsReport: ReturnType<typeof safeParseATSReport>;
  language: LanguageDetection;
}): ProposedChange[] {
  const translator = getTranslator(params.language.lang);
  const keywordSuggestions = (params.atsReport.missing_keywords || []).slice(0, 2);

  const base: ProposedChange[] = [
    createProposedChange({
      summary: translator("summary_metrics"),
      rationale: translator("rationale_metrics"),
      category: ProposedChangeCategory.Content,
      scope: "bullet",
      confidence: "medium",
      priority: 100,
      risk: "medium",
      atsDelta: 6,
      tags: ["metrics"],
    }),
    createProposedChange({
      summary: translator("summary_summary"),
      rationale: translator("rationale_summary"),
      category: ProposedChangeCategory.Content,
      scope: "section",
      confidence: "medium",
      priority: 200,
      risk: "low",
      atsDelta: 4,
      tags: ["summary"],
    }),
    createProposedChange({
      summary: translator("summary_format"),
      rationale: translator("rationale_format"),
      category: ProposedChangeCategory.Formatting,
      scope: "style",
      confidence: "high",
      priority: 300,
      risk: "low",
      atsDelta: 3,
      tags: ["formatting"],
    }),
    createProposedChange({
      summary: translator("summary_review"),
      rationale: translator("rationale_review"),
      category: ProposedChangeCategory.DataQuality,
      scope: "paragraph",
      confidence: "medium",
      priority: 400,
      risk: "medium",
      atsDelta: 2,
      tags: ["storytelling"],
      requiresReview: true,
    }),
  ];

  const keywordChanges = keywordSuggestions.map((keyword, index) =>
    createProposedChange({
      summary: translator("summary_keyword", { keyword }),
      rationale: translator("rationale_keyword", { keyword }),
      category: ProposedChangeCategory.Content,
      scope: "paragraph",
      confidence: "high",
      priority: 10 * (index + 1),
      risk: "low",
      atsDelta: 4 - index,
      tags: ["keywords"],
    })
  );

  const combined = [...keywordChanges, ...base]
    .slice(0, 6)
    .map((change, index) => ({
      ...change,
      metadata: {
        ...change.metadata,
        priority: index + 1,
      },
    }));

  if (combined.length < 4) {
    return combined.concat(
      createProposedChange({
        summary: translator("summary_format"),
        rationale: translator("rationale_format"),
        category: ProposedChangeCategory.Formatting,
        scope: "style",
        confidence: "high",
        priority: combined.length + 1,
        risk: "low",
        atsDelta: 2,
        tags: ["formatting"],
      })
    );
  }

  return combined;
}

function buildCoachingPayload(params: {
  atsReport: ReturnType<typeof safeParseATSReport>;
  language: LanguageDetection;
}): CoachingPayload {
  const translator = getTranslator(params.language.lang);
  const proposed_changes = buildProposedChanges(params);
  const score = params.atsReport.score ?? 0;

  return {
    headline: translator("headline"),
    focus: [
      CoachingFocusArea.Ats,
      CoachingFocusArea.Skills,
      CoachingFocusArea.Metrics,
    ],
    tone: CoachingTone.Analytical,
    guidance: [
      translator("guidance_primary", { score }),
      translator("guidance_keywords"),
      translator("guidance_metrics"),
      translator("guidance_format"),
    ],
    proposed_changes,
    language: params.language,
    metadata: {
      priority_model: "heuristic-v1",
      ats_baseline_score: score,
      proposed_change_count: proposed_changes.length,
    },
  };
}

async function resolveJobDetails(jobUrl?: string, provided?: string | null) {
  let description = sanitizeJobText(provided ?? undefined);
  let meta: { title?: string; company?: string; url?: string } | undefined;

  if (!description && jobUrl) {
    try {
      const job = await JobLinkScraper.getJob(jobUrl);
      description = sanitizeJobText(job.text ?? undefined);
      meta = {
        title: job.title,
        company: job.company,
        url: job.url ?? jobUrl,
      };
    } catch (error: any) {
      log("tool_error", "job description fetch failed", { error: error?.message, url: jobUrl });
    }
  }

  return { description, meta };
}

function mergeAtsReports(
  primary: ReturnType<typeof safeParseATSReport> | undefined,
  fallback: ReturnType<typeof safeParseATSReport>
) {
  if (!primary) return fallback;
  return {
    ...primary,
    score: typeof primary.score === "number" ? primary.score : fallback.score,
    missing_keywords:
      primary.missing_keywords !== undefined && primary.missing_keywords !== null
        ? primary.missing_keywords
        : fallback.missing_keywords,
    recommendations:
      primary.recommendations !== undefined && primary.recommendations !== null
        ? primary.recommendations
        : fallback.recommendations,
    languages: Object.keys(primary.languages ?? {}).length
      ? primary.languages
      : fallback.languages,
  };
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isEnabled = AGENT_SDK_ENABLED;
  const isShadow = AGENT_SDK_SHADOW;

  if (!isEnabled && !isShadow) {
    return NextResponse.json({ error: "Agent SDK disabled" }, { status: 501 });
  }

  try {
    const body = await req.json();
    const command = String(body.command || "");
    const resumeJson = safeParseOptimizedResume(body.resume_json);
    const jobUrl = typeof body.job_url === "string" ? body.job_url.trim() || undefined : undefined;
    const jobDescriptionInput = typeof body.job_description === "string"
      ? body.job_description
      : typeof body.job_text === "string"
        ? body.job_text
        : undefined;

    const { description: jobDescription, meta: jobMeta } = await resolveJobDetails(jobUrl, jobDescriptionInput);

    const resumeText = (() => {
      try {
        return extractResumeText(resumeJson as any);
      } catch {
        return typeof body.resume_text === "string" ? body.resume_text : "";
      }
    })();

    let language: LanguageDetection = { lang: "en", confidence: 0.5, rtl: false, source: "heuristic" };
    try {
      const detectionText = [resumeText, jobDescription ?? ""].filter(Boolean).join("\n");
      language = await detectLanguage(detectionText);
    } catch (error: any) {
      log("tool_error", "language detection failed", { error: error?.message });
    }

    let atsReport = safeParseATSReport(getFallbackATS());
    try {
      const scored = await ATS.score({
        resume_json: resumeJson as any,
        job_text: jobDescription,
      });
      atsReport = safeParseATSReport(scored);
    } catch (error: any) {
      log("tool_error", "ATS scoring failed in route", { error: error?.message });
      atsReport = safeParseATSReport(getFallbackATS());
    }

    const coaching = buildCoachingPayload({ atsReport, language });
    if (jobMeta) {
      coaching.metadata = {
        ...(coaching.metadata ?? {}),
        job: jobMeta,
      };
    }

    if (isShadow && !isEnabled) {
      const jobText = jobDescription ?? "";
      const resumeTextInput = typeof body.resume_text === "string" ? body.resume_text : resumeText;
      const legacy = await optimizeResume(resumeTextInput, jobText);

      const runtime = new AgentRuntime();
      runtime
        .run({
          userId: user.id,
          command,
          resume_file_path: body.resume_file_path,
          resume_json: resumeJson,
          job_url: jobUrl,
          job_description: jobDescription,
          design: body.design,
        })
        .then(async (agentResult) => {
          try {
            const afterATS = agentResult.ats_report?.score ?? null;
            const diffCount = agentResult.diffs?.length ?? 0;
            const warnings = agentResult.ui_prompts ?? [];
            await supabase
              .from("agent_shadow_logs")
              .insert([
                {
                  user_id: user.id,
                  intent: [agentResult.intent],
                  ats_before: atsReport.score,
                  ats_after: afterATS,
                  diff_count: diffCount,
                  warnings,
                },
              ]);
          } catch (e: any) {
            log("tool_error", "shadow logging failed", { error: e?.message });
          }
        })
        .catch((e: any) => log("tool_error", "background agent run failed", { error: e?.message }));

      log("agent_run", "shadow mode responded with legacy optimizer", { userId: user.id });
      return NextResponse.json({
        shadow: true,
        legacy,
        ats_report: atsReport,
        coaching,
        language,
      });
    }

    const runtime = new AgentRuntime();
    const result = await runtime.run({
      userId: user.id,
      command,
      resume_file_path: body.resume_file_path,
      resume_json: resumeJson,
      job_url: jobUrl,
      job_description: jobDescription,
      design: body.design,
    });

    const normalizedRuntimeAts = result.ats_report
      ? safeParseATSReport(result.ats_report)
      : undefined;
    const mergedAts = mergeAtsReports(normalizedRuntimeAts, atsReport);

    const enrichedResult = {
      ...result,
      ats_report: mergedAts,
      proposed_changes: coaching.proposed_changes,
      coaching,
      language,
    };

    if (enrichedResult.coaching && !enrichedResult.coaching.language) {
      enrichedResult.coaching.language = language;
    }

    log("agent_run", "agent run completed", { userId: user.id, intent: result.intent });
    return NextResponse.json(enrichedResult);
  } catch (e: any) {
    log("tool_error", "agent run crashed", { error: e?.message });
    return NextResponse.json({ error: e?.message || "Agent error" }, { status: 500 });
  }
}
