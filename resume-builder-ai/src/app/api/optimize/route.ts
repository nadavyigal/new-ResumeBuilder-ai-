import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { optimizeResume } from "@/lib/openai";
import { scoreOptimization } from "@/lib/ats/integration";
import type { OptimizedResume } from "@/lib/ai-optimizer";

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

    if (resumeError) throw resumeError;
    if (!resumeData) throw new Error("Resume not found");

    const { data: jdData, error: jdError } = await supabase
      .from("job_descriptions")
      .select("title, raw_text")
      .eq("id", jobDescriptionId)
      .maybeSingle();

    if (jdError) throw jdError;
    if (!jdData) throw new Error("Job description not found");

    // Generate optimized resume
    const optimizedResume = await optimizeResume(resumeData.raw_text, jdData.raw_text) as OptimizedResume;

    // Score the optimization using ATS v2
    let atsResult;
    try {
      atsResult = await scoreOptimization({
        resumeOriginalText: resumeData.raw_text,
        resumeOptimizedJson: optimizedResume,
        jobDescriptionText: jdData.raw_text,
        jobTitle: jdData.title || 'Position',
      });
      console.log('ATS v2 scoring completed:', {
        original: atsResult.ats_score_original,
        optimized: atsResult.ats_score_optimized,
        confidence: atsResult.confidence,
        suggestions: atsResult.suggestions.length,
      });
    } catch (atsError) {
      console.error('ATS v2 scoring failed, using fallback:', atsError);
      // Don't block optimization if ATS scoring fails
      atsResult = null;
    }

    // Prepare optimization data with ATS v2 results
    const optimizationRecord = {
      user_id: user.id,
      resume_id: resumeId,
      jd_id: jobDescriptionId,
      match_score: atsResult?.ats_score_optimized || optimizedResume.matchScore || 85,
      gaps_data: {}, // Will be populated with gap analysis
      rewrite_data: optimizedResume,
      template_key: null, // No design by default - user chooses explicitly
      status: "completed" as const,
      // ATS v2 fields
      ats_version: atsResult ? 2 : 1,
      ats_score_original: atsResult?.ats_score_original || null,
      ats_score_optimized: atsResult?.ats_score_optimized || null,
      ats_subscores: atsResult?.subscores || null,
      ats_subscores_original: atsResult?.subscores_original || null,
      ats_suggestions: atsResult?.suggestions || null,
      ats_confidence: atsResult?.confidence || null,
      // Store original and optimized text for future re-scoring
      resume_text: resumeData.raw_text,
      jd_text: jdData.raw_text,
    };

    const { data: optimizationData, error: optimizationError } = await supabase
      .from("optimizations")
      .insert([optimizationRecord])
      .select()
      .maybeSingle();

    if (optimizationError) throw optimizationError;
    if (!optimizationData) {
      throw new Error("Failed to create optimization record");
    }

    return NextResponse.json({ optimizationId: optimizationData.id });

  } catch (error: unknown) {
    console.error("Error optimizing resume:", error);

    // Provide detailed error messages for better debugging
    let errorMessage = "Something went wrong";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Set appropriate status codes for different error types
      if (errorMessage.includes('OPENAI_API_KEY') || errorMessage.includes('Invalid OpenAI API key')) {
        statusCode = 503; // Service Unavailable
      } else if (errorMessage.includes('quota exceeded')) {
        statusCode = 429; // Too Many Requests
      } else if (errorMessage.includes('rate limit')) {
        statusCode = 429; // Too Many Requests
      }
    }

    return NextResponse.json({
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }, { status: statusCode });
  }
}
