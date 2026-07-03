import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

function translated(namespace?: string) {
  const t = ((key: string) => (namespace ? `${namespace}.${key}` : key)) as any;
  t.rich = (key: string) => (namespace ? `${namespace}.${key}` : key);
  return t;
}

function installReviewMocks() {
  jest.doMock('next-intl', () => ({
    __esModule: true,
    useTranslations: (namespace?: string) => translated(namespace),
  }));
}

const reviewResumeFixture = {
  summary: 'Builds reliable iOS apps and product systems for fast-moving teams.',
  contact: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+1 555 123 4567',
    location: 'London',
    linkedin: 'linkedin.com/in/ada',
  },
  skills: {
    technical: ['Swift', 'React', 'TypeScript'],
    soft: ['Product judgment'],
  },
  experience: [
    {
      title: 'Senior iOS Engineer',
      company: 'Analytical Engines',
      location: 'London',
      startDate: '2021',
      endDate: 'Present',
      achievements: ['Shipped resilient review flows used by thousands of job seekers.'],
    },
  ],
  education: [
    {
      degree: 'BSc Computer Science',
      institution: 'University of London',
      location: 'London',
      graduationDate: '2018',
    },
  ],
  certifications: [],
  projects: [],
  matchScore: 82,
  keyImprovements: ['Tighter role framing', 'Clearer measurable outcomes'],
  missingKeywords: [],
};

const OPTIMIZATION_REVIEWS_PAGE = path.join(
  process.cwd(),
  'src/app/[locale]/dashboard/optimization-reviews/[id]/page.tsx'
);

describe('optimization-reviews route section selection provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installReviewMocks();
  });

  it('keeps DesignRenderer inside SectionSelectionProvider on the live optimization-reviews route', () => {
    const source = fs.readFileSync(OPTIMIZATION_REVIEWS_PAGE, 'utf8');

    expect(source).toContain("from \"@/hooks/useSectionSelection\"");

    const providerStart = source.indexOf('<SectionSelectionProvider>');
    const providerEnd = source.lastIndexOf('</SectionSelectionProvider>');
    const designRenderer = source.indexOf('<DesignRenderer');

    expect(providerStart).toBeGreaterThan(-1);
    expect(providerEnd).toBeGreaterThan(providerStart);
    expect(designRenderer).toBeGreaterThan(providerStart);
    expect(designRenderer).toBeLessThan(providerEnd);
  });

  it('does not treat the decoy optimizations route as the live review entrypoint', () => {
    const optimizationsPage = path.join(
      process.cwd(),
      'src/app/[locale]/dashboard/optimizations/[id]/page.tsx'
    );
    const resumeUploadPage = path.join(
      process.cwd(),
      'src/app/[locale]/dashboard/resume/page.tsx'
    );

    const resumeSource = fs.readFileSync(resumeUploadPage, 'utf8');
    const optimizationsSource = fs.readFileSync(optimizationsPage, 'utf8');

    expect(resumeSource).toContain('ROUTES.optimizationReviews');
    expect(optimizationsSource).toContain('<SectionSelectionProvider>');
    expect(optimizationsSource).not.toContain('optimization-reviews');
  });

  it('renders the optimization-reviews preview consumer with the provider and fails without it', () => {
    const { SectionSelectionProvider } = require('@/hooks/useSectionSelection');
    const { DesignRenderer } = require('@/components/design/DesignRenderer');

    const preview = <DesignRenderer resumeData={reviewResumeFixture} refreshKey={2} />;

    expect(() => renderToString(preview)).toThrow(
      'useSectionSelection must be used within SectionSelectionProvider'
    );

    const html = renderToString(
      <SectionSelectionProvider>{preview}</SectionSelectionProvider>
    );

    expect(html).toContain('dashboard.design.loadingTemplate');
  });
});
