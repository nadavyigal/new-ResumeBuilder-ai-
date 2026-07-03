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

describe('optimization review section selection provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installReviewMocks();
  });

  it('keeps the review route consumers inside SectionSelectionProvider', () => {
    const pagePath = path.join(
      process.cwd(),
      'src/app/[locale]/dashboard/optimizations/[id]/page.tsx'
    );
    const source = fs.readFileSync(pagePath, 'utf8');

    const providerStart = source.indexOf('<SectionSelectionProvider>');
    const providerEnd = source.lastIndexOf('</SectionSelectionProvider>');
    const designRenderer = source.indexOf('<DesignRenderer');
    const chatSidebar = source.indexOf('<ChatSidebar');

    expect(providerStart).toBeGreaterThan(-1);
    expect(providerEnd).toBeGreaterThan(providerStart);
    expect(designRenderer).toBeGreaterThan(providerStart);
    expect(designRenderer).toBeLessThan(providerEnd);
    expect(chatSidebar).toBeGreaterThan(providerStart);
    expect(chatSidebar).toBeLessThan(providerEnd);
  });

  it('renders the real review consumers with the provider and fails without it', () => {
    const { SectionSelectionProvider } = require('@/hooks/useSectionSelection');
    const { DesignRenderer } = require('@/components/design/DesignRenderer');
    const { ChatSidebar } = require('@/components/chat/ChatSidebar');

    const consumers = (
      <>
        <DesignRenderer resumeData={reviewResumeFixture} />
        <ChatSidebar optimizationId="review-1" />
      </>
    );

    expect(() => renderToString(consumers)).toThrow(
      'useSectionSelection must be used within SectionSelectionProvider'
    );

    const html = renderToString(
      <SectionSelectionProvider>{consumers}</SectionSelectionProvider>
    );

    expect(html).toContain('dashboard.design.loadingTemplate');
    expect(html).toContain('dashboard.chat.header.title');
  });
});
