/**
 * Deterministic content-rule checks for AI output (prompt upgrade 2026-11-24).
 * Lists live in evals/content-rules.json; the competitors list stays empty until
 * the founder approves one. A hit on a phrase the source resume already contains
 * (a candidate who worked in pricing) is a warning, not a failure.
 * Invented-score checks are deliberately absent: model estimates stay (founder
 * decision 2026-11-23).
 */
import rules from '../content-rules.json';
import type { OptimizedResume } from '@/lib/ai-optimizer';

export type Severity = 'critical' | 'high' | 'warning';

export interface ContentFinding {
  check: string;
  severity: Severity;
  detail: string;
}

const HEBREW = /[֐-׿]/;
const HEBREW_G = /[֐-׿]/g;
const LATIN_G = /[A-Za-z]/g;

function norm(text: string): string {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}$₪%+#"'\-/]+/gu, ' ').trim()} `;
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return norm(haystack).includes(` ${phrase.toLowerCase()} `) || (phrase.includes(' ') && norm(haystack).includes(phrase.toLowerCase()));
}

/** User-facing text values of a tailored resume (contact details excluded). */
export function resumeOutputText(resume: Partial<OptimizedResume> | null | undefined): string {
  if (!resume) return '';
  const parts: string[] = [resume.summary || ''];
  for (const role of resume.experience || []) parts.push(role.title, role.company, ...(role.achievements || []));
  for (const e of resume.education || []) parts.push(e.degree, e.institution);
  parts.push(...(resume.skills?.technical || []), ...(resume.skills?.soft || []));
  parts.push(...(resume.certifications || []));
  for (const p of resume.projects || []) parts.push(p.name, p.description);
  parts.push(...(resume.keyImprovements || []));
  return parts.filter(Boolean).join('\n');
}

type ListName = 'competitors' | 'atsBeat' | 'robot' | 'guarantee' | 'price';

/** Beat-ATS, robot, guarantee, price and competitor phrases. */
export function contentRuleFindings(text: string, sourceText = '', lists: Partial<Record<ListName, string[]>> = rules): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const names: ListName[] = ['competitors', 'atsBeat', 'robot', 'guarantee', 'price'];
  for (const name of names) {
    for (const phrase of lists[name] ?? []) {
      if (!hasPhrase(text, phrase)) continue;
      const inSource = sourceText !== '' && hasPhrase(sourceText, phrase);
      findings.push({ check: `content.${name}`, severity: inSource ? 'warning' : 'critical', detail: phrase });
    }
  }
  if (/[$₪]\s?\d/.test(text) && !/[$₪]\s?\d/.test(sourceText)) {
    findings.push({ check: 'content.price', severity: 'critical', detail: 'currency amount' });
  }
  return findings;
}

/** Placeholder values that print in a resume the candidate sends. */
export function placeholderFindings(values: string[]): ContentFinding[] {
  const set = new Set(rules.placeholders);
  return values
    .filter((v) => set.has(v.trim().toLowerCase()))
    .map((v) => ({ check: 'placeholder', severity: 'high' as const, detail: v }));
}

/** Hebrew slash forms from job ads ("מפתח/ת", "דרוש/ה") copied into candidate text. */
export function slashFormFindings(text: string): ContentFinding[] {
  const matches = text.match(/[֐-׿]+\/[֐-׿]{1,2}(?![֐-׿])/g) ?? [];
  return [...new Set(matches)].map((m) => ({ check: 'hebrew.slash_form', severity: 'high' as const, detail: m }));
}

/**
 * Share of letters in the expected script, ignoring Latin tokens that appear in
 * the source (tool and company names stay in Latin by rule). Below 85% fails.
 */
export function languageMatch(text: string, expected: 'he' | 'en', sourceText = ''): { ratio: number; finding?: ContentFinding } {
  const sourceLatin = new Set((sourceText.match(/[A-Za-z][A-Za-z0-9.+#-]*/g) ?? []).map((t) => t.toLowerCase()));
  const stripped = text.replace(/[A-Za-z][A-Za-z0-9.+#-]*/g, (tok) => (sourceLatin.has(tok.toLowerCase()) ? ' ' : tok));
  const he = (stripped.match(HEBREW_G) ?? []).length;
  const en = (stripped.match(LATIN_G) ?? []).length;
  const total = he + en;
  if (total === 0) return { ratio: 1 };
  const ratio = (expected === 'he' ? he : en) / total;
  return ratio >= 0.85
    ? { ratio }
    : { ratio, finding: { check: 'language.match', severity: 'high', detail: `${Math.round(ratio * 100)}% ${expected}` } };
}

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר', 'היום'];

/** Every year and Hebrew month or "היום" in the source must still appear in the output. */
export function dateFindings(outputDates: string, sourceText: string): ContentFinding[] {
  const tokens = new Set<string>(sourceText.match(/\b(?:19|20)\d\d\b/g) ?? []);
  for (const m of HEBREW_MONTHS) if (sourceText.includes(m)) tokens.add(m);
  return [...tokens]
    .filter((t) => !outputDates.includes(t))
    .map((t) => ({ check: 'dates.changed', severity: 'high' as const, detail: t }));
}

const GENDER_PAIRS: Array<[feminine: string, masculine: string]> = [
  ['בודקת', 'בודק'],
  ['מתכנתת', 'מתכנת'],
  ['מפתחת', 'מפתח'],
  ['מהנדסת', 'מהנדס'],
  ['מנהלת', 'מנהל'],
  ['קצינת', 'קצין'],
  ['אחראית', 'אחראי'],
  ['נציגת', 'נציג'],
  ['אנליסטית', 'אנליסט'],
  ['רכזת', 'רכז'],
];

/**
 * Warning only (design doc 8.4): the candidate's feminine self-descriptor in the
 * source became masculine in the output, and the feminine form is gone.
 */
export function genderFindings(outputText: string, sourceText: string): ContentFinding[] {
  if (!HEBREW.test(sourceText)) return [];
  const words = (t: string) => new Set(t.split(/[^֐-׿"]+/).filter(Boolean));
  const src = words(sourceText);
  const out = words(outputText);
  return GENDER_PAIRS.filter(([f, m]) => src.has(f) && !src.has(m) && out.has(m) && !out.has(f)).map(([f, m]) => ({
    check: 'hebrew.gender_flip',
    severity: 'warning' as const,
    detail: `${f} -> ${m}`,
  }));
}

/** All checks on one tailored resume. */
export function checkTailoredResume(
  resume: Partial<OptimizedResume> | null | undefined,
  sourceText: string,
  expectedLanguage: 'he' | 'en'
): { findings: ContentFinding[]; languageRatio: number } {
  const text = resumeOutputText(resume);
  const dates = (resume?.experience || []).flatMap((r) => [r.startDate, r.endDate]).concat((resume?.education || []).map((e) => e.graduationDate)).join(' ');
  const values: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') values.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(resume);
  const lang = languageMatch(text, expectedLanguage, sourceText);
  return {
    languageRatio: lang.ratio,
    findings: [
      ...contentRuleFindings(text, sourceText),
      ...placeholderFindings(values),
      ...slashFormFindings(text),
      ...(lang.finding ? [lang.finding] : []),
      // Years also live in bullets and certificate lines, so the whole output counts.
      ...dateFindings(`${dates}\n${values.join('\n')}`, sourceText),
      ...genderFindings(text, sourceText),
    ],
  };
}
