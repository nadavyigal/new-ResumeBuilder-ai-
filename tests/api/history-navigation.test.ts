import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import type * as HistoryStoreModule from '@/lib/agent/tools/history-store';
import type * as UndoModule from '@/app/api/history/undo/route';
import type * as RedoModule from '@/app/api/history/redo/route';

type ResumeVersionFixture = {
  user_id: string;
  resume_json: any;
  created_at: string;
};

const resumeVersions = new Map<string, ResumeVersionFixture>();
const mockAuthGetUser = jest.fn();
let historyIdCounter = 0;

const createRouteHandlerClientMock = jest.fn(async () => ({
  auth: {
    getUser: mockAuthGetUser,
  },
  from: (table: string) => {
    if (table === 'resume_versions') {
      const filters: Record<string, string> = {};
      const query: any = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return query;
        },
        maybeSingle: async () => {
          const id = filters.id;
          const userId = filters.user_id;
          const record = id ? resumeVersions.get(id) : undefined;
          if (!id || !userId || !record || record.user_id !== userId) {
            return { data: null, error: null };
          }
          return {
            data: { id, user_id: userId, resume_json: record.resume_json, created_at: record.created_at },
            error: null,
          };
        },
      };
      return query;
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  },
}));

const createServiceRoleClientMock = jest.fn(() => ({
  from: (table: string) => {
    if (table === 'history') {
      return {
        insert: () => ({
          select: () => ({
            maybeSingle: async () => ({
              data: {
                id: `history-${++historyIdCounter}`,
                created_at: `2024-01-0${historyIdCounter}T00:00:00Z`,
              },
              error: null,
            }),
          }),
        }),
      };
    }
    return {
      insert: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: {
              id: `generic-${Date.now()}`,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    };
  },
}));

jest.mock('@/lib/supabase-server', () => ({
  __esModule: true,
  createRouteHandlerClient: createRouteHandlerClientMock,
  createServiceRoleClient: createServiceRoleClientMock,
  createServerClient: createRouteHandlerClientMock,
}));

const userId = 'user-1';

function addVersion(versionId: string, summary: string, language: any) {
  resumeVersions.set(versionId, {
    user_id: userId,
    resume_json: {
      summary,
      language,
      sections: [],
    },
    created_at: '2024-01-01T00:00:00Z',
  });
}

describe('History navigation API routes', () => {
  let HistoryStore: HistoryStoreModule.HistoryStore;
  let undoHandler: UndoModule.POST;
  let redoHandler: RedoModule.POST;

  beforeAll(async () => {
    ({ HistoryStore } = await import('@/lib/agent/tools/history-store'));
    ({ POST: undoHandler } = await import('@/app/api/history/undo/route'));
    ({ POST: redoHandler } = await import('@/app/api/history/redo/route'));
  });

  beforeEach(() => {
    resumeVersions.clear();
    historyIdCounter = 0;
    createRouteHandlerClientMock.mockClear();
    createServiceRoleClientMock.mockClear();
    mockAuthGetUser.mockReset();
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: userId } } });
    HistoryStore.clearTimeline(userId);
  });

  async function recordHistoryEntry(params: {
    versionId: string;
    summary: string;
    language: any;
    score: number;
    previewPath: string;
  }) {
    addVersion(params.versionId, params.summary, params.language);
    await HistoryStore.save({
      user_id: userId,
      resume_version_id: params.versionId,
      ats_score: params.score,
      artifacts: [{ type: 'pdf', path: params.previewPath }],
    });
  }

  it('restores history correctly after multiple apply cycles', async () => {
    await recordHistoryEntry({
      versionId: 'version-1',
      summary: 'Initial resume summary',
      language: { lang: 'en', confidence: 0.9, rtl: false, source: 'heuristic' as const },
      score: 62,
      previewPath: '/initial.pdf',
    });
    await recordHistoryEntry({
      versionId: 'version-2',
      summary: 'Second iteration summary',
      language: { lang: 'fr', confidence: 0.85, rtl: false, source: 'model' as const },
      score: 78,
      previewPath: '/second.pdf',
    });
    await recordHistoryEntry({
      versionId: 'version-3',
      summary: 'Third iteration summary',
      language: { lang: 'es', confidence: 0.88, rtl: false, source: 'model' as const },
      score: 95,
      previewPath: '/third.pdf',
    });

    const firstUndo = await undoHandler();
    expect(firstUndo.status).toBe(200);
    const firstPayload = await firstUndo.json();
    expect(firstPayload.resume_json.summary).toBe('Second iteration summary');
    expect(firstPayload.preview_url).toBe('/second.pdf');
    expect(firstPayload.after_scores.ats.score).toBe(78);
    expect(firstPayload.language.lang).toBe('fr');

    const secondUndo = await undoHandler();
    expect(secondUndo.status).toBe(200);
    const secondPayload = await secondUndo.json();
    expect(secondPayload.resume_json.summary).toBe('Initial resume summary');
    expect(secondPayload.after_scores.ats.score).toBe(62);
    expect(secondPayload.preview_url).toBe('/initial.pdf');

    const firstRedo = await redoHandler();
    expect(firstRedo.status).toBe(200);
    const redoPayload = await firstRedo.json();
    expect(redoPayload.resume_json.summary).toBe('Second iteration summary');
    expect(redoPayload.after_scores.ats.score).toBe(78);
    expect(redoPayload.preview_url).toBe('/second.pdf');

    const secondRedo = await redoHandler();
    expect(secondRedo.status).toBe(200);
    const finalPayload = await secondRedo.json();
    expect(finalPayload.resume_json.summary).toBe('Third iteration summary');
    expect(finalPayload.after_scores.ats.score).toBe(95);
    expect(finalPayload.preview_url).toBe('/third.pdf');
    expect(finalPayload.language.lang).toBe('es');
  });
});
