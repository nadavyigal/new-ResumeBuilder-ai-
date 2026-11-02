import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';

// The funnel overrides are merged last in src/i18n.ts, so they decide what /he
// shows. Both files carry this copy: a fix in only one of them looks finished
// in review and changes nothing on the page, or comes back when the overrides
// are retired. Growth audit, 2026-10-31.

const FILES = ['src/messages/he.json', 'src/messages-overrides/funnel/he.json'];

type Landing = {
  features: { items: Array<{ description: string }> };
  atsChecker: { slogan?: string };
};

function readLanding(file: string): Landing {
  const raw = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  return (JSON.parse(raw) as { landing: Landing }).landing;
}

describe.each(FILES)('Hebrew landing copy in %s', (file) => {
  const landing = readLanding(file);
  const descriptions = landing.features.items.map((item) => item.description);

  it('treats Resumely as feminine', () => {
    expect(descriptions[0]).toContain('Resumely מציגה');
    expect(descriptions.join(' ')).not.toMatch(/Resumely מציג(?!ה)/);
  });

  it('keeps the required note, in correct Hebrew', () => {
    expect(descriptions[1]).toContain('זו הערכת ההתאמה של Resumely, לא ציון של מערכת גיוס.');
    expect(descriptions[1]).not.toContain('זהו הערכת');
  });

  it('describes the format block without ATS language or a doubt about filters', () => {
    expect(descriptions[4]).toBe('תבניות נקיות וקריאות, שמציגות את הניסיון שלכם בבירור.');
    expect(descriptions.join(' ')).not.toContain('ATS');
    expect(descriptions.join(' ')).not.toContain('ערובה');
  });

  it('carries the slogan exactly as written', () => {
    expect(landing.atsChecker.slogan).toBe('לפני הגשה, בודקים התאמה');
  });
});
