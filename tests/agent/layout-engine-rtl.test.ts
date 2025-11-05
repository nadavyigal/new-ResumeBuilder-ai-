import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { LayoutEngine } from '@/lib/agent/tools/layout-engine';

const resume = {
  summary: 'מנהל מוצר עם ניסיון בתהליכים גלובליים.',
  contact: { name: 'Dana', email: 'dana@example.com', phone: '', location: '' },
  skills: { technical: ['ניהול'], soft: ['הובלה'] },
  experience: [],
  education: [],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
  language: { lang: 'he', rtl: true, confidence: 0.9 },
};

describe('LayoutEngine RTL rendering', () => {
  const previous = process.env.BENCH_SKIP_PDF;

  beforeAll(() => {
    process.env.BENCH_SKIP_PDF = '1';
  });

  afterAll(() => {
    process.env.BENCH_SKIP_PDF = previous;
  });

  it('injects RTL attributes into preview HTML', async () => {
    const result = await LayoutEngine.render(resume as any, { layout: 'ats-safe', direction: 'rtl' });
    expect(result.html).toContain('dir="rtl"');
    expect(result.html).toContain('lang="he"');
  });
});

