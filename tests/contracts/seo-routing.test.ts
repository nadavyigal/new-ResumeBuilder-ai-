import { describe, expect, it } from '@jest/globals';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('SEO routing metadata', () => {
  it('returns robots rules with sitemap reference', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    expect(config.sitemap).toBe('https://www.resumelybuilderai.com/sitemap.xml');
    expect(rules).toHaveLength(1);
    expect(rules[0]?.allow).toBe('/');
    expect(rules[0]?.disallow).toEqual(
      expect.arrayContaining(['/api/', '/dashboard/', '/auth/'])
    );
  });

  it('includes localized core pages and localized blog URLs in sitemap', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://www.resumelybuilderai.com/');
    expect(urls).toContain('https://www.resumelybuilderai.com/he');
    expect(urls).toContain('https://www.resumelybuilderai.com/pricing');
    expect(urls).toContain('https://www.resumelybuilderai.com/he/pricing');
    expect(urls).toContain('https://www.resumelybuilderai.com/blog');
    expect(urls).toContain('https://www.resumelybuilderai.com/he/blog');
    expect(urls).toContain('https://www.resumelybuilderai.com/blog/resume-tailoring-checklist-2026');
    expect(urls).toContain('https://www.resumelybuilderai.com/he/blog/resume-tailoring-checklist-2026');
    expect(urls).toContain('https://www.resumelybuilderai.com/ats-checker');
    expect(urls).toContain('https://www.resumelybuilderai.com/he/ats-checker');
  });

  it('keeps robots-blocked and redirecting URLs out of the sitemap', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.filter((url) => url.includes('/auth/'))).toEqual([]);
    expect(urls.filter((url) => url.endsWith('/he/'))).toEqual([]);
    expect(urls.every((url) => url.startsWith('https://www.resumelybuilderai.com/'))).toBe(true);
  });
});
