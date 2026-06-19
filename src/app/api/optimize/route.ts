import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { runOptimizePipeline } from "@/lib/ai-optimizer/optimize-pipeline";
import { preferJobDescriptionText } from "@/lib/ats/job-data-resolver";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/agent/utils/logger";
import { createOptimizationReviewRun } from "@/lib/optimization-review/service";

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient(req);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let resumeId: string | undefined;
  let jobDescriptionId: string | undefined;

  try {
    const rateKey = `optimize:${user.id}`;
    const rateResult = checkRateLimit(rateKey, RATE_LIMITS.ai);

    if (!rateResult.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rateResult.resetTime - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before optimizing again." },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateResult),
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": RATE_LIMITS.ai.maxRequests.toString(),
          },
        },
      );
    }

    const parsed = await req.json();
    resumeId = parsed.resumeId;
    jobDescriptionId = parsed.jobDescriptionId;

    if (!resumeId || !jobDescriptionId) {
      return NextResponse.json({ error: "resumeId and jobDescriptionId are required." }, { status: 400 });
    }

    const resumeQuery = supabase
      .from("resumes")
      .select("raw_text")
      .eq("id", resumeId)
      .maybeSingle();

    const jdQuery = supabase
      .from("job_descriptions")
      .select("raw_text, clean_text, parsed_data, title")
      .eq("id", jobDescriptionId)
      .maybeSingle();

    const [resumeResult, jdResult] = await Promise.all([resumeQuery, jdQuery]);

    const { data: resumeData, error: resumeError } = resumeResult;
    const { data: jdData, error: jdError } = jdResult;

    if (resumeError || !resumeData) {
      throw new Error(resumeError?.message || "Resume not found");
    }

    if (jdError || !jdData) {
      throw new Error(jdError?.message || "Job description not found");
    }

    // Credit check disabled — all users are on free tier for now.
    // Re-enable by uncommenting the consumeCredit block when monetization goes live.

    const jobDescriptionText = preferJobDescriptionText(jdData as { raw_text?: string; clean_text?: string });
    const parsedData = (jdData as { parsed_data?: Record<string, unknown> }).parsed_data;

    const pipelineResult = await runOptimizePipeline(
      (resumeData as any).raw_text,
      jobDescriptionText,
      parsedData ? { jobExtractedJson: parsedData } : undefined,
    );
    const optimizedResume = pipelineResult.optimizedResume;

    const { reviewId } = await createOptimizationReviewRun({
      supabase,
      userId: user.id,
      resumeId,
      jobDescriptionId,
      resumeRawText: (resumeData as any).raw_text,
      jobDescriptionText,
      jobTitle: 'Position',
      optimizedResume,
    });

    return NextResponse.json({ reviewId, nextStep: "review" });

  } catch (error: unknown) {
    logger.error('Error optimizing resume via API', { userId: user.id, resumeId, jobDescriptionId }, error);

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
    }, { status: statusCode });
  }
}
