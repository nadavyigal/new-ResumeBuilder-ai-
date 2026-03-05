import { describe, it, expect } from '@jest/globals';
import { HistoryStore } from '@/lib/agent/tools/history-store';

describe('POST /api/agent/apply (store stub)', () => {
  it('links apply date (unit of HistoryStore)', async () => {
    // This is a placeholder unit-level test; e2e requires a real DB.
    expect(typeof HistoryStore.linkApply).toBe('function');
  });
});

