import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";

/**
 * POST /api/v1/applications/[id]/attach-optimized
 * Body: { optimized_resume_id: string }
 * Copies ATS score and URL from optimization to applications row
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const optimizedId = body?.optimized_resume_id as string | undefined;
    if (!optimizedId) {
      return NextResponse.json({ error: "optimized_resume_id is required" }, { status: 400 });
    }

    // Verify optimization belongs to user and get ATS/URL info
    const { data: opt, error: optErr } = await supabase
      .from('optimizations')
      .select('id, user_id, ats_score, public_url')
      .eq('id', optimizedId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (optErr) {
      return NextResponse.json({ error: 'Error fetching optimization: ' + optErr.message }, { status: 500 });
    }

    if (!opt) {
      return NextResponse.json({ error: 'Optimization not found or access denied' }, { status: 404 });
    }

    const { error: updErr } = await supabase
      .from('applications')
      .update({
        optimized_resume_id: optimizedId,
        optimized_resume_url: (opt as any).public_url || null,
        ats_score: (opt as any).ats_score ?? null,
      })
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}













