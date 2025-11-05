import type { AgentResult, RunInput, Diff } from "./types";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import { detectIntent } from "./intents";
import { JobLinkScraper } from "./tools/job-link-scraper";
import { ResumeWriter } from "./tools/resume-writer";
import { DesignOps } from "./tools/design-ops";
import { LayoutEngine } from "./tools/layout-engine";
import { SkillsMiner } from "./tools/skills-miner";
import { ATS } from "./tools/ats";
import { Versioning } from "./tools/versioning";
import { HistoryStore } from "./tools/history-store";
import { planWithLLM } from "./llm-planner";
import { safeParseAgentResult, safeParseATSReport, safeParseAgentArtifacts, safeParseOptimizedResume } from "./validators";
import { getFallbackATS, getFallbackArtifacts, getFallbackDiffs } from "./runtime/fallbacks";
import { log } from "./utils/logger";

function ensureResumeJson(input?: any): OptimizedResume {
  if (input) return input as OptimizedResume;
  // Minimal default structure
  return {
    summary: "",
    contact: { name: "", email: "", phone: "", location: "" },
    skills: { technical: [], soft: [] },
    experience: [],
    education: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
  } as unknown as OptimizedResume;
}

/**
 * AgentRuntime orchestrates intent detection, planning, tools execution,
 * diffs merging, ATS scoring, persistence, and packaging a safe AgentResult.
 * It is defensive-by-default: all steps validate outputs and fall back
 * to safe defaults while emitting short rationales and ui_prompts.
 */
export class AgentRuntime {
  async run(input: RunInput): Promise<AgentResult> {
    const actions: AgentResult["actions"] = [];
    const diffs: Diff[] = [];
    const ui_prompts: string[] = [];

    const intent = await detectIntent(input.command);

    // Parse command for additive signals
    const skillsMatch = input.command.match(/add\s+skills?:\s*([^;\n]+)/i);
    const fontMatch = input.command.match(/font\s+([A-Za-z0-9 \-]+)/i) || input.command.match(/change\s+font\s+([A-Za-z0-9 \-]+)/i);
    const colorMatch = input.command.match(/color\s+#?([0-9A-Fa-f]{6})/i);

    let resume = ensureResumeJson(input.resume_json);

    // Job text
    let jobText = input.job_description ?? input.job_text;
    let jobMeta: any = undefined;
    if (!jobText && input.job_url) {
      actions.push({ tool: "JobLinkScraper.getJob", args: { job_url: input.job_url }, rationale: "Fetch job details" });
      const job = await JobLinkScraper.getJob(input.job_url);
      jobText = job.text;
      jobMeta = { title: job.title, company: job.company, apply_url: job.url };
    }

    // Add skills
    if (skillsMatch) {
      const raw = skillsMatch[1];
      const skills = raw.split(/,|\s+/).map((s) => s.trim()).filter(Boolean);
      if (!resume.skills) resume.skills = { technical: [], soft: [] } as any;
      resume.skills.technical = Array.from(new Set([...(resume.skills.technical || []), ...skills]));
      actions.push({ tool: "ResumeWriter.applyDiff", args: { skills }, rationale: "Add extracted skills" });
      diffs.push({ scope: "paragraph", before: "", after: `Added skills: ${skills.join(", ")}` });
    }

    // Design/theme
    const theme = DesignOps.theme({
      font_family: fontMatch?.[1]?.trim(),
      color_hex: colorMatch?.[1],
      layout: input.design?.layout,
      spacing: input.design?.spacing,
      density: input.design?.density,
    });
    actions.push({ tool: "DesignOps.theme", args: theme, rationale: "Apply requested theme" });
    diffs.push({ scope: "style", before: "", after: `font=${theme.font_family}; color=${theme.color_hex}` });

    // Rewrite strengthening: simple heuristic—append note to summary
    if (/strengthen|rewrite|improve/i.test(input.command)) {
      const before = resume.summary || "";
      const after = before ? `${before} Improved clarity and impact.` : "Enhanced professional summary.";
      resume = ResumeWriter.applyDiff(resume, [{ scope: "paragraph", before, after }]);
      actions.push({ tool: "ResumeWriter.applyDiff", args: { summary: true }, rationale: "Strengthen summary" });
      diffs.push({ scope: "paragraph", before, after });
    }

    // ATS
    let ats_report = getFallbackATS();
    let atsDegraded = false;
    try {
      const atsResult = await ATS.score({ resume_json: resume, job_text: jobText });
      ats_report = safeParseATSReport(atsResult);
    } catch (e: any) {
      log("tool_error", "ATS.score exception bubbled", { error: e?.message });
      ats_report = getFallbackATS();
      atsDegraded = true;
    }
    actions.push({ tool: "ATS.score", args: { with_job: !!jobText }, rationale: "Compute ATS score" });

    // Optional LLM planning suggestions (augment actions log only)
    const llmPlan = await planWithLLM({ command: input.command, resume, job_text: jobText });
    if (llmPlan.length) {
      for (const a of llmPlan) {
        actions.push({ tool: a.tool, args: a.args, rationale: `LLM: ${a.rationale}` });
      }
    }

    // Render preview
    let rendered = { html: "", preview_pdf_path: undefined as string | undefined };
    let renderDegraded = false;
    try {
      rendered = await LayoutEngine.render(resume, theme);
    } catch (e: any) {
      log("storage_warn", "LayoutEngine.render crashed", { error: e?.message });
      const fb = getFallbackArtifacts();
      rendered = { html: "", preview_pdf_path: fb.preview_pdf_path };
      renderDegraded = true;
    }
    actions.push({ tool: "LayoutEngine.render", args: { layout: theme.layout }, rationale: "Render preview" });

    // Persist version and history
    const version = await Versioning.commit(input.userId, resume);
    actions.push({ tool: "Versioning.commit", args: { resume_version_id: version.resume_version_id }, rationale: "Create version" });

    const history = await HistoryStore.save({
      user_id: input.userId,
      resume_version_id: version.resume_version_id,
      ats_score: ats_report.score,
      job: jobMeta ?? null,
      artifacts: rendered.preview_pdf_path ? [{ type: "pdf", path: rendered.preview_pdf_path }] : [],
    });
    actions.push({ tool: "HistoryStore.save", args: { history_id: history.id }, rationale: "Record run" });

    // Surface degraded mode prompts
    if (atsDegraded) ui_prompts.push("ATS score used a safe fallback due to a transient issue.");
    if (renderDegraded) ui_prompts.push("Preview PDF path is a fallback. You can retry to regenerate.");

    // Stub features
    if (/\bundo\b|\bredo\b|compare/i.test(input.command)) {
      ui_prompts.push("Undo/Redo/Compare are limited in v1. History is saved.");
    }

    const result: AgentResult = {
      intent,
      actions,
      diffs: diffs.length ? diffs : getFallbackDiffs(),
      artifacts: safeParseAgentArtifacts({
        resume_json: safeParseOptimizedResume(resume),
        preview_pdf_path: rendered.preview_pdf_path,
        export_files: rendered.preview_pdf_path ? [{ type: "pdf", path: rendered.preview_pdf_path }] : [],
      }),
      ats_report: safeParseATSReport(ats_report),
      history_record: {
        resume_version_id: version.resume_version_id,
        timestamp: version.created_at,
        job: jobMeta,
        ats_score: ats_report.score,
      },
      ui_prompts,
    };
    const safe = safeParseAgentResult(result);
    return safe ?? result;
  }
}

export default AgentRuntime;
