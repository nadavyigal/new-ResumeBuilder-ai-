import type { RefineSectionRequest, RefineSectionResponse } from '@/types/refine';

export async function refineSection(payload: RefineSectionRequest): Promise<RefineSectionResponse> {
  const res = await fetch('/api/v1/refine-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = 'Failed to refine section';
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {}
    throw new Error(message);
  }

  const data = (await res.json()) as RefineSectionResponse;
  return data;
}

interface ApplySelection {
  sectionId: string;
  field: 'bullet' | 'summary' | 'title' | 'skills' | 'custom';
  text: string;
}

export interface ApplyRefinementRequest {
  optimizationId: string;
  selection: ApplySelection;
  suggestion: string;
}

export async function applyRefinement(payload: ApplyRefinementRequest): Promise<{ ok: boolean; updated?: boolean; reason?: string; }> {
  const res = await fetch('/api/v1/refine-section/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = 'Failed to apply refinement';
    try { message = (await res.json())?.error || message; } catch {}
    throw new Error(message);
  }
  return res.json();
}


