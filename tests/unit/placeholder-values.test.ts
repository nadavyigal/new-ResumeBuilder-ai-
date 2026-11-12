/**
 * The optimizer model fills fields it cannot find with "Not specified", "N/A"
 * or "Not provided", and those strings were saved and printed in exported
 * resumes. A tester's PDF showed "Not specified" in the header, beside every
 * company (role location) and beside her university (graduation date).
 * Production, 2026-11-12: 4 of 59 optimizations in 60 days carried one, at
 * experience[].location, education[].graduationDate/location/institution,
 * experience[].startDate/endDate and contact.phone/location.
 *
 * These tests pin the deterministic scrub. No OpenAI, no network.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { isPlaceholderValue, stripPlaceholderValues } from '@/lib/resume/placeholder-values';
import { normalizeOptimizedResume } from '@/lib/resume/canonicalize';
import { createOptimizationReviewRun } from '@/lib/optimization-review/service';
import type { OptimizedResume } from '@/lib/ai-optimizer';

jest.mock('@/lib/posthog-server', () => ({ captureServerEvent: jest.fn(async () => undefined) }));
// The score preview is not under test; a failed score makes it null by design.
jest.mock('@/lib/ats/integration', () => ({
  scoreOptimization: jest.fn(async () => {
    throw new Error('not scored in this test');
  }),
}));

describe('isPlaceholderValue', () => {
  it.each([
    'Not specified',
    'not specified',
    'NOT SPECIFIED.',
    ' N/A ',
    'n/a',
    'Not provided',
    'Not available',
    'Unspecified',
    'Unknown',
    'Location not specified',
    'Dates not provided',
    'לא צוין',
    'לא צויין',
    'לא ידוע',
  ])('treats %p as a placeholder', (value) => {
    expect(isPlaceholderValue(value)).toBe(true);
  });

  it.each([
    'Tel Aviv, Israel',
    'Kaltura',
    'Ben Gurion University',
    '2019',
    'Present',
    'NA', // a region code, kept on purpose
    'N.A.', // same region code with dots
    'Remote',
    'Specified the data model for billing',
    'Unknown Worlds Entertainment',
    '',
  ])('keeps real value %p', (value) => {
    expect(isPlaceholderValue(value)).toBe(false);
  });

  it('ignores non-strings', () => {
    expect(isPlaceholderValue(42)).toBe(false);
    expect(isPlaceholderValue(null)).toBe(false);
    expect(isPlaceholderValue(undefined)).toBe(false);
  });
});

describe('stripPlaceholderValues', () => {
  const liveShape = {
    summary: 'Product analyst with 6 years in SaaS.',
    contact: {
      name: 'Dana Levi',
      email: 'dana@example.com',
      phone: 'N/A',
      location: 'Not specified',
      linkedin: 'Not provided',
    },
    skills: { technical: ['SQL', 'N/A', 'Python'], soft: ['Not specified'] },
    experience: [
      {
        title: 'Data Analyst',
        company: 'Kaltura',
        location: 'Not specified',
        startDate: 'N/A',
        endDate: 'Present',
        achievements: ['Cut report time by 40%', 'Not specified'],
        responsibilities: [],
      },
    ],
    education: [
      {
        degree: 'B.Sc. Information Systems',
        institution: 'Ben Gurion University',
        location: 'Not provided',
        graduationDate: 'Not specified',
      },
    ],
    certifications: ['Unknown'],
    projects: [],
    matchScore: 72,
    keyImprovements: [],
    missingKeywords: [],
  };

  it('clears every placeholder seen in production and keeps real values', () => {
    const out = stripPlaceholderValues(liveShape);

    expect(out.contact).toEqual({
      name: 'Dana Levi',
      email: 'dana@example.com',
      phone: '',
      location: '',
      linkedin: '',
    });
    expect(out.experience[0]).toMatchObject({
      company: 'Kaltura',
      location: '',
      startDate: '',
      endDate: 'Present',
      achievements: ['Cut report time by 40%'],
    });
    expect(out.education[0]).toMatchObject({
      institution: 'Ben Gurion University',
      location: '',
      graduationDate: '',
    });
    expect(out.skills).toEqual({ technical: ['SQL', 'Python'], soft: [] });
    expect(out.certifications).toEqual([]);
    expect(out.matchScore).toBe(72);
    expect(out.summary).toBe(liveShape.summary);
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(liveShape);
    stripPlaceholderValues(liveShape);
    expect(JSON.stringify(liveShape)).toBe(before);
  });

  it('leaves no placeholder anywhere in the serialized result', () => {
    const serialized = JSON.stringify(stripPlaceholderValues(liveShape));
    expect(serialized).not.toMatch(/not specified|not provided|"n\/a"|"unknown"/i);
  });
});

describe('normalizeOptimizedResume with placeholders', () => {
  it('falls back to the original value when the optimizer wrote a placeholder', () => {
    const original = normalizeOptimizedResume({
      contact: { name: 'Dana Levi', email: 'dana@example.com', phone: '+972-50-000-0000', location: 'Haifa' },
    });
    const optimized = normalizeOptimizedResume(
      { contact: { name: 'Dana Levi', email: 'dana@example.com', phone: 'N/A', location: 'Not specified' } },
      original
    );

    expect(optimized.contact.phone).toBe('+972-50-000-0000');
    expect(optimized.contact.location).toBe('Haifa');
  });

  it('stores an empty string, never the placeholder, in role and education fields', () => {
    const out = normalizeOptimizedResume({
      experience: [
        { title: 'Analyst', company: 'Kaltura', location: 'Not specified', startDate: 'N/A', endDate: '2024', achievements: ['Built dashboards', 'N/A'] },
      ],
      education: [
        { degree: 'B.Sc.', institution: 'Ben Gurion University', location: 'Not provided', graduationDate: 'Not specified' },
      ],
      skills: { technical: ['SQL', 'Not specified'], soft: [] },
    });

    expect(out.experience[0]).toMatchObject({ location: '', startDate: '', achievements: ['Built dashboards'] });
    expect(out.education[0]).toMatchObject({ location: '', graduationDate: '' });
    expect(out.skills.technical).toEqual(['SQL']);
  });
});

describe('isPlaceholderValue documented tradeoff', () => {
  it('clears a field whose whole value is "Unknown"', () => {
    expect(stripPlaceholderValues({ contact: { location: 'Unknown' } })).toEqual({ contact: { location: '' } });
  });
});

// The main production path: /api/optimize and /api/upload-resume hand the
// pipeline's resume to createOptimizationReviewRun, which saves it. This pins
// that what is saved has no stand-ins, whatever the pipeline returned.
describe('createOptimizationReviewRun saves no placeholders', () => {
  const original = normalizeOptimizedResume({
    summary: 'Data analyst.',
    contact: { name: 'Dana Levi', email: 'dana@example.test', phone: '+972-50-000-0000', location: 'Haifa' },
    experience: [{ title: 'Data Analyst', company: 'Kaltura', location: '', startDate: '2021', endDate: 'Present', achievements: ['Built dashboards'] }],
    education: [{ degree: 'B.Sc. Information Systems', institution: 'Ben Gurion University', location: '', graduationDate: '' }],
  });

  // Shape of the pipeline output for a resume whose contact line and logos were images.
  const pipelineOutput = {
    summary: 'Data analyst with SaaS reporting experience.',
    contact: { name: 'Dana Levi', email: 'dana@example.test', phone: 'N/A', location: 'Not specified' },
    skills: { technical: ['SQL', 'Not specified'], soft: [] },
    experience: [
      { title: 'Data Analyst', company: 'Kaltura', location: 'Not specified', startDate: '2021', endDate: 'Present', achievements: ['Built SQL dashboards for sales', 'N/A'] },
    ],
    education: [
      { degree: 'B.Sc. Information Systems', institution: 'Ben Gurion University', location: 'Not provided', graduationDate: 'Not specified' },
    ],
    certifications: [],
    projects: [],
    matchScore: 72,
    keyImprovements: [],
    missingKeywords: [],
  } as unknown as OptimizedResume;

  function fakeSupabase(saved: Record<string, unknown>[]) {
    return {
      from(table: string) {
        if (table === 'resumes') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { canonical_data: original }, error: null }) }) }),
          };
        }
        return {
          insert(row: Record<string, unknown>) {
            saved.push(row);
            return {
              select: () => ({
                maybeSingle: async () => ({
                  data: { id: 'review-1', status: 'pending', created_at: '2026-11-12T00:00:00Z', ...row },
                  error: null,
                }),
              }),
            };
          },
        };
      },
    };
  }

  it('saves the original phone and location and empty role/education fields', async () => {
    const saved: Record<string, unknown>[] = [];
    await createOptimizationReviewRun({
      supabase: fakeSupabase(saved) as never,
      userId: 'user-1',
      resumeId: 'resume-1',
      jobDescriptionId: 'jd-1',
      resumeRawText: 'Dana Levi\nData Analyst, Kaltura',
      jobDescriptionText: 'Data analyst, SQL',
      jobTitle: 'Data Analyst',
      jobExtractedJson: null,
      optimizedResume: pipelineOutput,
      heldPhrases: [],
    } as never);

    expect(saved).toHaveLength(1);
    const persisted = saved[0].optimized_resume_json as OptimizedResume;
    expect(JSON.stringify(persisted)).not.toMatch(/not specified|not provided|"n\/a"/i);
    expect(persisted.contact.phone).toBe('+972-50-000-0000');
    expect(persisted.contact.location).toBe('Haifa');
    expect(persisted.experience[0].location).toBe('');
    expect(persisted.experience[0].achievements).toEqual(['Built SQL dashboards for sales']);
    expect(persisted.education[0].graduationDate).toBe('');
    expect(persisted.skills.technical).toEqual(['SQL']);
  });
});
