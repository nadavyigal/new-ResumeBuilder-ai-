import { describe, expect, it } from '@jest/globals';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('SEO routing metadata', () => {
  it('returns robots rules with sitemap reference', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    expect(config.sitemap).toBe('https://resumelybuilderai.com/sitemap.xml');
    expect(rules).toHaveLength(1);
    expect(rules[0]?.allow).toBe('/');
    expect(rules[0]?.disallow).toEqual(
      expect.arrayContaining(['/api/', '/dashboard/', '/auth/'])
    );
  });

  it('includes localized core pages and localized blog URLs in sitemap', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://resumelybuilderai.com/');
    expect(urls).toContain('https://resumelybuilderai.com/he/');
    expect(urls).toContain('https://resumelybuilderai.com/pricing');
    expect(urls).toContain('https://resumelybuilderai.com/he/pricing');
    expect(urls).toContain('https://resumelybuilderai.com/blog');
    expect(urls).toContain('https://resumelybuilderai.com/he/blog');
    expect(urls).toContain('https://resumelybuilderai.com/blog/how-to-beat-ats-systems-2025');
    expect(urls).toContain('https://resumelybuilderai.com/he/blog/how-to-beat-ats-systems-2025');
  });
});
