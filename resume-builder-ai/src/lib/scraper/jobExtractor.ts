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

  // Try multiple patterns to extract job title and company
  if (metaTitle) {
    // Pattern 1: "Company hiring Job Title in Location" (LinkedIn pattern)
    const hiringMatch = metaTitle.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
    if (hiringMatch && hiringMatch[1] && hiringMatch[2]) {
      company_name = hiringMatch[1].trim();
      job_title = hiringMatch[2].trim();
    }
    // Pattern 2: "Job Title at Company"
    else if (metaTitle.includes(' at ')) {
      const atSplit = metaTitle.split(/\s+at\s+/i);
      if (atSplit.length === 2) {
        job_title = atSplit[0].trim();
        company_name = atSplit[1].trim();
      }
    }
    // Pattern 3: "Company: Job Title"
    else if (metaTitle.includes(':')) {
      const colonSplit = metaTitle.split(':');
      if (colonSplit.length === 2) {
        company_name = colonSplit[0].trim();
        job_title = colonSplit[1].trim();
      }
    }
    // Pattern 4: "Job Title - Company"
    else if (metaTitle.includes(' - ')) {
      const dashSplit = metaTitle.split(' - ');
      if (dashSplit.length === 2) {
        job_title = dashSplit[0].trim();
        company_name = dashSplit[1].trim();
      }
    }
    // Fallback: use the whole title as job title
    else {
      job_title = metaTitle.trim();
    }
  }

  // Try to extract from JSON-LD structured data
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch && jsonLdMatch[1]) {
    try {
      const jsonData = JSON.parse(jsonLdMatch[1]);
      if (jsonData["@type"] === "JobPosting") {
        job_title = job_title || jsonData.title || null;
        company_name = company_name || jsonData.hiringOrganization?.name || null;
      }
    } catch (e) {
      // JSON parsing failed, continue with other methods
    }
  }

  // Location from meta or inline text
  const location = extractMetaContent(html, "job:location") ||
    sanitizeText((html.match(/"job-location"[^>]*>([\s\S]*?)<\//i)?.[1])) ||
    sanitizeText((html.match(/<li[^>]*class=["'][^"']*?job-criteria__item[^"']*["'][^>]*>[\s\S]*?<span[^>]*>Location<\/[\s\S]*?<span[^>]*>([\s\S]*?)<\//i)?.[1]));

  // Extract the main job description content
  // LinkedIn typically has a show-more-less-html div with the full description
  const showMoreContent = html.match(/<div[^>]*class="[^"]*show-more-less-html[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  let fullDescription = showMoreContent ? showMoreContent[1] : '';

  // If no show-more content, try to get the description div
  if (!fullDescription) {
    const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    fullDescription = descMatch ? descMatch[1] : '';
  }

  // Extract sections from the full description
  // LinkedIn job descriptions often have: "About the job", "Description", "Responsibilities", "Requirements"

  // Try to extract "About the job" or "Description" section
  let about_this_job = metaDesc;

  // Look for Description section first
  const descriptionMatch = fullDescription.match(/Description[\s\S]*?<\/strong>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
                          fullDescription.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

  if (descriptionMatch && !about_this_job) {
    about_this_job = sanitizeText(descriptionMatch[1]);
  }

  // If still no description, try other patterns
  if (!about_this_job || about_this_job.length < 50) {
    const aboutPatterns = [
      /About the job[\s\S]*?<\/strong>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
      /About this job[\s\S]*?<\/strong>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
      /<h2[^>]*>About this job[^<]*<\/h2>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i,
    ];

    for (const pattern of aboutPatterns) {
      const match = fullDescription.match(pattern) || html.match(pattern);
      if (match && match[1]) {
        const text = sanitizeText(match[1]);
        if (text && text.length > 50) {
          about_this_job = text;
          break;
        }
      }
    }
  }

  // Extract Responsibilities
  let responsibilities: string[] | null = null;
  const respMatch = fullDescription.match(/Responsibilities[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (respMatch) {
    responsibilities = [...respMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(m => sanitizeText(m[1]))
      .filter(Boolean) as string[];
  }

  // Fallback: look for responsibility-related headings
  if (!responsibilities || responsibilities.length === 0) {
    responsibilities = extractListAfterHeading(fullDescription || html, /<strong[^>]*>(What you['']ll do|Responsibilities|Your responsibilities|Key responsibilities)<\/strong>/i) ||
                      extractListAfterHeading(fullDescription || html, /<h2[^>]*>(What you['']ll do|Responsibilities)<\/h2>/i);
  }

  // Extract Requirements
  let requirements: string[] | null = null;
  const reqMatch = fullDescription.match(/Requirements[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (reqMatch) {
    requirements = [...reqMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(m => sanitizeText(m[1]))
      .filter(Boolean) as string[];
  }

  // Fallback: look for requirement-related headings
  if (!requirements || requirements.length === 0) {
    requirements = extractListAfterHeading(fullDescription || html, /<strong[^>]*>(Requirements|What we need|What you need|You have|Must have)<\/strong>/i) ||
                  extractListAfterHeading(fullDescription || html, /<h2[^>]*>(Requirements|Skills|You have)<\/h2>/i);
  }

  // Extract Qualifications (separate from requirements)
  const qualifications = extractListAfterHeading(fullDescription || html, /<strong[^>]*>(Qualifications|What you bring|Basic Qualifications|Your qualifications)<\/strong>/i) ||
                        extractListAfterHeading(fullDescription || html, /<h2[^>]*>(Qualifications|What you bring|Basic Qualifications)<\/h2>/i);
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
  // Handle LinkedIn URLs with currentJobId parameter
  let finalUrl = url;
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname.toLowerCase();

  if (host.includes('linkedin.com')) {
    const currentJobId = parsedUrl.searchParams.get('currentJobId');
    if (currentJobId) {
      // Convert collection URL to direct job URL
      finalUrl = `https://www.linkedin.com/jobs/view/${currentJobId}`;
      console.log(`Converted LinkedIn URL to direct job URL: ${finalUrl}`);
    }
  }

  const res = await fetch(finalUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch job posting: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  if (host.includes('linkedin.com')) {
    return extractFromLinkedIn(html, finalUrl);
  }
  return extractGeneric(html, finalUrl);
}









