/**
 * Free-check honesty, pinned to the three fictional candidates run through the
 * live free check on 2026-10-11 (Itay: Customer Success, Noa: Instructional
 * Designer, Maya: Data Analyst). Fixtures: tests/fixtures/free-check-2026-10-11.
 *
 * Quoted "observed" rewrites are the production outputs from that run. Where the
 * capture recorded only the start of a rewrite, the test uses that start and says so.
 */

import fs from 'fs';
import path from 'path';
import { extractJobData } from '@/lib/ats/extractors/jd-extractor';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';
import { scoreResume } from '@/lib/ats';
import { generateFormatReport } from '@/lib/ats/integration';
import { checkQuickWinGrounding, type GroundingContext } from '@/lib/ats/quick-wins/grounding';
import { buildQuickWinsPrompt } from '@/lib/ats/quick-wins/prompt';
import type { QuickWinSuggestion, SubScores } from '@/lib/ats/types';

const mockCompletion = jest.fn();
jest.mock('@/lib/openai', () => ({ getOpenAI: () => ({}) }));
jest.mock('@/lib/posthog-ai', () => ({
  trackedChatCompletion: (...args: unknown[]) => mockCompletion(...args),
}));

// Imported after the mocks so the generator binds to them.
import { generateQuickWins } from '@/lib/ats/quick-wins/generator';

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/free-check-2026-10-11');
const read = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const CASES = {
  itay: { resume: read('itay-shalev-resume.txt'), job: read('job-customer-success.txt') },
  noa: { resume: read('noa-mizrahi-resume.txt'), job: read('job-instructional-designer.txt') },
  maya: { resume: read('maya-levin-resume.txt'), job: read('job-data-analyst.txt') },
};

function jobDataFor(job: string) {
  return buildJobDataFromExtractedJson(extractJobData(job), job);
}

function ctxFor(c: { resume: string; job: string }, jobTitle?: string): GroundingContext {
  return { resumeText: c.resume, jobText: c.job, jobTitle };
}

function qw(
  original_text: string,
  optimized_text: string,
  section: QuickWinSuggestion['location']['section'] = 'experience',
): QuickWinSuggestion {
  return {
    id: 'test',
    original_text,
    optimized_text,
    improvement_type: 'keyword_optimization',
    estimated_impact: 5,
    location: { section },
    rationale: 'test',
    keywords_added: [],
  };
}

describe('keyword extraction drops filler (2026-10-11 fixtures)', () => {
  const FILLER = [
    'finish',
    'acting early risk',
    'portfolio about mid',
    'write sql queries',
    'write storyboards',
    'explain what changed',
    'why',
    'have',
    'requirements',
    'date gainsight',
    'reduce churn tracking',
    'show results achieved',
    'publish',
  ];

  it.each(Object.entries(CASES))('%s: no filler phrase is a must-have', (_name, c) => {
    const { must_have, nice_to_have } = jobDataFor(c.job);
    for (const junk of FILLER) {
      expect(must_have).not.toContain(junk);
      expect(nice_to_have).not.toContain(junk);
    }
  });

  it('keeps the real skills each job asks for', () => {
    expect(jobDataFor(CASES.itay.job).must_have).toEqual(
      expect.arrayContaining(['renewals', 'reduce churn', 'account health', 'gainsight', 'salesforce']),
    );
    expect(jobDataFor(CASES.noa.job).must_have).toEqual(
      expect.arrayContaining(['storyboards', 'learning objectives', 'moodle', 'self paced courses']),
    );
    expect(jobDataFor(CASES.maya.job).must_have).toEqual(
      expect.arrayContaining(['sql queries', 'regional performance', 'data quality', 'tableau']),
    );
  });

  it.each(Object.entries(CASES))(
    '%s: the "missing skills" shown to the user contain no filler',
    async (_name, c) => {
      const result = await scoreResume({
        resume_original_text: c.resume,
        resume_optimized_text: c.resume,
        job_clean_text: c.job,
        job_extracted_json: jobDataFor(c.job),
        format_report: generateFormatReport(c.resume),
      });
      const shown = result.suggestions.flatMap((s) =>
        s.action?.type === 'add_keyword' ? s.action.params.keywords : [],
      );
      expect(shown.length).toBeGreaterThan(0);
      for (const junk of FILLER) expect(shown).not.toContain(junk);
    },
    60000,
  );
});

describe('quick-win grounding: observed fabrications are rejected', () => {
  it('Itay #1: placeholder over a real number, 38 dropped, job duties copied in', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Renewed 38 of 41 accounts up for renewal in 2024.',
        'Achieved a [X%] renewal rate for a portfolio of 41 mid-market accounts in 2024, focusing on reducing churn by tracking account health and acting early on risk.',
      ),
      ctxFor(CASES.itay),
    );
    expect(check.ok).toBe(false);
    expect(check.violations).toEqual(
      expect.arrayContaining(['dropped_number', 'placeholder_over_real_number', 'job_terms_added']),
    );
    expect(check.jobOnlyTerms).toEqual(expect.arrayContaining(['churn', 'health', 'risk']));
  });

  it('Itay #2: the job post\'s "60" becomes the candidate\'s portfolio size (start of rewrite as captured)', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Managed a portfolio of mid-market accounts and ensured customer satisfaction.',
        'Managed a portfolio of 60 mid-market accounts',
      ),
      ctxFor(CASES.itay),
    );
    expect(check.violations).toContain('invented_number');
  });

  it('Noa #2: exam preparation replaced by learning objectives and storyboards (start of rewrite as captured)', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Prepared students for national matriculation exams.',
        'Developed comprehensive learning objectives and storyboards',
      ),
      ctxFor(CASES.noa),
    );
    expect(check.ok).toBe(false);
    expect(check.violations).toContain('job_terms_added');
  });

  it('Noa #1: "over 150" and job duties (interactive content, assessments) added to a real bullet', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Built 12 self-paced online course units in Moodle, used by 150 students during remote learning.',
        'Designed and published 12 self-paced e-learning modules in Moodle, engaging over 150 students during remote learning with interactive content and assessments.',
      ),
      ctxFor(CASES.noa),
    );
    expect(check.violations).toEqual(expect.arrayContaining(['inflated_number', 'job_terms_added']));
  });

  it('Maya #1: monthly reports become "the weekly KPI report for sales leadership"', () => {
    const check = checkQuickWinGrounding(
      qw('Prepared monthly reports for managers.', 'Owned the weekly KPI report for sales leadership'),
      ctxFor(CASES.maya),
    );
    expect(check.ok).toBe(false);
  });

  // First live run on the PR #167 preview, 2026-10-11, with the old two-term
  // budget: both passed the guard and both claim something Itay never wrote.
  it.each([
    [
      'Spearheaded customer success initiatives to drive engagement and value.',
      'Spearheaded customer success initiatives to drive engagement, reduce churn, and enhance account health.',
    ],
    [
      'Collaborated cross-functionally to deliver exceptional customer experiences.',
      'Collaborated cross-functionally with customer executives to deliver exceptional customer experiences.',
    ],
  ])('preview run: job duty or scope appended to a real bullet: %s', (original, optimized) => {
    const check = checkQuickWinGrounding(qw(original, optimized), ctxFor(CASES.itay));
    expect(check.violations).toContain('job_terms_added');
  });

  it('Maya #2 as captured: "regional performance metrics" is the job\'s scope, not hers', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Built SQL dashboards in Looker to monitor weekly sales by region.',
        'Developed and maintained SQL dashboards in Looker to track weekly sales and regional performance metrics.',
      ),
      ctxFor(CASES.maya),
    );
    expect(check.jobOnlyTerms).toEqual(expect.arrayContaining(['performance', 'metrics']));
    expect(check.ok).toBe(false);
  });

  // CodeRabbit on PR #167: both passed the first version of the guard.
  it('rejects a "before" built from résumé words but never written', () => {
    const check = checkQuickWinGrounding(
      qw('Managed quarterly renewals for key accounts.', 'Managed quarterly renewals for key accounts.'),
      ctxFor(CASES.itay),
    );
    expect(check.violations).toContain('original_not_in_resume');
  });

  it.each(['experience', 'summary'] as const)(
    'rejects a number taken from another bullet (%s): 41 renewals become a portfolio of 41',
    (section) => {
      const check = checkQuickWinGrounding(
        qw(
          'Managed a portfolio of mid-market accounts and ensured customer satisfaction.',
          'Managed a portfolio of 41 mid-market accounts and ensured customer satisfaction.',
          section,
        ),
        ctxFor(CASES.itay),
      );
      expect(check.violations).toContain('invented_number');
    },
  );

  it('rejects a "before" that is not in the résumé', () => {
    const check = checkQuickWinGrounding(
      qw('Managed 12 enterprise accounts in EMEA.', 'Managed 12 enterprise accounts in EMEA.'),
      ctxFor(CASES.itay),
    );
    expect(check.violations).toContain('original_not_in_resume');
  });
});

describe('quick-win grounding: honest rewrites pass', () => {
  it('Maya: same facts, one action verb swapped for the job\'s', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Built SQL dashboards in Looker to monitor weekly sales by region.',
        'Built SQL dashboards in Looker to track weekly sales by region.',
      ),
      ctxFor(CASES.maya),
    );
    expect(check).toMatchObject({ ok: true, violations: [] });
  });

  it('Itay, preview run: the renewal rate computed from his own 38 of 41', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Renewed 38 of 41 accounts up for renewal in 2024.',
        'Achieved a 93% renewal rate by renewing 38 of 41 accounts up for renewal in 2024.',
      ),
      ctxFor(CASES.itay),
    );
    expect(check).toMatchObject({ ok: true, violations: [] });
  });

  it('Itay: uses his own 38 of 41 and the rate computed from it', () => {
    // As a summary line, gathering the renewal result with its own wording is fine.
    expect(
      checkQuickWinGrounding(
        qw(
          'Spearheaded customer success initiatives to drive engagement and value.',
          'Renewed 38 of 41 accounts up for renewal in 2024 (93%).',
          'summary',
        ),
        ctxFor(CASES.itay),
      ).ok,
    ).toBe(true);
    // As a rewrite of a different experience bullet, the numbers are borrowed.
    expect(
      checkQuickWinGrounding(
        qw(
          'Spearheaded customer success initiatives to drive engagement and value.',
          'Renewed 38 of 41 accounts up for renewal in 2024 (93%).',
        ),
        ctxFor(CASES.itay),
      ).violations,
    ).toContain('invented_number');
    expect(
      checkQuickWinGrounding(
        qw(
          'Renewed 38 of 41 accounts up for renewal in 2024.',
          'Renewed 38 of 41 mid-market accounts up for renewal in 2024, a 93% renewal rate.',
        ),
        ctxFor(CASES.itay),
      ).ok,
    ).toBe(true);
  });

  it('Noa: a summary may name the target role and pull facts from her own bullets', () => {
    const check = checkQuickWinGrounding(
      qw(
        'Dedicated educator with 8 years of experience teaching mathematics to high-school students.',
        'Instructional designer with 8 years of teaching experience. Built 12 self-paced Moodle course units used by 150 students.',
        'summary',
      ),
      ctxFor(CASES.noa, 'Instructional Designer'),
    );
    expect(check).toMatchObject({ ok: true, violations: [] });
  });
});

describe('quick-win prompt', () => {
  it('does not hand the model job duties carrying the posting\'s numbers', () => {
    const prompt = buildQuickWinsPrompt({
      resume_text: CASES.itay.resume,
      resume_json: {} as never,
      job_data: jobDataFor(CASES.itay.job),
      subscores: {} as SubScores,
      current_ats_score: 61,
    });
    expect(prompt).not.toMatch(/about 60/);
    expect(prompt).not.toMatch(/acting early on risk/);
    expect(prompt).toMatch(/do not claim these/i);
    expect(prompt).toMatch(/Keep every number from the original bullet/);
  });
});

describe('generateQuickWins', () => {
  const subscores = {} as SubScores;

  function reply(wins: QuickWinSuggestion[]) {
    return { choices: [{ message: { content: JSON.stringify({ quick_wins: wins }) } }] };
  }

  beforeEach(() => mockCompletion.mockReset());

  it('discards fabricated rewrites, retries once, and never shows the job\'s numbers', async () => {
    const honest = qw(
      'Ran quarterly business reviews with account stakeholders.',
      'Ran quarterly business reviews with account stakeholders across a portfolio of mid-market accounts.',
    );
    const honestReplacement = qw(
      'Renewed 38 of 41 accounts up for renewal in 2024.',
      'Achieved a 93% renewal rate by renewing 38 of 41 accounts up for renewal in 2024.',
    );
    mockCompletion
      .mockResolvedValueOnce(
        reply([
          qw(
            'Renewed 38 of 41 accounts up for renewal in 2024.',
            'Achieved a [X%] renewal rate for a portfolio of 41 mid-market accounts in 2024, focusing on reducing churn by tracking account health and acting early on risk.',
          ),
          qw(
            'Managed a portfolio of mid-market accounts and ensured customer satisfaction.',
            'Managed a portfolio of 60 mid-market accounts',
          ),
          honest,
        ]),
      )
      .mockResolvedValueOnce(reply([honestReplacement]));

    const wins = await generateQuickWins({
      resume_text: CASES.itay.resume,
      resume_json: {} as never,
      job_data: jobDataFor(CASES.itay.job),
      job_text: CASES.itay.job,
      subscores,
      current_ats_score: 61,
    });

    expect(mockCompletion).toHaveBeenCalledTimes(2);
    const repairPrompt = mockCompletion.mock.calls[1][1].messages.at(-1).content as string;
    expect(repairPrompt).toMatch(/adds a number the resume does not contain/);

    expect(wins.map((w) => w.optimized_text)).toEqual([honest.optimized_text, honestReplacement.optimized_text]);
    const shown = wins.map((w) => w.optimized_text).join(' ');
    expect(shown).not.toMatch(/\b60\b|\[X%\]|churn|account health/);
  });

  it('shows one card per bullet when the model rewrites the same bullet twice', async () => {
    const original = 'Ran quarterly business reviews with account stakeholders.';
    mockCompletion.mockResolvedValueOnce(
      reply([
        qw(original, 'Led quarterly business reviews with account stakeholders.'),
        qw(original, 'Ran quarterly business reviews with stakeholders of each account.'),
        qw(
          'Renewed 38 of 41 accounts up for renewal in 2024.',
          'Renewed 38 of 41 accounts up for renewal in 2024 (93%).',
        ),
      ]),
    );
    const wins = await generateQuickWins({
      resume_text: `${CASES.itay.resume}\n\n`, // distinct cache key
      resume_json: {} as never,
      job_data: jobDataFor(CASES.itay.job),
      job_text: CASES.itay.job,
      subscores,
      current_ats_score: 61,
    });
    expect(wins.map((w) => w.original_text)).toEqual([original, 'Renewed 38 of 41 accounts up for renewal in 2024.']);
  });

  it('returns nothing rather than a template claim when the model fails', async () => {
    mockCompletion.mockRejectedValueOnce(new Error('network'));
    const wins = await generateQuickWins({
      resume_text: `${CASES.noa.resume}\n`, // distinct cache key
      resume_json: {} as never,
      job_data: jobDataFor(CASES.noa.job),
      job_text: CASES.noa.job,
      subscores,
      current_ats_score: 44,
    });
    expect(wins).toEqual([]);
  });
});
