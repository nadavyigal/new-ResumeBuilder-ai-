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
      .maybeSingle();

    if (resumeError) {
      throw resumeError;
    }

    if (!resumeData) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const { data: jdData, error: jdError } = await supabase
      .from("job_descriptions")
      .select("raw_text")
      .eq("id", jobDescriptionId)
      .maybeSingle();

    if (jdError) {
      throw jdError;
    }

    if (!jdData) {
      return NextResponse.json({ error: "Job description not found" }, { status: 404 });
    }

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
      .maybeSingle();

    if (optimizationError) {
      throw optimizationError;
    }

    if (!optimizationData) {
      return NextResponse.json({ error: "Failed to create optimization record" }, { status: 500 });
    }

    return NextResponse.json({ optimizationId: optimizationData.id });

  } catch (error: unknown) {
    console.error("Error optimizing resume:", error);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
