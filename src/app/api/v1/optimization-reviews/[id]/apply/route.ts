import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import {
  applyOptimizationReviewRun,
  getOptimizationReviewRun,
} from "@/lib/optimization-review/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const reviewRun = await getOptimizationReviewRun(supabase, id, user.id);
    if (!reviewRun) {
      return NextResponse.json({ error: "Review run not found." }, { status: 404 });
    }

    const body: { approvedGroupIds?: unknown } = await request.json().catch(() => ({}));
    const approvedGroupIds = Array.isArray(body.approvedGroupIds)
      ? body.approvedGroupIds
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim())
      : [];

    const result = await applyOptimizationReviewRun({
      supabase,
      userId: user.id,
      reviewRun,
      approvedGroupIds,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply optimization review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
