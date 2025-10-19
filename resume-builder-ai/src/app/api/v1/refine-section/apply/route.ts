import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface ApplySelection {
  sectionId: string;
  field: 'bullet' | 'summary' | 'title' | 'skills' | 'custom';
  text: string;
}

interface ApplyRefinementRequest {
  optimizationId: string;
  selection: ApplySelection;
  suggestion: string;
}

function normalizeString(value: string): string {
  return (value || '').toLowerCase().trim();
}

function normalizeComparable(value: string): string {
  return normalizeString(value).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function applyToResumeData(
  resumeData: any,
  selection: ApplySelection,
  suggestion: string
): { updatedData: any; updated: boolean } {
  if (!resumeData || typeof resumeData !== 'object') {
    return { updatedData: resumeData, updated: false };
  }

  const clone = JSON.parse(JSON.stringify(resumeData));
  const field = selection.field;

  if (field === 'summary') {
    clone.summary = suggestion;
    return { updatedData: clone, updated: true };
  }

  if (field === 'skills') {
    // Best-effort: merge tokens from suggestion into technical list
    const tokens = suggestion
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const existing = Array.isArray(clone?.skills?.technical) ? clone.skills.technical : [];
    const set = new Set<string>(existing);
    for (const t of tokens) {
      if (!set.has(t)) set.add(t);
    }
    clone.skills = clone.skills || {};
    clone.skills.technical = Array.from(set);
    return { updatedData: clone, updated: true };
  }

  if (field === 'bullet') {
    const targetRaw = selection.text || '';
    const target = normalizeComparable(targetRaw);
    if (!Array.isArray(clone.experience)) {
      return { updatedData: clone, updated: false };
    }

    // Prefer the experience index encoded in sectionId, e.g., experience-2
    const match = selection.sectionId.match(/experience-(\d+)/i);
    const preferredIdx = match ? parseInt(match[1], 10) : -1;
    const indices: number[] = preferredIdx >= 0
      ? [preferredIdx, ...clone.experience.map((_: any, i: number) => i).filter((i: number) => i !== preferredIdx)]
      : clone.experience.map((_: any, i: number) => i);

    const similarEnough = (a: string, b: string) => {
      const A = normalizeComparable(a);
      const B = normalizeComparable(b);
      if (!A || !B) return false;
      if (A.length >= 8 && (A.includes(B) || B.includes(A))) return true;
      const aWords = new Set(A.split(' '));
      const bWords = new Set(B.split(' '));
      let inter = 0;
      aWords.forEach((w) => { if (bWords.has(w)) inter++; });
      const denom = Math.max(1, Math.min(aWords.size, bWords.size));
      return inter / denom >= 0.6;
    };

    for (const idx of indices) {
      const exp = clone.experience[idx];
      if (!exp) continue;
      if (!Array.isArray(exp.achievements)) exp.achievements = [];

      // Try to replace best-matching bullet in this experience
      let bestIndex = -1;
      for (let i = 0; i < exp.achievements.length; i++) {
        const item = String(exp.achievements[i] || '');
        if (target && similarEnough(item, targetRaw)) {
          bestIndex = i; break;
        }
        const itemNorm = normalizeComparable(item);
        if (target && (itemNorm.includes(target) || target.includes(itemNorm))) {
          bestIndex = i; break;
        }
      }
      if (bestIndex >= 0) {
        exp.achievements[bestIndex] = suggestion;
        return { updatedData: clone, updated: true };
      }

      // If we targeted a specific experience and nothing matched, append there
      if (preferredIdx === idx) {
        exp.achievements.push(suggestion);
        return { updatedData: clone, updated: true };
      }
    }

    // As a final fallback, append to the first experience if present
    if (Array.isArray(clone.experience) && clone.experience.length > 0) {
      const exp0 = clone.experience[0];
      if (!Array.isArray(exp0.achievements)) exp0.achievements = [];
      exp0.achievements.push(suggestion);
      return { updatedData: clone, updated: true };
    }

    return { updatedData: clone, updated: false };
  }

  if (field === 'title') {
    // Best-effort: update title of a matching experience if selection.sectionId encodes index
    const match = selection.sectionId.match(/experience-(\d+)/i);
    const idx = match ? parseInt(match[1], 10) : -1;
    if (idx >= 0 && Array.isArray(clone.experience) && clone.experience[idx]) {
      clone.experience[idx].title = suggestion;
      return { updatedData: clone, updated: true };
    }
    return { updatedData: clone, updated: false };
  }

  // custom: no-op without a clear mapping
  return { updatedData: clone, updated: false };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ApplyRefinementRequest;
    if (!body?.optimizationId || !body?.selection || !body?.suggestion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load optimization
    const { data: optimization, error: optError } = await supabase
      .from('optimizations')
      .select('id, rewrite_data')
      .eq('id', body.optimizationId)
      .single();

    if (optError || !optimization) {
      return NextResponse.json({ error: 'Optimization not found' }, { status: 404 });
    }

    const current = optimization.rewrite_data || {};
    const { updatedData, updated } = applyToResumeData(current, body.selection, body.suggestion);

    if (!updated) {
      return NextResponse.json({ ok: false, reason: 'not_found' });
    }

    const { error: updateError } = await supabase
      .from('optimizations')
      .update({ rewrite_data: updatedData })
      .eq('id', body.optimizationId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: true });
  } catch (err) {
    console.error('apply refine error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


