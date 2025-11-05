import { describe, it, expect } from '@jest/globals';
import { getByPointer, setByPointer, removeByPointer, joinPointer } from '@/lib/agent/utils/json-pointer';

describe('JSON Pointer utilities', () => {
  it('reads and writes nested values', () => {
    const base = { experience: [{ achievements: ['Built API'] }] };
    const updated = setByPointer(base, '/experience/0/title', 'Senior Engineer');
    expect(getByPointer(updated, '/experience/0/title')).toBe('Senior Engineer');
    expect(getByPointer(base, '/experience/0/title')).toBeUndefined();
  });

  it('removes entries from arrays', () => {
    const base = { skills: { technical: ['React', 'Node'] } };
    const updated = removeByPointer(base, '/skills/technical/0');
    expect(getByPointer(updated, '/skills/technical/0')).toBe('Node');
  });

  it('joins segments safely', () => {
    const pointer = joinPointer('/experience/0', 'achievements', '1');
    expect(pointer).toBe('/experience/0/achievements/1');
  });
});

