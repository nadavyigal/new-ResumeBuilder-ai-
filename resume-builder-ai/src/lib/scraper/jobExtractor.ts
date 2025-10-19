// Lightweight HTML extraction utilities for job postings
// Best-effort parsing without external dependencies

export interface ExtractedJobData {
  source_url: string;
  source_domain: string;
  scraped_at: string;
  company_name: string | null;
  job_title: string | null;
  contact_person: string | null;
  location: string | null;
  employment_type: string | null;
  seniority: string | null;
  compensation: string | null;
  about_this_job: string | null;
  requirements: string[] | null;
  responsibilities: string[] | null;
  qualifications: string[] | null;
  nice_to_have: string[] | null;
  benefits: string[] | null;
  application_instructions: string[] | null;
  posting_id: string | null;
  provenance: Record<string, string | null>;
  summary_for_ui: {
    company_name: string | null;
    job_title: string | null;
    contact_person: string | null;
    location: string | null;
  };
}

function textBetween(html: string, start: RegExp, end: RegExp): string | null {
  const s = html.match(start);
  if (!s) return null;
  const slice = html.slice(s.index! + (s[0]?.length || 0));
  const e = slice.match(end);
  const content = e ? slice.slice(0, e.index) : slice;
  return sanitizeText(content);
}

function sanitizeText(s: string | null | undefined): string | null {
  if (!s) return null;
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function extractListAfterHeading(html: string, headingRegex: RegExp): string[] | null {
  const match = html.match(headingRegex);
  if (!match || match.index == null) return null;
  const startIdx = match.index;
  const slice = html.slice(startIdx);
  // Look for immediate <ul> or a sequence of <li>
  const ulMatch = slice.match(/<ul[\s\S]*?<\/ul>/i);
  if (ulMatch) {
    const ul = ulMatch[0];
    const items = [...ul.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => sanitizeText(m[1])).filter(Boolean) as string[];
    return items.length ? items : null;
  }
  // Fallback: collect next few paragraphs
  const paras = [...slice.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 5).map(m => sanitizeText(m[1])).filter(Boolean) as string[];
  return paras.length ? paras : null;
}

function extractTitleFromTitleTag(html: string): string | null {
  const t = textBetween(html, /<title[^>]*>/i, /<\/title>/i);
  if (!t) return null;
  // Common pattern: "Senior Engineer - Company | LinkedIn"
  return t.replace(/\|\s*LinkedIn.*$/i, "").trim();
}

function extractMetaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const m = html.match(re);
  return m ? sanitizeText(m[1]) : null;
}

export async function extractFromLinkedIn(html: string, url: string): Promise<ExtractedJobData> {
  const domain = new URL(url).hostname;
  // Try to extract from known containers
  // LinkedIn often includes company and title in meta tags
  const metaTitle = extractMetaContent(html, "og:title") || extractTitleFromTitleTag(html);
  const metaDesc = extractMetaContent(html, "og:description");

  let job_title: string | null = null;
  let company_name: string | null = null;
  if (metaTitle) {
    // Heuristic split: "Job Title at Company" or "Company: Job Title"
    const atSplit = metaTitle.split(/\s+at\s+/i);
    if (atSplit.length === 2) {
      job_title = atSplit[0].trim();
      company_name = atSplit[1].trim();
    } else {
      job_title = metaTitle.trim();
    }
  }

  // Location from meta or inline text
  const location = extractMetaContent(html, "job:location") ||
    sanitizeText((html.match(/"job-location"[^>]*>([\s\S]*?)<\//i)?.[1])) ||
    sanitizeText((html.match(/<li[^>]*class=["'][^"']*?job-criteria__item[^"']*["'][^>]*>[\s\S]*?<span[^>]*>Location<\/[\s\S]*?<span[^>]*>([\s\S]*?)<\//i)?.[1]));

  const about_this_job = metaDesc || textBetween(html, /<h2[^>]*>About[^<]*<\/h2>/i, /<h2|<footer|<section/i);
  const responsibilities = extractListAfterHeading(html, /<h2[^>]*>(What you[’']ll do|Responsibilities)<\/h2>/i);
  const qualifications = extractListAfterHeading(html, /<h2[^>]*>(Qualifications|What you bring|Basic Qualifications)<\/h2>/i);
  const requirements = extractListAfterHeading(html, /<h2[^>]*>(Requirements|Skills|You have)<\/h2>/i) || qualifications;
  const benefits = extractListAfterHeading(html, /<h2[^>]*>(Benefits|Perks)<\/h2>/i);

  const contact_person = null; // Rarely explicit on LinkedIn
  const employment_type = sanitizeText((html.match(/Employment Type<[^>]*>\s*<span[^>]*>([\s\S]*?)<\//i)?.[1])) || null;
  const seniority = sanitizeText((html.match(/Seniority level<[^>]*>\s*<span[^>]*>([\s\S]*?)<\//i)?.[1])) || null;
  const compensation = sanitizeText((html.match(/Pay|Salary|Compensation[\s\S]{0,40}<[^>]*>([\s\S]*?)<\//i)?.[1])) || null;

  const extracted: ExtractedJobData = {
    source_url: url,
    source_domain: domain,
    scraped_at: new Date().toISOString(),
    company_name,
    job_title,
    contact_person,
    location,
    employment_type,
    seniority,
    compensation,
    about_this_job: sanitizeText(about_this_job),
    requirements: requirements || null,
    responsibilities: responsibilities || null,
    qualifications: qualifications || null,
    nice_to_have: null,
    benefits: benefits || null,
    application_instructions: null,
    posting_id: sanitizeText((html.match(/data-job-id=\"(\d+)\"/i)?.[1])) || null,
    provenance: {
      company_name: company_name,
      job_title: job_title,
      contact_person: null,
      about_this_job: about_this_job ? "meta og:description or About section" : null,
      requirements: requirements ? "h2 Requirements/Skills section" : null,
      responsibilities: responsibilities ? "h2 Responsibilities section" : null,
      qualifications: qualifications ? "h2 Qualifications section" : null,
      nice_to_have: null,
      benefits: benefits ? "h2 Benefits section" : null,
      application_instructions: null,
      compensation: compensation ? "Compensation/Salary snippet" : null,
    },
    summary_for_ui: {
      company_name,
      job_title,
      contact_person,
      location,
    },
  };

  return extracted;
}

export async function extractGeneric(html: string, url: string): Promise<ExtractedJobData> {
  const domain = new URL(url).hostname;
  const title = extractTitleFromTitleTag(html);
  const h1Title = sanitizeText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]));
  const job_title = h1Title || title || null;
  // Heuristic: company often in meta og:site_name or in title suffix
  const company_name = extractMetaContent(html, "og:site_name") || null;
  const about_this_job = textBetween(html, /<h2[^>]*>(About|Overview)[^<]*<\/h2>/i, /<h2|<footer|<section/i) || null;
  const requirements = extractListAfterHeading(html, /<h2[^>]*>(Requirements|Skills|You have)<\/h2>/i);
  const responsibilities = extractListAfterHeading(html, /<h2[^>]*>(Responsibilities|What you will do|What you’ll do)<\/h2>/i);
  const qualifications = extractListAfterHeading(html, /<h2[^>]*>(Qualifications|Your background)<\/h2>/i);
  const benefits = extractListAfterHeading(html, /<h2[^>]*>(Benefits|Perks)<\/h2>/i);
  const location = sanitizeText((html.match(/Location[:\s]<[^>]*>([\s\S]*?)<\//i)?.[1])) || null;

  return {
    source_url: url,
    source_domain: domain,
    scraped_at: new Date().toISOString(),
    company_name,
    job_title,
    contact_person: null,
    location,
    employment_type: null,
    seniority: null,
    compensation: null,
    about_this_job: sanitizeText(about_this_job),
    requirements: requirements || null,
    responsibilities: responsibilities || null,
    qualifications: qualifications || null,
    nice_to_have: null,
    benefits: benefits || null,
    application_instructions: null,
    posting_id: null,
    provenance: {
      company_name,
      job_title,
      contact_person: null,
      about_this_job: about_this_job ? "About/Overview section" : null,
      requirements: requirements ? "Requirements/Skills section" : null,
      responsibilities: responsibilities ? "Responsibilities section" : null,
      qualifications: qualifications ? "Qualifications section" : null,
      nice_to_have: null,
      benefits: benefits ? "Benefits section" : null,
      application_instructions: null,
      compensation: null,
    },
    summary_for_ui: {
      company_name,
      job_title,
      contact_person: null,
      location,
    },
  };
}

export async function extractJob(url: string): Promise<ExtractedJobData> {
  const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 ResumeBuilderAI Bot' } });
  const html = await res.text();
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes('linkedin.com')) {
    return extractFromLinkedIn(html, url);
  }
  return extractGeneric(html, url);
}



