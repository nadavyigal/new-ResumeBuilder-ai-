/**
 * @jest-environment node
 *
 * The baseline has exactly one writer (WP-45 D8)
 *
 * `ats_score_original` is the number the user's whole journey is anchored to.
 * It is measured once, when the review run is created, and must never be
 * rewritten afterwards.
 *
 * WP-45 D8 fixed three writers — review creation, accept, and the iOS rescan
 * display — and shipped believing the problem was solved. It was not: two more
 * existed on the server, and production data after that deploy still showed the
 * stored baseline disagreeing with the fit check on every run.
 *
 *   /api/ats/rescan          re-scored and wrote ats_score_original
 *   expert-workflows/orchestrator  did the same after an expert apply
 *
 * Reading the code found the first three. Only the data found the other two.
 * This test exists so the next one is found by CI instead: it fails the moment
 * any new code path writes this column in an UPDATE.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(process.cwd(), 'src');

/** The one place a baseline is legitimately established. */
const ALLOWED = ['src/lib/optimization-review/service.ts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Find Supabase `.update({...})` calls whose payload sets ats_score_original.
 *
 * Deliberately crude: it scans the text of each update payload rather than
 * parsing. A false positive is a developer reading this comment; a false
 * negative is another month of users watching their score move.
 */
function updatesWritingBaseline(source: string): string[] {
  const hits: string[] = [];
  const re = /\.update\(\s*\{/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(source)) !== null) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    const start = i;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const payload = source.slice(start, i + 1);
    if (/(^|[^_\w])ats_score_original\s*:/.test(payload)) hits.push(payload.slice(0, 120));
  }
  return hits;
}

describe('ats_score_original has a single writer', () => {
  it('is never written by an UPDATE outside the review service', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const rel = path.relative(process.cwd(), file);
      if (ALLOWED.includes(rel)) continue;

      const hits = updatesWritingBaseline(fs.readFileSync(file, 'utf8'));
      if (hits.length) offenders.push(`${rel}: ${hits.join(' | ')}`);
    }

    expect(offenders).toEqual([]);
  });

  it('is not restored to the two routes that used to write it', () => {
    // Named explicitly, because these are the two that survived a fix that was
    // believed complete and shipped.
    for (const rel of [
      'src/app/api/ats/rescan/route.ts',
      'src/lib/expert-workflows/orchestrator.ts',
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(updatesWritingBaseline(source)).toEqual([]);
    }
  });
});
