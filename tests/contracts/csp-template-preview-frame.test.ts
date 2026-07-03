import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('template preview CSP', () => {
  it('allows only same-origin frames so template previews can render', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');

    expect(config).toContain("frame-src 'self'");
    expect(config).toContain("frame-ancestors 'self'");
    expect(config).toContain("X-Frame-Options', value: 'SAMEORIGIN'");
    expect(config).not.toContain('frame-src https:');
    expect(config).not.toContain('frame-src *');
  });
});