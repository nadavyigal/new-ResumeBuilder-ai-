import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { runOptimizePipeline } from "@/lib/ai-optimizer/optimize-pipeline";
import { captureServerEvent } from "@/lib/posthog-server";
import { resolveJobDescriptionText } from "@/lib/ats/job-data-resolver";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { checkRateLimit as checkPersistentRateLimit } from "@/lib/rate-limiting/check-rate-limit";
import { getClientIP } from "@/lib/rate-limiting/get-client-ip";
import {
  ANONYMOUS_OPTIMIZE_ENDPOINT,
  ANONYMOUS_OPTIMIZE_LIMIT,
  requiresAnonymousRateLimit,
} from "@/lib/rate-limiting/anonymous-optimize-limit";
import { logger } from "@/lib/agent/utils/logger";
import { createOptimizationReviewRun } from "@/lib/optimization-review/service";
import { toWireGain } from "@/lib/ats/wire-gain";

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient(req);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Anonymous callers can rotate `user.id` at will, so the per-user limit below
  // does not bind for them. Guard on IP instead — see
  // `@/lib/rate-limiting/anonymous-optimize-limit` for why signed-in users are
  // exempt and why this stays inert until anonymous sign-ins are enabled.
  //
  // Uses the Supabase-backed limiter, not `checkRateLimit` from
  // `@/lib/utils/rate-limit`: that one is an in-memory Map, so it is
  // per-instance and resets on restart, which makes it useless as an abuse
  // control on serverless. This is the same limiter `/api/public/ats-check`
  // already relies on.
  if (requiresAnonymousRateLimit(user)) {
    const ip = getClientIP(req);
    try {
      const anonymousLimit = await checkPersistentRateLimit(
        ip,
        ANONYMOUS_OPTIMIZE_ENDPOINT,
        ANONYMOUS_OPTIMIZE_LIMIT,
      );

      if (!anonymousLimit.allowed) {
        const retryAfter = Math.max(
          1,
          Math.ceil((anonymousLimit.resetAt.getTime() - Date.now()) / 1000),
        );
        return NextResponse.json(
          { error: "Free optimization limit reached. Create an account to keep going." },
          {
            status: 429,
            headers: {
              "Retry-After": retryAfter.toString(),
              "X-RateLimit-Limit": ANONYMOUS_OPTIMIZE_LIMIT.maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
            },
          },
        );
      }
    } catch (error) {
      // Fail closed. This is the most expensive endpoint in the app, and an
      // outage in the limiter must not become an open door on it. Matches the
      // posture `/api/public/ats-check` already takes on the same failure.
      logger.error("[optimize] anonymous rate limit check failed", { error });
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again." },
        { status: 503 },
      );
    }
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

    const parsedData = (jdData as { parsed_data?: Record<string, unknown> }).parsed_data;

    const jobDescriptionText = resolveJobDescriptionText({
      raw_text: (jdData as { raw_text?: string }).raw_text,
      clean_text: (jdData as { clean_text?: string }).clean_text,
      parsed_data: parsedData,
    });

    const pipelineResult = await runOptimizePipeline(
      (resumeData as any).raw_text,
      jobDescriptionText,
      {
        ...(parsedData ? { jobExtractedJson: parsedData } : {}),
        aiTrace: {
          distinctId: user.id,
          traceName: 'optimize',
          properties: {
            resume_id: resumeId,
            job_description_id: jobDescriptionId,
          },
        },
      },
    );
    const optimizedResume = pipelineResult.optimizedResume;

    // An optimization that did not meaningfully improve on the user's starting
    // resume is a failure worth counting, not a quiet +2 (WP-45 S2). Payload is
    // bucketed and carries no resume or job content.
    if (!pipelineResult.lift.meaningful) {
      await captureServerEvent(user.id, 'optimization_no_lift', {
        ...pipelineResult.lift.analyticsProperties,
        platform: 'web',
      });
    }

    const { reviewId } = await createOptimizationReviewRun({
      supabase,
      userId: user.id,
      resumeId,
      jobDescriptionId,
      resumeRawText: (resumeData as any).raw_text,
      jobDescriptionText,
      jobTitle: (jdData as { title?: string }).title || 'Position',
      jobExtractedJson: parsedData,
      optimizedResume,
    });

    // The fit check the user sees between optimizing and accepting.
    //
    // The pipeline already measured all of this and we were discarding it, so
    // the app had nothing to show and jumped straight to the accept screen —
    // which is why the fit check "disappeared" (founder, device test
    // 2026-07-26). `current` is the resume as it stands today against this job;
    // `potential` is where accepting the tailored rewrite takes it.
    //
    // `displayScores` carries the WP-45 S2 rule: when the run did not
    // meaningfully improve on the starting resume, the client shows the gaps
    // and the next step rather than a numeric pair that reads as a promise the
    // run did not keep.
    const ats = pipelineResult.atsResult;
    return NextResponse.json({
      reviewId,
      nextStep: "review",
      fit: {
        currentScore: ats.ats_score_original,
        potentialScore: ats.ats_score_optimized,
        delta: pipelineResult.lift.delta,
        displayScores: pipelineResult.lift.displayScores,
        confidence: ats.confidence,
        scoreVersion: ats.metadata?.score_version ?? null,
        // Already filtered through the S4 credibility gate upstream, so page
        // furniture like "about" or "key responsibilities" cannot appear here.
        topGaps: (ats.suggestions ?? []).slice(0, 3).map(s => ({
          title: s.text,
          // Integer on the wire, always. A fractional gain fails the iOS
          // decode of this entire response, not just this field. See
          // `@/lib/ats/wire-gain`.
          estimatedGain: toWireGain(s.estimated_gain),
          category: s.category,
        })),
      },
    });

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
