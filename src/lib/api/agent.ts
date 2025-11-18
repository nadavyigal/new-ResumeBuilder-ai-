// Client-side helper for new agent APIs (no UI changes required)

import type { ProposedChange } from '@/lib/agent/types';

export async function runAgent(payload: {
  command: string;
  resume_json?: Record<string, unknown>;
  job_text?: string;
  design?: { font_family?: string; color_hex?: string; layout?: string; spacing?: string; density?: 'compact' | 'cozy' };
}) {
  const res = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Agent run failed');
  return res.json();
}

export async function applyAgent(payload:
  | { history_id: string; apply_date?: string }
  | {
      resume_json: Record<string, unknown>;
      proposed_changes?: ProposedChange[];
      job_text?: string;
      design?: { font_family?: string; color_hex?: string; layout?: string; spacing?: string; density?: 'compact' | 'cozy' };
      notes?: string;
    }
) {
  const res = await fetch('/api/agent/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Apply failed');
  return res.json();
}

export async function undoHistory(current_version_id: string) {
  const res = await fetch('/api/v1/history/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_version_id }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Undo failed');
  return res.json();
}

export async function redoHistory(params: { version_id?: string; optimization_id?: string; version_number?: number; session_id?: string | null }) {
  const res = await fetch('/api/v1/history/redo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Redo failed');
  return res.json();
}

