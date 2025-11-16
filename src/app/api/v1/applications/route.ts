import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase-server";
import { extractJob } from "@/lib/scraper/jobExtractor";

/**
 * POST /api/v1/applications
 * Save HTML snapshot + metadata to Storage and DB
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      html,
      url,
      optimizationId,
      jobTitle,
      company,
      atsScore,
      contact,
      appliedDate,
    } = body || {};

    // Two modes: 1) legacy snapshot mode requires html+optimizationId+jobTitle+company
    //            2) URL mode requires url (extraction fills fields), optimizationId optional
    if (!url && (!html || !optimizationId || !jobTitle || !company)) {
      return NextResponse.json({
        error: "Missing required fields",
        required: ["url"] as string[] || ["html", "optimizationId", "jobTitle", "company"],
      }, { status: 400 });
    }

    // Verify optimization belongs to user when provided
    if (optimizationId) {
      const { data: optimization, error: optError } = await supabase
        .from("optimizations")
        .select("id, user_id")
        .eq("id", optimizationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (optError || !optimization) {
        return NextResponse.json({ error: "Optimization not found or access denied" }, { status: 404 });
      }
    }

    // If URL provided, perform extraction and map fields
    let extracted: any = null;
    let mappedJobTitle: string | null = jobTitle || null;
    let mappedCompany: string | null = company || null;
    let sourceUrl: string | null = (body?.jobUrl as string | undefined) || null;
    if (url) {
      console.log('[extract] Extracting job from URL:', url);
      extracted = await extractJob(url);
      console.log('[extract] Extracted data:', {
        company: extracted.company_name,
        title: extracted.job_title,
        sourceUrl: extracted.source_url
      });
      mappedJobTitle = extracted.job_title || mappedJobTitle;
      mappedCompany = extracted.company_name || mappedCompany;
      sourceUrl = extracted.source_url;
    }

    // Create DB row first to get application id (avoid new columns for backward compatibility)
    const { data: application, error: insertError } = await supabase
      .from("applications")
      .insert([
        {
          user_id: user.id,
          optimization_id: optimizationId || null,
          job_title: mappedJobTitle,
          company_name: mappedCompany,
          status: "applied",
          applied_date: appliedDate || new Date().toISOString(),
          ats_score: atsScore ?? null,
          contact: contact ?? null,
        },
      ])
      .select("id")
      .maybeSingle();

    if (insertError) {
      return NextResponse.json({ error: insertError.message || "Failed to create application" }, { status: 500 });
    }

    if (!application) {
      return NextResponse.json({ error: "Failed to create application - no data returned" }, { status: 500 });
    }

    const appId = application.id as string;
    const basePath = `applications/${user.id}/${appId}`;

    // Upload HTML and metadata to Storage when provided or derived
    const storage = (await createServiceRoleClient()).storage.from("applications");

    let htmlContent = html as string | undefined;
    if (!htmlContent && extracted?.about_this_job) {
      // Generate a minimal HTML summary for preview if URL flow without provided HTML
      const titleText = [mappedJobTitle, mappedCompany].filter(Boolean).join(" - ");
      const body = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>${titleText}</title></head><body><h1>${titleText}</h1><section><h2>About this job</h2><p>${extracted.about_this_job}</p></section></body></html>`;
      htmlContent = body;
    }

    if (htmlContent) {
      const htmlUpload = await storage.upload(`${basePath}/resume.html`, new Blob([htmlContent], { type: "text/html" }), { upsert: true });
      if (htmlUpload.error) {
        return NextResponse.json({ error: `Upload HTML failed: ${htmlUpload.error.message}` }, { status: 500 });
      }
    }

    const metadata = {
      optimizationId: optimizationId || null,
      jobTitle: mappedJobTitle,
      company: mappedCompany,
      appliedDate: appliedDate || new Date().toISOString(),
      atsScore: atsScore ?? null,
      contact: contact ?? null,
      sourceUrl: sourceUrl || null,
      extracted: extracted || null,
      createdAt: new Date().toISOString(),
    };

    const jsonUpload = await storage.upload(`${basePath}/metadata.json`, new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" }), { upsert: true });
    if (jsonUpload.error) {
      return NextResponse.json({ error: `Upload metadata failed: ${jsonUpload.error.message}` }, { status: 500 });
    }

    // Update DB with storage paths when we uploaded HTML
    const updatePayload: Record<string, string | null> = {};
    if (htmlContent) updatePayload["resume_html_path"] = `${basePath}/resume.html`;
    updatePayload["resume_json_path"] = `${basePath}/metadata.json`;

    const { error: updateError } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("id", appId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: `Failed to update application: ${updateError.message}` }, { status: 500 });
    }

    // Best-effort: try to persist new fields if migration is applied; ignore if columns missing
    if (sourceUrl || extracted) {
      console.log('[db] Saving job_extraction to database:', { sourceUrl, hasExtracted: !!extracted });
      const { error: optionalErr } = await supabase
        .from("applications")
        .update({
          // @ts-ignore - columns may not exist pre-migration
          source_url: sourceUrl || null,
          // @ts-ignore - columns may not exist pre-migration
          job_extraction: extracted || null,
        } as any)
        .eq("id", appId)
        .eq("user_id", user.id);
      // If optionalErr mentions missing column, ignore
      if (optionalErr && !/column .* does not exist/i.test(optionalErr.message)) {
        // Log-only path; do not fail request to avoid blocking UX
        console.warn("[warn] Optional fields update failed:", optionalErr.message);
      } else if (optionalErr) {
        console.warn("[warn] Columns don't exist (migration not applied):", optionalErr.message);
      } else {
        console.log('[ok] Saved job_extraction to database');
      }
    }

    return NextResponse.json({ success: true, id: appId }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}

/**
 * GET /api/v1/applications
 * List applications with optional search and date filters
 */
export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

  try {
    let query = supabase
      .from("applications")
      .select("id, job_title, company_name, applied_date, apply_clicked_at, ats_score, contact, resume_html_path, resume_json_path, optimized_resume_url, source_url, optimization_id, job_extraction")
      .eq("user_id", user.id)
      .order("applied_date", { ascending: false })
      .limit(limit);

    if (from) query = query.gte("applied_date", from);
    if (to) query = query.lte("applied_date", to);

    if (q) {
      // Use ILIKE on job_title and company_name for simplicity
      query = query.or(`job_title.ilike.%${q}%,company_name.ilike.%${q}%`);
    }

    let { data, error } = await query;
    if (error && /column .* does not exist/i.test(error.message)) {
      // Fallback to legacy selection before migrations are applied
      const fallback = await supabase
        .from("applications")
        .select("id, job_title, company_name, applied_date, ats_score, contact, resume_html_path, resume_json_path, optimization_id, job_extraction")
        .eq("user_id", user.id)
        .order("applied_date", { ascending: false })
        .limit(limit);
      data = fallback.data as any;
      error = fallback.error as any;
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich results with optimization/job description data to ensure real title/company and ATS
    const apps = (data || []) as any[];
    const optimizationIds = apps.map(a => a.optimization_id).filter(Boolean);
    if (optimizationIds.length > 0) {
      const { data: optRows } = await supabase
        .from('optimizations')
        .select('id, user_id, jd_id')
        .in('id', optimizationIds)
        .eq('user_id', user.id);

      const jdIds = (optRows || []).map((o: any) => o.jd_id).filter(Boolean);
      let jdRows: any[] = [];
      if (jdIds.length > 0) {
        const { data: jds } = await supabase
          .from('job_descriptions')
          .select('id, title, company, source_url')
          .in('id', jdIds);
        jdRows = jds || [];
      }

      const optById = new Map((optRows || []).map((o: any) => [o.id, o]));
      const jdById = new Map(jdRows.map((j: any) => [j.id, j]));

      for (const a of apps) {
        const opt = optById.get(a.optimization_id);
        if (opt) {
          const jd = jdById.get(opt.jd_id);
          if (jd) {
            // Only use JD data as fallback if job_extraction doesn't have better data
            if (jd.title && !a.job_extraction?.job_title) a.job_title = jd.title;
            if (jd.company && !a.job_extraction?.company_name) a.company_name = jd.company;
            if (jd.source_url && !a.source_url) a.source_url = jd.source_url;
          }
        }
      }

      // Backfill ATS score from design templates via resume_design_assignments
      const { data: assignments } = await supabase
        .from('resume_design_assignments')
        .select('optimization_id, template_id')
        .in('optimization_id', optimizationIds);
      const templateIds = Array.from(new Set((assignments || []).map((a: any) => a.template_id).filter(Boolean)));
      let templates: any[] = [];
      if (templateIds.length > 0) {
        const { data: t } = await supabase
          .from('design_templates')
          .select('id, ats_score');
        templates = t || [];
      }
      const tmplById = new Map(templates.map((t: any) => [t.id, t]));
      const assignByOpt = new Map((assignments || []).map((a: any) => [a.optimization_id, a]));
      for (const a of apps) {
        if (a.ats_score != null) continue;
        const asg = assignByOpt.get(a.optimization_id);
        if (!asg) continue;
        const tmpl = tmplById.get(asg.template_id);
        if (tmpl && tmpl.ats_score != null) {
          a.ats_score = tmpl.ats_score;
        }
      }
    }

    // Fallback enrichment per-row (handles ID type mismatches or empty batch results)
    // Only fill in missing data that job_extraction doesn't already provide
    for (const a of apps) {
      const needsCompany = (!a.company_name || a.company_name === 'Company Name') && !a.job_extraction?.company_name;
      const needsTitle = (!a.job_title || a.job_title === 'Job Position') && !a.job_extraction?.job_title;
      const needsUrl = !a.source_url;
      if (!(needsCompany || needsTitle || needsUrl)) continue;
      if (!a.optimization_id) continue;
      // Fetch optimization → job description
      const { data: optRow } = await supabase
        .from('optimizations')
        .select('jd_id')
        .eq('id', a.optimization_id)
        .maybeSingle();
      if (optRow && (optRow as any).jd_id != null) {
        const { data: jd } = await supabase
          .from('job_descriptions')
          .select('title, company, source_url')
          .eq('id', (optRow as any).jd_id)
          .maybeSingle();
        if (jd) {
          if (needsTitle && (jd as any).title) a.job_title = (jd as any).title;
          if (needsCompany && (jd as any).company) a.company_name = (jd as any).company;
          if (needsUrl && (jd as any).source_url) a.source_url = (jd as any).source_url;
        }
      }
    }

    // Best-effort: read metadata.json from Storage to backfill any missing fields
    try {
      const storage = (await createServiceRoleClient()).storage.from('applications');
      await Promise.all(apps.map(async (a) => {
        if (!a.resume_json_path) return;
        if (a.company_name && a.job_title && a.source_url && a.ats_score != null) return;
        const dl = await storage.download(a.resume_json_path as string);
        if ('data' in dl && dl.data) {
          const text = await (dl.data as Blob).text();
          try {
            const meta = JSON.parse(text);
            if (!a.company_name && meta.company) a.company_name = meta.company;
            if (!a.job_title && meta.jobTitle) a.job_title = meta.jobTitle;
            if (!a.source_url && meta.sourceUrl) a.source_url = meta.sourceUrl;
            if (a.ats_score == null && (meta.atsScore != null)) a.ats_score = meta.atsScore;
          } catch (_) {
            // ignore malformed
          }
        }
      }));
    } catch (_) {
      // ignore storage errors
    }

    return NextResponse.json({ success: true, applications: apps });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}


