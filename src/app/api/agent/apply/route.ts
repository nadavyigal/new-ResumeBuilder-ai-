import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { HistoryStore } from "@/lib/agent/tools/history-store";
import { Versioning } from "@/lib/agent/tools/versioning";
import { LayoutEngine } from "@/lib/agent/tools/layout-engine";
import { ATS } from "@/lib/agent/tools/ats";
import type { ProposedChange } from "@/lib/agent/types";

type ApplyRequest =
  | { history_id: string; apply_date?: string }
  | {
      resume_json: Record<string, unknown>;
      proposed_changes?: ProposedChange[];
      design?: { font_family?: string; color_hex?: string; layout?: string; spacing?: string; density?: "compact" | "cozy" };
      job_text?: string;
      notes?: string;
    };

function applyProposedChanges(
  resume: any,
  changes: ProposedChange[] | undefined
): any {
  if (!changes || changes.length === 0) return resume;
  const updated = JSON.parse(JSON.stringify(resume));

  for (const ch of changes) {
    const section = (ch.section || '').toLowerCase();
    const field = (ch.field || '').toLowerCase();
    const text = (ch.text || '').trim();
    if (!text) continue;

    if (section.includes('summary') || field === 'summary') {
      const before = typeof updated.summary === 'string' ? updated.summary : '';
      updated.summary = before ? `${before} ${text}`.trim() : text;
      continue;
    }

    if (section.includes('skills') || field === 'skills') {
      const blob = text;
      const tokens = blob
        .split(/[,;]|\band\b|\bor\b/i)
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!updated.skills) updated.skills = { technical: [], soft: [] };
      const skills = updated.skills as { technical: string[]; soft: string[] };
      const technicalKeywords = ['python', 'javascript', 'java', 'react', 'node', 'sql', 'aws', 'docker', 'git', 'api', 'css', 'html', 'typescript', 'ai', 'automation'];
      for (const t of tokens) {
        const isTech = technicalKeywords.some((kw) => t.toLowerCase().includes(kw));
        const arr = isTech ? skills.technical : skills.soft;
        if (!arr.includes(t)) arr.push(t);
      }
      continue;
    }

    if (section.startsWith('experience') || field === 'bullet' || field === 'achievement') {
      if (Array.isArray(updated.experience) && updated.experience.length > 0) {
        if (!Array.isArray(updated.experience[0].achievements)) {
          updated.experience[0].achievements = [];
        }
        updated.experience[0].achievements.push(text);
      }
      continue;
    }
    // Default: append to summary
    const before = typeof updated.summary === 'string' ? updated.summary : '';
    updated.summary = before ? `${before} ${text}`.trim() : text;
  }
  return updated;
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as ApplyRequest;

    // Legacy behavior: only link apply date to a history record
    if ((body as any).history_id && !(body as any).resume_json) {
      const { history_id, apply_date } = body as { history_id: string; apply_date?: string };
      if (!history_id) return NextResponse.json({ error: "history_id is required" }, { status: 400 });
      const date = apply_date || new Date().toISOString();
      const updated = await HistoryStore.linkApply({ history_id, apply_date: date });
      return NextResponse.json({ id: updated.id, apply_date: updated.apply_date });
    }

    // Rich apply: commit changes, regenerate preview, rescore, log history
    const { resume_json, proposed_changes, design, job_text, notes } = body as any;
    if (!resume_json) return NextResponse.json({ error: "resume_json is required" }, { status: 400 });

    const updatedResume = applyProposedChanges(resume_json, proposed_changes);

    // Render preview (safe degrade to fallback path)
    const rendered = await LayoutEngine.render(updatedResume as any, design || {});

    // Rescore ATS using provided job_text (optional)
    const ats_report = await ATS.score({ resume_json: updatedResume as any, job_text });

    // Persist new version + history
    const version = await Versioning.commit(user.id, updatedResume as any);
    const history = await HistoryStore.save({
      user_id: user.id,
      resume_version_id: version.resume_version_id,
      ats_score: ats_report.score,
      job: null,
      artifacts: rendered.preview_pdf_path ? [{ type: 'pdf', path: rendered.preview_pdf_path }] : [],
      notes: notes || undefined,
    });

    return NextResponse.json({
      ok: true,
      resume_json: updatedResume,
      preview_pdf_path: rendered.preview_pdf_path,
      ats_report,
      version: version,
      history: history,
      applied_count: Array.isArray(proposed_changes) ? proposed_changes.length : 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Apply error" }, { status: 500 });
  }
}

