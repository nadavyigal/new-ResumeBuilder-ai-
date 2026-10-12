/**
 * Two defects seen 2026-10-12 in the iOS free check ("what's holding the score
 * back"), Maya Levin fixture against a pasted Data Analyst post:
 *
 *   "Align your headline or summary with the target title '{targetTitle}' ..."
 *   "Add the missing skill 'similar role' to Skills ..."
 *
 * The first is a template shipped with its placeholder unfilled because the job
 * text had no parseable title. The second is filler from "or in a similar role"
 * presented as a missing skill.
 */
import { generateSuggestions } from '../generator';
import { extractJobData, extractHiringSentence } from '../../extractors/jd-extractor';
import type { AnalyzerResult, JobExtraction, SubScoreKey, SubScores } from '../../types';

const SUBSCORES: SubScores = {
  keyword_exact: 30,
  keyword_phrase: 90,
  semantic_relevance: 90,
  format_parseability: 90,
  title_alignment: 30,
  metrics_presence: 90,
  section_completeness: 90,
  recency_fit: 90,
};

const JOB_WITHOUT_TITLE: JobExtraction = {
  title: '',
  company: '',
  must_have: ['similar role', 'sql skills', 'looker'],
  nice_to_have: [],
  responsibilities: [],
  seniority: 'mid',
  location: '',
  industry: '',
};

function result(score: number, evidence: Record<string, unknown>): AnalyzerResult {
  return { score, evidence, confidence: 1, warnings: [] };
}

const PLACEHOLDER = /\{[a-zA-Z_]+\}/;

describe('suggestions never ship an unfilled template placeholder', () => {
  it('drops the title-alignment suggestion when the job has no target title', () => {
    const suggestions = generateSuggestions({
      subscores: SUBSCORES,
      analyzerResults: new Map<SubScoreKey, AnalyzerResult>([
        // What TitleAlignmentAnalyzer returns when job_data.title is empty.
        ['title_alignment', result(30, { error: 'No target title available' })],
      ]),
      jobData: JOB_WITHOUT_TITLE,
    });

    for (const s of suggestions) expect(s.text).not.toMatch(PLACEHOLDER);
    expect(suggestions.some((s) => s.text.includes('target title'))).toBe(false);
  });

  it('still emits the title suggestion when a target title exists', () => {
    const suggestions = generateSuggestions({
      subscores: SUBSCORES,
      analyzerResults: new Map<SubScoreKey, AnalyzerResult>([
        ['title_alignment', result(30, { targetTitle: 'Data Analyst', targetSeniority: 'mid' })],
      ]),
      jobData: { ...JOB_WITHOUT_TITLE, title: 'Data Analyst' },
    });

    const title = suggestions.find((s) => s.text.includes('target title'));
    expect(title?.text).toContain("'Data Analyst'");
  });

  it('drops a keyword template whose every candidate was filtered out', () => {
    const suggestions = generateSuggestions({
      subscores: SUBSCORES,
      analyzerResults: new Map<SubScoreKey, AnalyzerResult>([
        ['keyword_exact', result(30, { missing: ['similar role', 'have'], mustHaveTotal: 6, mustHaveMatched: 2 })],
      ]),
      jobData: { ...JOB_WITHOUT_TITLE, must_have: ['similar role', 'have'] },
    });

    for (const s of suggestions) expect(s.text).not.toMatch(PLACEHOLDER);
  });
});

describe('filler phrases are never offered as a missing skill', () => {
  it.each(['similar role', 'similar position', 'have', 'why', 'requirements', 'relevant experience'])(
    'rejects %p',
    (filler) => {
      const suggestions = generateSuggestions({
        subscores: SUBSCORES,
        analyzerResults: new Map<SubScoreKey, AnalyzerResult>([
          ['keyword_exact', result(30, { missing: [filler, 'looker'], mustHaveTotal: 4, mustHaveMatched: 2 })],
        ]),
        jobData: { ...JOB_WITHOUT_TITLE, must_have: [filler, 'looker'] },
      });

      const offered = suggestions.flatMap((s) =>
        s.action?.type === 'add_keyword' ? s.action.params.keywords : [],
      );
      expect(offered).toContain('looker');
      expect(offered).not.toContain(filler);
      for (const s of suggestions) expect(s.text.toLowerCase()).not.toContain(`'${filler}'`);
    },
  );

  it('keeps real skills that contain one filler word', () => {
    const suggestions = generateSuggestions({
      subscores: SUBSCORES,
      analyzerResults: new Map<SubScoreKey, AnalyzerResult>([
        ['keyword_exact', result(30, { missing: ['similar bi tool', 'role based access'], mustHaveTotal: 4, mustHaveMatched: 2 })],
      ]),
      jobData: { ...JOB_WITHOUT_TITLE, must_have: ['similar bi tool', 'role based access'] },
    });

    const offered = suggestions.flatMap((s) =>
      s.action?.type === 'add_keyword' ? s.action.params.keywords : [],
    );
    expect(offered).toEqual(expect.arrayContaining(['similar bi tool', 'role based access']));
  });
});

describe('pasted job text yields a title and company for the saved job label', () => {
  const MAYA_JOB = [
    'Data Analyst, Sales Insights (fictional demo role) - Kesher Commerce, Tel Aviv',
    '',
    'About the role',
    'Kesher Commerce is looking for a Data Analyst to join the Sales Insights team. You will turn sales data into clear weekly reporting.',
    '',
    'Requirements',
    '- 3+ years of experience as a data analyst or in a similar role.',
    '- Strong SQL skills.',
  ].join('\n');

  it('labels the saved job from "<Company> is looking for a <Title>"', () => {
    // upload-resume/route.ts saves these when the post has no other title or
    // company; before, the row read "Job Position" / "Company Name" and iOS
    // showed that as the preview header.
    expect(extractHiringSentence(MAYA_JOB)).toEqual({ title: 'Data Analyst', company: 'Kesher Commerce' });
  });

  it('does not change the scoring extraction', () => {
    // A title here would move title_alignment from its neutral 50 to the
    // "resume titles unparsed" 20 for this fixture. Out of scope for a label fix.
    expect(extractJobData(MAYA_JOB).title).toBe('');
  });

  it.each([
    ['Acme Corp is hiring a Senior Product Designer who loves systems.', 'Senior Product Designer', 'Acme Corp'],
    ['Northwind is seeking an Account Executive for the EMEA region.', 'Account Executive', 'Northwind'],
    ['Our team is looking for a Data Engineer to own pipelines.', '', ''],
    ['The company is hiring a Backend Engineer.', '', ''],
    ['The Company is hiring a Backend Engineer.', 'Backend Engineer', ''],
    ['Join us to build great things.', '', ''],
  ])('reads %p', (text, title, company) => {
    expect(extractHiringSentence(text)).toEqual({ title, company });
  });
});
