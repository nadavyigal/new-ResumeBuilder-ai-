import { describe, it, expect } from '@jest/globals';
import { DesignOps } from '@/lib/agent/tools/design-ops';

describe('DesignOps.theme', () => {
  it('normalizes color hex and defaults', () => {
    const t = DesignOps.theme({ color_hex: '0ea5e9', font_family: 'Inter' });
    expect(t.color_hex).toBe('#0EA5E9');
    expect(t.font_family).toBe('Inter');
  });

  it('falls back to defaults when missing', () => {
    const t = DesignOps.theme({});
    expect(t.font_family).toBe('Inter');
    expect(t.color_hex).toBe('#0EA5E9');
  });
});

