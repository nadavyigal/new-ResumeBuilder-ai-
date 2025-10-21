/**
 * Extract job description text from a URL with intelligent content filtering
 * Focuses on extracting only relevant job posting content, filtering out navigation, ads, etc.
 */
export async function scrapeJobDescription(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Try to extract main content using common job posting selectors
    const extractedContent = extractJobContent(html);

    if (!extractedContent || extractedContent.length < 50) {
      throw new Error('Unable to extract meaningful job description from URL');
    }

    return extractedContent;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scrape job description: ${error.message}`);
    }
    throw new Error('Failed to scrape job description');
  }
}

/**
 * Intelligently extract job description content from HTML
 * Uses selectors for common job boards and heuristics for generic sites
 */
function extractJobContent(html: string): string {
  // Remove script, style, and navigation tags
  let cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  // Try to find main content area using common patterns
  const contentPatterns = [
    // LinkedIn - specific patterns for "About this job" section
    /<div[^>]*class="[^"]*show-more-less-html[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*show-more-less-html[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // LinkedIn general
    /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // Indeed
    /<div[^>]*id="jobDescriptionText"[^>]*>([\s\S]*?)<\/div>/i,
    // Generic job description container
    /<div[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*jobdescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    // Article or main content
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    // Role/position specific
    /<div[^>]*class="[^"]*role[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*position[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = cleanedHtml.match(pattern);
    if (match && match[1]) {
      cleanedHtml = match[1];
      break;
    }
  }

  // Remove remaining HTML tags
  let text = cleanedHtml.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

  // Clean up whitespace while preserving structure
  text = text
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  // Filter out common noise patterns
  const noisePatterns = [
    /Sign in/gi,
    /Log in/gi,
    /Create account/gi,
    /Apply now/gi,
    /Save job/gi,
    /Share/gi,
    /Cookie policy/gi,
    /Privacy policy/gi,
    /Terms of service/gi,
    /© \d{4}/g,
    /All rights reserved/gi,
  ];

  for (const pattern of noisePatterns) {
    text = text.replace(pattern, '');
  }

  // Final cleanup
  text = text
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return text;
}
