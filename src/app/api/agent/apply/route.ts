import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { HistoryStore } from "@/lib/agent/tools/history-store";

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { history_id, apply_date } = await req.json();
    if (!history_id) return NextResponse.json({ error: "history_id is required" }, { status: 400 });
    const date = apply_date || new Date().toISOString();
    const updated = await HistoryStore.linkApply({ history_id, apply_date: date });
    return NextResponse.json({ id: updated.id, apply_date: updated.apply_date });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Apply error" }, { status: 500 });
  }
}

