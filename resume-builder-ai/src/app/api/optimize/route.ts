import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { optimizeResume } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { resumeId, jobDescriptionId } = await req.json();

    if (!resumeId || !jobDescriptionId) {
      return NextResponse.json({ error: "resumeId and jobDescriptionId are required." }, { status: 400 });
    }

    const { data: resumeData, error: resumeError } = await supabase
      .from("resumes")
      .select("raw_text")
      .eq("id", resumeId)
      .single();

    if (resumeError) throw resumeError;

    const { data: jdData, error: jdError } = await supabase
      .from("job_descriptions")
      .select("raw_text")
      .eq("id", jobDescriptionId)
      .single();

    if (jdError) throw jdError;

    const optimizedResume = await optimizeResume(resumeData.raw_text, jdData.raw_text);

    const { data: optimizationData, error: optimizationError } = await supabase
      .from("optimizations")
      .insert([
        {
          user_id: user.id,
          resume_id: resumeId,
          jd_id: jobDescriptionId,
          match_score: 0.85, // Placeholder - will be calculated by AI later
          gaps_data: {}, // Will be populated with gap analysis
          rewrite_data: optimizedResume,
          template_key: "ats-safe", // Default template
          status: "completed",
        },
      ])
      .select()
      .single();

    if (optimizationError) throw optimizationError;

    return NextResponse.json({ optimizationId: optimizationData.id });

  } catch (error: unknown) {
    console.error("Error optimizing resume:", error);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
