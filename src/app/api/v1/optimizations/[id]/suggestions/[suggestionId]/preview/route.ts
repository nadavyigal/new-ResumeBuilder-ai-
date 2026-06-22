import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { generateAmendments } from "@/lib/ats/amendment-generator";
import {
  buildJobDataFromExtractedJson,
  resolveJobDescriptionText,
} from "@/lib/ats/job-data-resolver";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import type { Suggestion } from "@/lib/ats/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const { id, suggestionId } = await params;
  const decodedSuggestionId = decodeURIComponent(suggestionId);

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase
    .from("optimizations")
    .select("rewrite_data, ats_suggestions, jd_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
  }

  const suggestions = (row.ats_suggestions as Suggestion[] | null) || [];
  const suggestion = suggestions.find((candidate) => candidate.id === decodedSuggestionId);
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const resumeContent = (row.rewrite_data as OptimizedResume | null) || null;
  if (!resumeContent) {
    return NextResponse.json({ error: "Resume content not found" }, { status: 404 });
  }

  let jobDescriptionText = "";
  let jobData: ReturnType<typeof buildJobDataFromExtractedJson> | undefined;
  if (row.jd_id) {
    const { data: jdRow } = await supabase
      .from("job_descriptions")
      .select("raw_text, clean_text, parsed_data")
      .eq("id", row.jd_id)
      .maybeSingle();

    if (jdRow) {
      jobDescriptionText = resolveJobDescriptionText({
        raw_text: jdRow.raw_text,
        clean_text: jdRow.clean_text,
        parsed_data: jdRow.parsed_data,
      });
      jobData = buildJobDataFromExtractedJson(jdRow.parsed_data, jobDescriptionText);
    }
  }

  const result = await generateAmendments(suggestion, resumeContent, {
    jobDescriptionText,
    jobData,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to generate preview" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    suggestion_id: decodedSuggestionId,
    affected_fields: result.affectedFields,
  });
}
