/** @jest-environment node */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

const mockAuthGetUser = jest.fn();
const mockRender = jest.fn();
const mockATSScore = jest.fn();
const mockHistorySave = jest.fn();
const mockVersioningCommit = jest.fn();
const mockDetectLanguage = jest.fn();
const mockExtractResumeText = jest.fn();
const mockCookies = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  __esModule: true,
  createRouteHandlerClient: () => Promise.resolve({ auth: { getUser: mockAuthGetUser } }),
}));

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

jest.mock('@/lib/agent/tools/layout-engine', () => ({
  LayoutEngine: {
    render: (...args: any[]) => mockRender(...args),
  },
}));

jest.mock('@/lib/agent/tools/ats', () => ({
  ATS: {
    score: (...args: any[]) => mockATSScore(...args),
  },
}));

jest.mock('@/lib/agent/tools/history-store', () => ({
  HistoryStore: {
    save: (...args: any[]) => mockHistorySave(...args),
  },
}));

jest.mock('@/lib/agent/tools/versioning', () => ({
  Versioning: {
    commit: (...args: any[]) => mockVersioningCommit(...args),
  },
}));

jest.mock('@/lib/agent/utils/language', () => ({
  detectLanguage: (...args: any[]) => mockDetectLanguage(...args),
  RTL_LANGUAGE_CODES: new Set(['ar', 'he', 'fa', 'ur']),
}));

jest.mock('@/lib/ats', () => ({
  extractResumeText: (...args: any[]) => mockExtractResumeText(...args),
}));

type PostHandler = typeof import('@/app/api/agent/apply/route')['POST'];
let postHandler: PostHandler;

const baseResume = {
  summary: 'Experienced engineer',
  contact: { name: 'Taylor Dev', email: 'taylor@example.com', phone: '555-0000', location: 'Remote' },
  skills: { technical: ['TypeScript'], soft: ['Leadership'] },
  experience: [],
  education: [],
};

function createRequest(body: Record<string, any>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

beforeAll(async () => {
  ({ POST: postHandler } = await import('@/app/api/agent/apply/route'));
});

beforeEach(() => {
  jest.clearAllMocks();

  mockCookies.mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
  });
  mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

  mockRender.mockResolvedValue({ html: '<html></html>', preview_pdf_path: 'artifacts/new-preview.pdf' });
  mockATSScore.mockResolvedValue({ score: 88, missing_keywords: ['GraphQL'], recommendations: ['Add GraphQL'], languages: {} });
  mockHistorySave.mockResolvedValue({ id: 'history-123' });
  mockVersioningCommit.mockResolvedValue({ resume_version_id: 'version-1', created_at: '2024-01-01T00:00:00Z' });
  mockDetectLanguage.mockResolvedValue({ lang: 'en', confidence: 0.9, rtl: false, source: 'heuristic' });
  mockExtractResumeText.mockReturnValue('Sample resume text');
});

describe('POST /api/agent/apply - contract', () => {
  it('applies proposed change batch and returns updated resume JSON', async () => {
    const payload = {
      resume_json: baseResume,
      proposed_changes: [
        {
          id: 'change-1',
          summary: 'Update summary',
          scope: 'paragraph',
          category: 'content',
          confidence: 'high',
          before: 'Experienced engineer',
          after: 'Updated engineering summary',
          metadata: { pointer: '/summary' },
        },
      ],
      baseline_scores: { ats: 72 },
    };

    const res = await postHandler(createRequest(payload));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.resume_json.summary).toBe('Updated engineering summary');
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockATSScore).toHaveBeenCalledWith({ resume_json: expect.any(Object), job_text: undefined });
  });

  it('regenerates preview with normalized RTL-aware theme', async () => {
    mockDetectLanguage.mockResolvedValueOnce({ lang: 'ar', confidence: 0.96, rtl: true, source: 'heuristic' });
    mockRender.mockResolvedValueOnce({ html: '<html dir="rtl"></html>', preview_pdf_path: 'artifacts/rtl.pdf' });

    const payload = {
      resume_json: { ...baseResume, summary: 'مرحبا بالعالم' },
      proposed_changes: [
        {
          id: 'change-rtl',
          summary: 'RTL summary update',
          scope: 'paragraph',
          category: 'content',
          confidence: 'medium',
          before: 'مرحبا بالعالم',
          after: 'مرحبا بكم',
          metadata: { pointer: '/summary' },
        },
      ],
    };

    const res = await postHandler(createRequest(payload));
    const data = await res.json();

    expect(data.preview_url).toBe('artifacts/rtl.pdf');
    const [, themeArg] = mockRender.mock.calls[0];
    expect(themeArg.direction).toBe('rtl');
    expect(data.language.rtl).toBe(true);
  });

  it('computes ATS delta from provided baseline score', async () => {
    mockATSScore.mockResolvedValueOnce({ score: 90, missing_keywords: [], recommendations: [], languages: {} });

    const payload = {
      resume_json: baseResume,
      proposed_changes: [
        {
          id: 'change-ats',
          summary: 'Boost ATS',
          scope: 'paragraph',
          category: 'content',
          confidence: 'medium',
          before: 'Experienced engineer',
          after: 'Experienced engineer with React and GraphQL expertise',
          metadata: { pointer: '/summary' },
        },
      ],
      baseline_scores: { ats: 60 },
    };

    const res = await postHandler(createRequest(payload));
    const data = await res.json();

    expect(data.after_scores.ats.score).toBe(90);
    expect(data.after_scores.ats.before).toBe(60);
    expect(data.after_scores.ats.delta).toBe(30);
  });

  it('logs history entry with proposed changes included', async () => {
    const payload = {
      resume_json: baseResume,
      proposed_changes: [
        {
          id: 'change-history',
          summary: 'Record history',
          scope: 'paragraph',
          category: 'content',
          confidence: 'low',
          before: 'Experienced engineer',
          after: 'Experienced engineer and mentor',
          metadata: { pointer: '/summary' },
        },
      ],
    };

    const res = await postHandler(createRequest(payload));
    const data = await res.json();

    expect(data.history_entry_id).toBe('history-123');
    expect(mockHistorySave).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-123',
      resume_version_id: 'version-1',
      proposed_changes: payload.proposed_changes,
    }));
    expect(mockVersioningCommit).toHaveBeenCalledWith('user-123', expect.any(Object));
  });
});
