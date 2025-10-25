import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { optimizeResume } from "@/lib/openai";
import { z } from 'zod';
import { optimizationRateLimiter, createRateLimitResponse } from "@/lib/rate-limit";

// Validation schema for optimize request
const OptimizeRequestSchema = z.object({
  resumeId: z.string().uuid('Invalid resume ID format'),
  jobDescriptionId: z.string().uuid('Invalid job description ID format'),
});

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting: 5 optimizations per hour per user (expensive AI operations)
  const rateLimitResult = await optimizationRateLimiter.check(user.id);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  try {
    const body = await req.json();

    // Validate input with Zod
    const validation = OptimizeRequestSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { resumeId, jobDescriptionId } = validation.data;

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
