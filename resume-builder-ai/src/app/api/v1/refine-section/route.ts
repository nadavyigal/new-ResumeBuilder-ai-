import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import OpenAI from 'openai';
import type { RefineSectionRequest, RefineSectionResponse } from '@/types/refine';
import { buildRefineSectionPrompt } from '@/lib/ai/prompt-builders/refineSectionPrompt';
import { coerceModelJson, validateRefineSuggestion } from '@/lib/ai/validators/refineSection';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as RefineSectionRequest;
    if (!body?.resumeId || !body?.selection?.text || !body?.instruction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const temperature = 0.2;

    const { system, user: userMsg } = buildRefineSectionPrompt({ req: body });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = coerceModelJson(raw);
    if (!parsed) {
      return NextResponse.json({ error: 'Malformed AI response' }, { status: 502 });
    }

    const validation = validateRefineSuggestion(
      body.selection.text,
      parsed.suggestion,
      body.constraints?.maxChars
    );

    const response: RefineSectionResponse = {
      suggestion: parsed.suggestion.trim(),
      keywordsApplied: Array.isArray(parsed.keywordsApplied) ? parsed.keywordsApplied : [],
      rationale: parsed.rationale || undefined,
      flags: validation.flags.length ? validation.flags : undefined,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('refine-section error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}




