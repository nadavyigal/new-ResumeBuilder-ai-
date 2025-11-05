import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HistoryStore } from '@/lib/agent/tools/history-store';

jest.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: { id: 'db-history-id', created_at: '2024-01-01T00:00:00Z' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: { id: 'db-history-id', apply_date: '2024-01-02' }, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

describe('HistoryStore undo/redo', () => {
  beforeEach(() => {
    HistoryStore.clearTimeline('user-1');
  });

  it('round-trips undo and redo operations', async () => {
    const first = await HistoryStore.save({ user_id: 'user-1', resume_version_id: 'v1', ats_score: 70 });
    const second = await HistoryStore.save({ user_id: 'user-1', resume_version_id: 'v2', ats_score: 85, notes: 'Improved metrics' });

    expect(typeof second.id).toBe('string');

    const undoResult = await HistoryStore.undo('user-1');
    expect(undoResult.moved?.resume_version_id).toBe('v2');
    expect(undoResult.current?.resume_version_id).toBe('v1');

    const redoResult = await HistoryStore.redo('user-1');
    expect(redoResult.current?.resume_version_id).toBe('v2');

    const snapshot = HistoryStore.getTimeline('user-1');
    expect(snapshot.past.map(entry => entry.resume_version_id)).toEqual(['v1', 'v2']);
    expect(snapshot.future).toHaveLength(0);
  });
});

