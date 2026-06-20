/**
 * GET /api/debug/scrape-check?url=<job url>&token=<secret>
 *
 * Preview-only diagnostic for the LinkedIn scrape fix. A real LinkedIn authwall
 * only reproduces from a datacenter (Vercel) egress IP, so this lets us verify
 * the deployed function actually pulls full job content.
 *
 * Hard-gated: returns 404 unless running on a Vercel PREVIEW deployment AND the
 * ?token matches SCRAPE_CHECK_TOKEN. It can never run in production. Remove this
 * route (or leave it permanently 404-gated) after verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractJob, isThinExtraction, ThinJobExtractionError } from "@/lib/scraper/jobExtractor";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const token = request.nextUrl.searchParams.get("token");
  const expected = process.env.SCRAPE_CHECK_TOKEN;

  if (!isPreview || !expected || token !== expected) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing ?url" }, { status: 400 });
  }

  try {
    const data = await extractJob(url);
    return NextResponse.json({
      ok: true,
      finalUrl: data.source_url,
      titleLen: (data.job_title || "").length,
      companyLen: (data.company_name || "").length,
      aboutLen: (data.about_this_job || "").length,
      requirementsCount: data.requirements?.length ?? 0,
      qualificationsCount: data.qualifications?.length ?? 0,
      responsibilitiesCount: data.responsibilities?.length ?? 0,
      isThin: isThinExtraction(data),
    });
  } catch (err) {
    if (err instanceof ThinJobExtractionError) {
      return NextResponse.json({ ok: false, thin: true, url: err.url });
    }
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message },
      { status: 500 }
    );
  }
}
