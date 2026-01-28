import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { parsePdf } from "@/lib/pdf-parser";
import { extractJob } from "@/lib/scraper/jobExtractor";
import { scrapeJobDescription } from "@/lib/job-scraper";
import { captureServerEvent } from "@/lib/posthog-server";
import { isPdfUpload } from "@/lib/utils/pdf-validation";
import { logger } from "@/lib/agent/utils/logger";

// Ensure Node.js runtime for Buffer and outbound fetch
export const runtime = 'nodejs';
import { optimizeResume } from "@/lib/ai-optimizer";
import { scoreOptimization } from "@/lib/ats/integration";

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
        extractedData = extracted;
        sourceUrl = jobDescriptionUrl;

        const parts: string[] = [];
        if (extracted.job_title) parts.push(`Job Title: ${extracted.job_title}`);
        if (extracted.company_name) parts.push(`Company: ${extracted.company_name}`);
        if (extracted.location) parts.push(`Location: ${extracted.location}`);
        if (extracted.about_this_job) parts.push(`About: ${extracted.about_this_job}`);
        if (extracted.requirements?.length) parts.push(`Requirements: ${extracted.requirements.join("; ")}`);
        if (extracted.responsibilities?.length) parts.push(`Responsibilities: ${extracted.responsibilities.join("; ")}`);
        if (extracted.qualifications?.length) parts.push(`Qualifications: ${extracted.qualifications.join("; ")}`);
        jobDescriptionText = parts.join("\n");
      } catch {
        // Fallback to simple scraper if structured extraction fails
        try {
          const text = await scrapeJobDescription(jobDescriptionUrl);
          jobDescriptionText = text;
          extractedData = { fallback: true, source_url: jobDescriptionUrl };
          sourceUrl = jobDescriptionUrl;
        } catch {
          // Final fallback: proceed with URL only so optimization can continue
          jobDescriptionText = `Job Posting URL: ${jobDescriptionUrl}`;
          extractedData = { fallback: true, source_url: jobDescriptionUrl };
          sourceUrl = jobDescriptionUrl;
        }
      }
    } else if (jobDescription) {
      jobDescriptionText = jobDescription;
    } else {
      return NextResponse.json({ error: "Job description or URL is required." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await resumeFile.arrayBuffer());
    if (!isPdfUpload(resumeFile, fileBuffer)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: 'Only PDF files are currently supported. DOC/DOCX support coming soon.'
        },
        { status: 400 }
      );
    }

    const pdfData = await parsePdf(fileBuffer);

    const resumeInsert = supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        filename: resumeFile.name,
        storage_path: `resumes/${user.id}/${Date.now()}_${resumeFile.name}`,
        raw_text: pdfData.text,
        canonical_data: {}, // Will be populated later during optimization
      })
      .select()
      .maybeSingle();

    const jdInsert = supabase
      .from("job_descriptions")
      .insert({
        user_id: user.id,
        title: extractedTitle || "Job Position",
        company: extractedCompany || "Company Name",
        raw_text: jobDescriptionText,
        clean_text: jobDescriptionText,
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

    // Optimize resume using AI
    logger.info('Starting AI optimization', {
      userId: user.id,
      resumeId: resumeData.id,
      jobDescriptionId: jdData.id,
    });
    const optimizationResult = await optimizeResume(pdfData.text, jobDescriptionText);

    if (!optimizationResult.success) {
      logger.error('AI optimization failed', {
        userId: user.id,
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
        error: optimizationResult.error,
      }, optimizationResult.error);
      return NextResponse.json({
        error: `Resume uploaded but optimization failed: ${optimizationResult.error}`,
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      }, { status: 500 });
    }

    const optimizedResume = optimizationResult.optimizedResume;
    if (!optimizedResume) {
      logger.error('AI optimization returned no resume payload', {
        userId: user.id,
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      });
      return NextResponse.json({
        error: "Optimization completed but no resume data was returned",
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      }, { status: 500 });
    }

    // Validate and normalize match_score - must be a number between 0-100
    let matchScore = 0;
    const rawScore = optimizedResume.matchScore;

    if (typeof rawScore === 'number' && !isNaN(rawScore)) {
      matchScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    } else if (typeof rawScore === 'string') {
      // Try to parse string to number
      const parsed = parseFloat(rawScore);
      if (!isNaN(parsed)) {
        matchScore = Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }

    // Score the optimization using ATS v2
    let atsResult = null;
    try {
      logger.info('Starting ATS v2 scoring', { resumeId: resumeData.id, userId: user.id });
      const scoringPromise = scoreOptimization({
        resumeOriginalText: pdfData.text,
        resumeOptimizedJson: optimizedResume,
        jobDescriptionText: jobDescriptionText,
        jobTitle: extractedTitle || 'Position',
      });

      // Add timeout to prevent hanging (60 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ATS scoring timeout')), 60000)
      );

      atsResult = await Promise.race([scoringPromise, timeoutPromise]) as any;

      logger.info('ATS v2 scoring completed', {
        resumeId: resumeData.id,
        original: atsResult?.ats_score_original,
        optimized: atsResult?.ats_score_optimized,
        improvement: (atsResult?.ats_score_optimized || 0) - (atsResult?.ats_score_original || 0),
        suggestions: atsResult?.suggestions?.length || 0,
      });
    } catch (atsError: any) {
      logger.error('ATS v2 scoring failed, continuing without it', {
        resumeId: resumeData.id,
        userId: user.id,
        error: atsError?.message,
      }, atsError);
      // Continue with optimization even if ATS scoring fails
      atsResult = null;
    }

    // Save optimization results
    const { data: optimizationData, error: optimizationError } = await supabase
      .from("optimizations")
      .insert({
        user_id: user.id,
        resume_id: resumeData.id,
        jd_id: jdData.id,
        match_score: atsResult?.ats_score_optimized || matchScore,
        gaps_data: {
          missingKeywords: optimizedResume.missingKeywords || [],
          keyImprovements: optimizedResume.keyImprovements || [],
        },
        rewrite_data: optimizedResume,
        template_key: 'natural', // Default natural design (no template)
        status: 'completed' as const,
        // ATS v2 fields - always use version 2
        ats_version: 2,
        ats_score_original: atsResult?.ats_score_original || null,
        ats_score_optimized: atsResult?.ats_score_optimized || null,
        ats_subscores: atsResult?.subscores || null,
        ats_subscores_original: atsResult?.subscores_original || null,
        ats_suggestions: atsResult?.suggestions || null,
        ats_confidence: atsResult?.confidence || null,
      })
      .select()
      .maybeSingle();

    // Track optimization completed (server-side)
    if (!optimizationError && optimizationData) {
      await captureServerEvent(user.id, 'optimization_completed', {
        optimization_id: optimizationData.id,
        ats_score_original: atsResult?.ats_score_original || null,
        ats_score_optimized: atsResult?.ats_score_optimized || matchScore,
        improvement: (atsResult?.ats_score_optimized || matchScore) - (atsResult?.ats_score_original || 0),
        has_job_url: !!jobDescriptionUrl,
        job_title: extractedTitle || null,
        company: extractedCompany || null,
        source: 'upload_resume_api',
      });
    }

    if (optimizationError) {
      logger.error('Failed to save optimization record', {
        userId: user.id,
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      }, optimizationError);
      return NextResponse.json({
        error: "Optimization completed but failed to save results",
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      }, { status: 500 });
    }

    if (!optimizationData) {
      logger.error('Optimization save returned no data', {
        userId: user.id,
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      });
      return NextResponse.json({
        error: "Optimization completed but failed to save results - no data returned",
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      }, { status: 500 });
    }

    // FR-021: Increment optimization counter for user (DISABLED FOR NOW)
    // const { error: updateError } = await supabase
    //   .from("profiles")
    //   .update({ optimizations_used: profile.optimizations_used + 1 })
    //   .eq("user_id", user.id);

    // if (updateError) {
    //   console.error("Failed to update optimization counter:", updateError);
    // }

    logger.info('Optimization completed successfully', {
      optimizationId: optimizationData.id,
      matchScore,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      resumeId: resumeData.id,
      jobDescriptionId: jdData.id,
      optimizationId: optimizationData.id,
      matchScore: matchScore,
      keyImprovements: optimizedResume.keyImprovements,
      missingKeywords: optimizedResume.missingKeywords,
    });

  } catch (error: unknown) {
    logger.error('Error uploading resume', { userId: user?.id ?? null }, error);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
