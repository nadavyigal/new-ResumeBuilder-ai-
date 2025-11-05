/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

interface SetupOptions {
  enabled?: boolean;
  shadow?: boolean;
  languageMock?: any;
  atsReportMock?: any;
  jobText?: string;
}

const defaultSubscores = {
  keyword_exact: 40,
  keyword_phrase: 30,
  semantic_relevance: 50,
  title_alignment: 35,
  metrics_presence: 25,
  section_completeness: 45,
  format_parseability: 40,
  recency_fit: 30,
};

const defaultAtsReport = {
  score: 48,
  missing_keywords: ['TypeScript', 'Leadership'],
  recommendations: ['Add TypeScript to recent achievements', 'Highlight leadership impact'],
  languages: {
    en: {
      score: 42,
      rtl: false,
      subscores: defaultSubscores,
      missing_keywords: ['TypeScript'],
      gaps: ['TypeScript'],
    },
  },
};

async function setupRoute(options: SetupOptions = {}) {
  jest.resetModules();
  jest.clearAllMocks();

  process.env.AGENT_SDK_ENABLED = options.enabled === false ? 'false' : 'true';
  process.env.AGENT_SDK_SHADOW = options.shadow ? 'true' : 'false';

  const createRouteHandlerClient = jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) },
    from: jest.fn().mockReturnValue({ insert: jest.fn().mockResolvedValue({}) }),
  });

  const runtimeRun = jest.fn().mockResolvedValue({
    intent: 'rewrite',
    actions: [],
    diffs: [],
    artifacts: {},
    ats_report: { score: 30, missing_keywords: [], recommendations: [], languages: {} },
  });

  const optimizeResume = jest.fn().mockResolvedValue('legacy-optimized');

  const atsScore = jest.fn().mockResolvedValue(options.atsReportMock ?? defaultAtsReport);

  const detectLanguage = jest.fn().mockResolvedValue(
    options.languageMock ?? { lang: 'es', confidence: 0.92, rtl: false, source: 'model' as const }
  );

  const getJob = jest.fn().mockResolvedValue({
    text: options.jobText ?? 'Mock job description focused on TypeScript leadership',
    title: 'Senior Engineer',
    company: 'Mock Co',
    url: 'https://example.com/job',
  });

  const log = jest.fn();

  jest.doMock('@/lib/supabase-server', () => ({ createRouteHandlerClient }));
  jest.doMock('@/lib/agent', () => ({
    AgentRuntime: jest.fn().mockImplementation(() => ({ run: runtimeRun })),
  }));
  jest.doMock('@/lib/agent/utils/logger', () => ({ log }));
  jest.doMock('@/lib/ai-optimizer', () => ({ optimizeResume }));
  jest.doMock('@/lib/agent/tools/ats', () => ({ ATS: { score: atsScore } }));
  jest.doMock('@/lib/agent/tools/job-link-scraper', () => ({ JobLinkScraper: { getJob } }));
  jest.doMock('@/lib/agent/utils/language', () => ({ detectLanguage }));

  const module = await import('@/app/api/agent/run/route');

  return {
    POST: module.POST,
    mocks: { createRouteHandlerClient, runtimeRun, optimizeResume, atsScore, detectLanguage, getJob, log },
  };
}

function createRequest(body: any) {
  return { json: jest.fn().mockResolvedValue(body) } as any;
}

describe('POST /api/agent/run route contract', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns enriched agent payload with coaching when enabled', async () => {
    const { POST, mocks } = await setupRoute({ enabled: true, shadow: false });

    const requestBody = {
      command: 'optimizar resumen y habilidades',
      resume_json: {
        summary: 'Ingeniero de software con experiencia en TypeScript.',
        contact: { name: 'Alex', email: 'alex@example.com', phone: '', location: '' },
        skills: { technical: ['JavaScript'], soft: [] },
        experience: [],
        education: [],
      },
      job_url: 'https://example.com/job',
    } as any;

    const response = await POST(createRequest(requestBody) as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getJob).toHaveBeenCalledWith('https://example.com/job');
    expect(mocks.atsScore).toHaveBeenCalled();
    expect(payload.language.lang).toBe('es');
    expect(payload.coaching.language.lang).toBe('es');
    expect(Array.isArray(payload.coaching.proposed_changes)).toBe(true);
    expect(payload.coaching.proposed_changes.length).toBeGreaterThanOrEqual(4);
    expect(payload.coaching.proposed_changes.length).toBeLessThanOrEqual(6);
    expect(payload.proposed_changes).toEqual(payload.coaching.proposed_changes);
    for (const change of payload.coaching.proposed_changes) {
      expect(change.metadata).toBeDefined();
      expect(change.metadata.risk).toBeDefined();
      expect(change.metadata.ats_delta).toBeDefined();
      expect(typeof change.metadata.ats_delta.estimated).toBe('number');
    }
  });

  it('returns 501 when agent SDK is disabled and shadow mode off', async () => {
    const { POST } = await setupRoute({ enabled: false, shadow: false });
    const response = await POST(createRequest({}) as any);
    const payload = await response.json();

    expect(response.status).toBe(501);
    expect(payload.error).toMatch(/disabled/i);
  });

  it('returns legacy payload with coaching in shadow mode', async () => {
    const { POST, mocks } = await setupRoute({ enabled: false, shadow: true });

    const requestBody = {
      command: 'mejorar resumen',
      resume_json: {
        summary: 'Profesional con experiencia en liderazgo.',
        contact: { name: 'Alex', email: 'alex@example.com', phone: '', location: '' },
        skills: { technical: ['Leadership'], soft: [] },
        experience: [],
        education: [],
      },
      job_description: 'Se busca liderazgo en proyectos TypeScript.',
    } as any;

    const response = await POST(createRequest(requestBody) as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.shadow).toBe(true);
    expect(payload.legacy).toBe('legacy-optimized');
    expect(payload.coaching).toBeDefined();
    expect(payload.language.lang).toBe('es');
    expect(mocks.optimizeResume).toHaveBeenCalled();
    expect(mocks.runtimeRun).toHaveBeenCalled();
  });
});
