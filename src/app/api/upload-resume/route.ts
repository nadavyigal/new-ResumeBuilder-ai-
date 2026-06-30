import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { extractJob, ThinJobExtractionError } from "@/lib/scraper/jobExtractor";
import { scrapeJobDescription } from "@/lib/job-scraper";
import {
  buildJobDescriptionTextFromParsed,
  buildParsedDataFromPlainText,
  normalizeParsedJobData,
  resolveJobDescriptionText,
} from "@/lib/ats/job-data-resolver";
import { isSupportedResumeFile } from "@/lib/utils/file-validation";
import { convertResumeBuffer } from "@/lib/markitdown-client";
import path from "path";
import { logger } from "@/lib/agent/utils/logger";
import { createOptimizationReviewRun } from "@/lib/optimization-review/service";

// Ensure Node.js runtime for Buffer and outbound fetch
export const runtime = 'nodejs';
// Allow up to 120 s: PDF parse + job scrape + gpt-4o optimization + ATS embedding calls
export const maxDuration = 120;
import { runOptimizePipeline } from "@/lib/ai-optimizer/optimize-pipeline";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FR-021 & FR-022: Check freemium quota (DISABLED FOR NOW - Will be enabled later)
  // const { data: profile, error: profileError } = await supabase
  //   .from("profiles")
  //   .select("plan_type, optimizations_used")
  //   .eq("user_id", user.id)
  //   .single();

  // if (profileError) {
  //   console.error("Error fetching user profile:", profileError);
  //   return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  // }

  // if (profile.plan_type === 'free' && profile.optimizations_used >= 1) {
  //   return NextResponse.json({
  //     error: "Free tier limit reached",
  //     code: "QUOTA_EXCEEDED",
  //     message: "You have used your free optimization. Upgrade to premium for unlimited access.",
  //     requiresUpgrade: true,
  //     currentPlan: "free",
  //     optimizationsUsed: profile.optimizations_used,
  //   }, { status: 402 });
  // }

  try {
    const formData = await req.formData();
    const resumeFile = formData.get("resume") as File;
    const jobDescription = formData.get("jobDescription") as string;
    const jobDescriptionUrl = formData.get("jobDescriptionUrl") as string;
    const deferOptimization = formData.get("deferOptimization") === "true";

    if (!resumeFile) {
      return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
    }

    if (resumeFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Resume file must be under 10MB." }, { status: 400 });
    }

    // Get job description from either direct input or URL (with structured extraction)
    let jobDescriptionText = "";
    let extractedTitle: string | null = null;
    let extractedCompany: string | null = null;
    let extractedData: any = {};
    let sourceUrl: string | null = null;

    if (jobDescriptionUrl) {
      try {
        const extracted = await extractJob(jobDescriptionUrl);
        extractedTitle = extracted.job_title;
        extractedCompany = extracted.company_name;
        extractedData = normalizeParsedJobData(extracted);
        sourceUrl = jobDescriptionUrl;
        jobDescriptionText = buildJobDescriptionTextFromParsed(extractedData);
        if (!jobDescriptionText && extracted.about_this_job) {
          jobDescriptionText = extracted.about_this_job;
        }
      } catch (err) {
        const isThin =
          err instanceof ThinJobExtractionError ||
          (err as { code?: string })?.code === "THIN_JOB_EXTRACTION";

        if (isThin) {
          // The URL was fetched but came back effectively empty (e.g. LinkedIn
          // authwall). Prefer pasted text if the user provided it; otherwise
          // hard-fail with an actionable message instead of scoring garbage.
          if (jobDescription && jobDescription.trim()) {
            jobDescriptionText = jobDescription;
            extractedData = buildParsedDataFromPlainText(jobDescription, {
              sourceUrl: jobDescriptionUrl,
            });
            sourceUrl = jobDescriptionUrl;
          } else {
            return NextResponse.json(
              {
                error:
                  "We couldn't read that job link. Paste the job description text instead.",
                code: "JOB_URL_UNREADABLE",
                field: "jobDescription",
                sourceUrl: jobDescriptionUrl,
              },
              { status: 422 }
            );
          }
        } else {
          // Transient/parse failure (network, timeout): fall back to the simple
          // scraper, then to a URL-only stub so optimization can still proceed.
          try {
            const text = await scrapeJobDescription(jobDescriptionUrl);
            jobDescriptionText = text;
            extractedData = buildParsedDataFromPlainText(text, { sourceUrl: jobDescriptionUrl });
            sourceUrl = jobDescriptionUrl;
          } catch {
            jobDescriptionText = `Job Posting URL: ${jobDescriptionUrl}`;
            extractedData = { fallback: true, source_url: jobDescriptionUrl };
            sourceUrl = jobDescriptionUrl;
          }
        }
      }
    } else if (jobDescription) {
      jobDescriptionText = jobDescription;
      extractedData = buildParsedDataFromPlainText(jobDescription);
    } else {
      return NextResponse.json({ error: "Job description or URL is required." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await resumeFile.arrayBuffer());
    if (!isSupportedResumeFile(resumeFile, fileBuffer)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: 'Only PDF and DOCX files are supported.'
        },
        { status: 400 }
      );
    }

    // Sanitize filename — strip any directory components before storing
    const safeFileName = path.basename(resumeFile.name);

    let resumeMarkdown: string;
    try {
      const conversion = await convertResumeBuffer(fileBuffer, safeFileName);
      resumeMarkdown = conversion.markdown;
      if (!resumeMarkdown || resumeMarkdown.trim().length === 0) {
        throw new Error("Conversion produced empty output");
      }
    } catch (convErr) {
      const msg = convErr instanceof Error ? convErr.message : String(convErr);
      logger.warn('MarkItDown conversion failed', { fileName: resumeFile.name, error: msg });
      return NextResponse.json(
        { error: "Could not read your file. Please ensure it is a valid PDF or DOCX and try again." },
        { status: 422 }
      );
    }

    const resumeInsert = supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        filename: safeFileName,
        storage_path: `resumes/${user.id}/${Date.now()}_${safeFileName}`,
        raw_text: resumeMarkdown,
        canonical_data: {}, // Will be populated later during optimization
      })
      .select()
      .maybeSingle();

    const scoringJobText = resolveJobDescriptionText({
      raw_text: jobDescriptionText,
      clean_text: buildJobDescriptionTextFromParsed(extractedData),
      parsed_data: extractedData,
    });

    const jdInsert = supabase
      .from("job_descriptions")
      .insert({
        user_id: user.id,
        title: extractedTitle || "Job Position",
        company: extractedCompany || "Company Name",
        raw_text: jobDescriptionText,
        clean_text: scoringJobText,
        parsed_data: extractedData,
        source_url: sourceUrl,
      })
      .select()
      .maybeSingle();

    const [resumeResult, jdResult] = await Promise.all([resumeInsert, jdInsert]);

    const { data: resumeData, error: resumeError } = resumeResult;
    const { data: jdData, error: jdError } = jdResult;

    if (resumeError) {
      throw resumeError;
    }

    if (!resumeData) {
      throw new Error("Failed to create resume record - no data returned");
    }

    if (jdError) {
      throw jdError;
    }

    if (!jdData) {
      throw new Error("Failed to create job description record - no data returned");
    }

    if (deferOptimization) {
      return NextResponse.json({
        success: true,
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
        reviewId: null,
        nextStep: "optimize",
        matchScore: null,
        keyImprovements: [],
        missingKeywords: [],
      });
    }

    // Optimize resume using AI (two-pass pipeline with ATS feedback loop)
    logger.info('Starting AI optimization', {
      userId: user.id,
      resumeId: resumeData.id,
      jobDescriptionId: jdData.id,
    });
    const pipelineResult = await runOptimizePipeline(resumeMarkdown, scoringJobText, {
      jobExtractedJson: extractedData,
      aiTrace: {
        distinctId: user.id,
        traceName: 'optimize',
        properties: {
          source: 'upload-resume',
        },
      },
    });
    const optimizedResume = pipelineResult.optimizedResume;

    const { reviewId, reviewRun } = await createOptimizationReviewRun({
      supabase,
      userId: user.id,
      resumeId: resumeData.id,
      jobDescriptionId: jdData.id,
      resumeRawText: resumeMarkdown,
      jobDescriptionText: scoringJobText,
      jobTitle: extractedTitle || jdData.title,
      jobExtractedJson: extractedData,
      optimizedResume,
    });

    // FR-021: Increment optimization counter for user (DISABLED FOR NOW)
    // const { error: updateError } = await supabase
    //   .from("profiles")
    //   .update({ optimizations_used: profile.optimizations_used + 1 })
    //   .eq("user_id", user.id);

    // if (updateError) {
    //   console.error("Failed to update optimization counter:", updateError);
    // }

    logger.info('Optimization completed successfully', {
      reviewId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      resumeId: resumeData.id,
      jobDescriptionId: jdData.id,
      reviewId,
      nextStep: "review",
      matchScore: reviewRun.ats_preview_json?.after || pipelineResult.atsResult.ats_score_optimized || 0,
      keyImprovements: optimizedResume.keyImprovements,
      missingKeywords: optimizedResume.missingKeywords,
    });

  } catch (error: unknown) {
    logger.error('Error uploading resume', { userId: user?.id ?? null }, error);

    let errorMessage = "Something went wrong. Please try again.";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY') || error.message.includes('Invalid OpenAI API key')) {
        statusCode = 503;
        errorMessage = "AI service is not configured. Please contact support.";
      } else if (error.message.includes('quota exceeded') || error.message.includes('rate limit') || error.message.includes('rate_limit')) {
        statusCode = 429;
        errorMessage = "AI service is temporarily busy. Please try again in a moment.";
      } else if (error.message.includes('Could not read your file')) {
        statusCode = 422;
        errorMessage = error.message;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
