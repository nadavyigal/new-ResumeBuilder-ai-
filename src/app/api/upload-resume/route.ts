import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { parsePdf } from "@/lib/pdf-parser";
import { cookies } from "next/headers";
import { extractJob } from "@/lib/scraper/jobExtractor";
import { scrapeJobDescription } from "@/lib/job-scraper";

// Ensure Node.js runtime for Buffer and outbound fetch
export const runtime = 'nodejs';
import { optimizeResume } from "@/lib/ai-optimizer";

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FR-021 & FR-022: Check freemium quota
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan_type, optimizations_used")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching user profile:", profileError);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }

  // FR-021: Free tier users can only use 1 optimization
  if (profile.plan_type === 'free' && profile.optimizations_used >= 1) {
    // FR-022: Return paywall response
    return NextResponse.json({
      error: "Free tier limit reached",
      code: "QUOTA_EXCEEDED",
      message: "You have used your free optimization. Upgrade to premium for unlimited access.",
      requiresUpgrade: true,
      currentPlan: "free",
      optimizationsUsed: profile.optimizations_used,
    }, { status: 402 }); // 402 Payment Required
  }

  try {
    const formData = await req.formData();
    const resumeFile = formData.get("resume") as File;
    const jobDescription = formData.get("jobDescription") as string;
    const jobDescriptionUrl = formData.get("jobDescriptionUrl") as string;

    if (!resumeFile) {
      return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
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

        // Build a concise text for AI from structured fields
        const parts: string[] = [];
        if (extracted.job_title) parts.push(`Job Title: ${extracted.job_title}`);
        if (extracted.company_name) parts.push(`Company: ${extracted.company_name}`);
        if (extracted.location) parts.push(`Location: ${extracted.location}`);
        if (extracted.about_this_job) parts.push(`About: ${extracted.about_this_job}`);
        if (extracted.requirements?.length) parts.push(`Requirements: ${extracted.requirements.join("; ")}`);
        if (extracted.responsibilities?.length) parts.push(`Responsibilities: ${extracted.responsibilities.join("; ")}`);
        if (extracted.qualifications?.length) parts.push(`Qualifications: ${extracted.qualifications.join("; ")}`);
        jobDescriptionText = parts.join("\n");
      } catch (e) {
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
    const pdfData = await parsePdf(fileBuffer);

    const { data: resumeData, error: resumeError } = await supabase
      .from("resumes")
      .insert([
        {
          user_id: user.id,
          filename: resumeFile.name,
          storage_path: `resumes/${user.id}/${Date.now()}_${resumeFile.name}`,
          raw_text: pdfData.text,
          canonical_data: {}, // Will be populated later during optimization
        },
      ])
      .select()
      .single();

    if (resumeError) {
      throw resumeError;
    }

    const { data: jdData, error: jdError } = await supabase
      .from("job_descriptions")
      .insert([
        {
          user_id: user.id,
          title: extractedTitle || "Job Position",
          company: extractedCompany || "Company Name",
          raw_text: jobDescriptionText,
          clean_text: jobDescriptionText,
          extracted_data: extractedData,
          source_url: sourceUrl,
        },
      ])
      .select()
      .single();

    if (jdError) {
      throw jdError;
    }

    // Optimize resume using AI
    console.log("Starting AI optimization...");
    const optimizationResult = await optimizeResume(pdfData.text, jobDescriptionText);

    if (!optimizationResult.success) {
      console.error("Optimization failed:", optimizationResult.error);
      return NextResponse.json({
        error: `Resume uploaded but optimization failed: ${optimizationResult.error}`,
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      }, { status: 500 });
    }

    // Save optimization results
    const { data: optimizationData, error: optimizationError } = await supabase
      .from("optimizations")
      .insert([
        {
          user_id: user.id,
          resume_id: resumeData.id,
          jd_id: jdData.id,
          match_score: optimizationResult.optimizedResume?.matchScore || 0,
          gaps_data: {
            missingKeywords: optimizationResult.optimizedResume?.missingKeywords || [],
            keyImprovements: optimizationResult.optimizedResume?.keyImprovements || [],
          },
          rewrite_data: optimizationResult.optimizedResume,
          template_key: 'ats-simple',
          status: 'completed' as const,
        },
      ])
      .select()
      .single();

    if (optimizationError) {
      console.error("Failed to save optimization:", optimizationError);
      return NextResponse.json({
        error: "Optimization completed but failed to save results",
        resumeId: resumeData.id,
        jobDescriptionId: jdData.id,
      }, { status: 500 });
    }

    // FR-021: Increment optimization counter for user
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ optimizations_used: profile.optimizations_used + 1 })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update optimization counter:", updateError);
      // Don't fail the request, just log the error
    }

    console.log(`Optimization completed successfully. Match score: ${optimizationResult.optimizedResume?.matchScore}%`);

    return NextResponse.json({
      success: true,
      resumeId: resumeData.id,
      jobDescriptionId: jdData.id,
      optimizationId: optimizationData.id,
      matchScore: optimizationResult.optimizedResume?.matchScore,
      keyImprovements: optimizationResult.optimizedResume?.keyImprovements,
      missingKeywords: optimizationResult.optimizedResume?.missingKeywords,
    });

  } catch (error: unknown) {
    console.error("Error uploading resume:", error);
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
