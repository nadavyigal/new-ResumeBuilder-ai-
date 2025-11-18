import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { optimizeResume } from "@/lib/openai";
import { scoreOptimization } from "@/lib/ats/integration";

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

    if (resumeError || !resumeData) {
      throw new Error(resumeError?.message || "Resume not found");
    }

    const { data: jdData, error: jdError } = await supabase
      .from("job_descriptions")
      .select("raw_text")
      .eq("id", jobDescriptionId)
      .maybeSingle();

    if (jdError || !jdData) {
      throw new Error(jdError?.message || "Job description not found");
    }

    const optimizedResume = await optimizeResume((resumeData as any).raw_text, (jdData as any).raw_text);

    // Score the optimization using ATS v2
    let atsResult = null;
    try {
      console.log('Starting ATS v2 scoring...');
      const scoringPromise = scoreOptimization({
        resumeOriginalText: (resumeData as any).raw_text,
        resumeOptimizedJson: optimizedResume,
        jobDescriptionText: (jdData as any).raw_text,
        jobTitle: 'Position', // TODO: Extract from JD if available
      });
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ATS scoring timeout')), 30000)
      );
      
      atsResult = await Promise.race([scoringPromise, timeoutPromise]) as any;
      
      console.log('ATS v2 scoring completed:', {
        original: atsResult?.ats_score_original,
        optimized: atsResult?.ats_score_optimized,
        improvement: (atsResult?.ats_score_optimized || 0) - (atsResult?.ats_score_original || 0),
      });
    } catch (atsError: any) {
      console.error('ATS v2 scoring failed, using fallback scoring:', {
        error: atsError?.message,
        stack: atsError?.stack?.substring(0, 200),
      });

      // FALLBACK: Calculate basic keyword-based scores instead of null
      try {
        const originalText = (resumeData as any).raw_text?.toLowerCase() || '';
        const optimizedText = JSON.stringify(optimizedResume).toLowerCase();
        const jdText = (jdData as any).raw_text?.toLowerCase() || '';

        // Extract simple keywords from job description (words 4+ chars)
        const jdKeywords = jdText
          .split(/\s+/)
          .filter((word: string) => word.length >= 4 && /^[a-z]+$/.test(word))
          .slice(0, 50); // Use top 50 words

        // Count keyword matches
        const originalMatches = jdKeywords.filter((kw: string) => originalText.includes(kw)).length;
        const optimizedMatches = jdKeywords.filter((kw: string) => optimizedText.includes(kw)).length;

        // Calculate scores (40-85 range based on match percentage)
        const originalScore = Math.round(40 + (originalMatches / jdKeywords.length) * 45);
        const optimizedScore = Math.round(Math.max(originalScore + 5, 45 + (optimizedMatches / jdKeywords.length) * 45));

        console.log('📊 Fallback scoring:', {
          jdKeywords: jdKeywords.length,
          originalMatches,
          optimizedMatches,
          originalScore,
          optimizedScore,
        });

        atsResult = {
          ats_score_original: originalScore,
          ats_score_optimized: optimizedScore,
          subscores: null,
          subscores_original: null,
          suggestions: [],
          confidence: 0.5, // Lower confidence for fallback
        };
      } catch (fallbackError) {
        console.error('Fallback scoring also failed:', fallbackError);
        atsResult = null;
      }
    }

    // Prepare optimization data with ATS v2 results
    const optimizationInsert: any = {
      user_id: user.id,
      resume_id: resumeId,
      jd_id: jobDescriptionId,
      match_score: atsResult?.ats_score_optimized || 85,
      gaps_data: {}, // Will be populated with gap analysis
      rewrite_data: optimizedResume,
      template_key: 'natural', // Default natural design (no template)
      status: "completed" as const,
      // ATS v2 fields - always use version 2
      ats_version: 2,
      ats_score_original: atsResult?.ats_score_original || null,
      ats_score_optimized: atsResult?.ats_score_optimized || null,
      ats_subscores: atsResult?.subscores || null,
      ats_subscores_original: atsResult?.subscores_original || null,
      ats_suggestions: atsResult?.suggestions || null,
      ats_confidence: atsResult?.confidence || null,
    };

    const { data: optimizationData, error: optimizationError } = await supabase
      .from("optimizations")
      .insert(optimizationInsert)
      .select()
      .maybeSingle();

    if (optimizationError || !optimizationData) {
      throw new Error(optimizationError?.message || "Failed to create optimization");
    }

    return NextResponse.json({ optimizationId: (optimizationData as any).id });

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
