import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { parsePdf } from "@/lib/pdf-parser";
import { cookies } from "next/headers";
import { scrapeJobDescription } from "@/lib/job-scraper";
import { optimizeResume } from "@/lib/ai-optimizer";

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FR-021 & FR-022: Check freemium quota (DISABLED FOR DEVELOPMENT)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan_type, optimizations_used")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching user profile:", profileError);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }

  // FR-021: Free tier users can only use 1 optimization (COMMENTED OUT FOR DEVELOPMENT)
  // if (profile.plan_type === 'free' && profile.optimizations_used >= 1) {
  //   // FR-022: Return paywall response
  //   return NextResponse.json({
  //     error: "Free tier limit reached",
  //     code: "QUOTA_EXCEEDED",
  //     message: "You have used your free optimization. Upgrade to premium for unlimited access.",
  //     requiresUpgrade: true,
  //     currentPlan: "free",
  //     optimizationsUsed: profile.optimizations_used,
  //   }, { status: 402 }); // 402 Payment Required
  // }

  try {
    const formData = await req.formData();
    const resumeFile = formData.get("resume") as File;
    const jobDescription = formData.get("jobDescription") as string;
    const jobDescriptionUrl = formData.get("jobDescriptionUrl") as string;

    if (!resumeFile) {
      return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
    }

    // Get job description text from either direct input or URL
    let jobDescriptionText = "";
    if (jobDescriptionUrl) {
      jobDescriptionText = await scrapeJobDescription(jobDescriptionUrl);
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
          title: "Job Position", // Will be extracted later
          company: "Company Name", // Will be extracted later
          raw_text: jobDescriptionText,
          clean_text: jobDescriptionText, // Basic cleaning for now
          extracted_data: {}, // Will be populated during optimization
          source_url: jobDescriptionUrl || null,
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