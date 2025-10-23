/**
 * Extract job description text from a URL
 */
export async function scrapeJobDescription(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Remove script and style tags
    let cleanedText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleanedText = cleanedText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove all HTML tags
    cleanedText = cleanedText.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    cleanedText = cleanedText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean up whitespace
    cleanedText = cleanedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error('Unable to extract meaningful content from URL');
    }

    return cleanedText;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scrape job description: ${error.message}`);
    }
    throw new Error('Failed to scrape job description');
  }
}
