/** @jest-environment node */
/**
 * A job ad's company name is not a skill.
 *
 * Seen 2026-10-15 on a real optimization for "Business Development Manager -
 * Ad tech at Appstock": the dashboard told the candidate "Skills/Tools:
 * appstock" and "Improved appstock by [X%]". The ad names its employer in its
 * duties ("Drive revenue growth for Appstock", "Represent Appstock at industry
 * events"), the requirement atomizer split those into phrases, and "appstock"
 * became a must-have no résumé could ever hold. That held the keyword score
 * down too, for a gap the candidate cannot close.
 */

import { buildJobDataFromExtractedJson, buildParsedDataFromPlainText } from '../job-data-resolver';
import { extractJobData } from '../extractors/jd-extractor';
import { detectCompanyNames, removeCompanyTerms } from '../extractors/company-names';
import { scoreResume } from '..';
import { generateFormatReport } from '../integration';

/** Shape the LinkedIn scraper stores in job_descriptions.parsed_data. */
const SCRAPED_APPSTOCK = {
  job_title: 'Business Development Manager - Ad tech',
  company_name: 'Appstock',
  responsibilities: [
    'Drive revenue growth for Appstock by closing new SSP and DSP partnerships',
    'Represent Appstock at industry events and conferences',
    "Grow Appstock's publisher network across EMEA",
  ],
  qualifications: [
    '3+ years of business development experience in ad tech',
    'Strong knowledge of programmatic advertising and header bidding',
    'Experience with Salesforce or HubSpot',
  ],
};

/** The same ad pasted as text, with no company field to read. */
const PASTED_APPSTOCK = `Business Development Manager - Ad tech at Appstock

Appstock is looking for a Business Development Manager to grow our programmatic partnerships.

What you'll do
Drive revenue growth for Appstock by closing new SSP and DSP partnerships.
Represent Appstock at industry events and conferences.

Who you are
3+ years of business development experience in ad tech. Strong knowledge of programmatic advertising and header bidding.
`;

const RESUME = `Dana Cohen
Business Development Manager

EXPERIENCE
Business Development Manager, AdReach | Jan 2021 - Present
- Closed 14 new SSP and DSP partnerships, growing programmatic revenue 38%
- Ran header bidding integrations with 30 publishers
- Managed the pipeline in Salesforce

SKILLS
Programmatic advertising, header bidding, Salesforce, HubSpot, business development, ad tech
`;

const mentionsAppstock = (terms: string[]) => terms.filter((t) => /appstock/i.test(t));

describe('company names in a job ad are not requirements', () => {
  it('drops the company from a scraped ad that names it in company_name', () => {
    const job = buildJobDataFromExtractedJson(SCRAPED_APPSTOCK, '');
    expect(mentionsAppstock(job.must_have)).toEqual([]);
    expect(mentionsAppstock(job.nice_to_have)).toEqual([]);
    // The real skills around it survive.
    expect(job.must_have).toEqual(expect.arrayContaining(['programmatic advertising', 'salesforce']));
  });

  it('finds the company in a pasted ad with no company field', () => {
    const parsed = buildParsedDataFromPlainText(PASTED_APPSTOCK);
    const job = buildJobDataFromExtractedJson(parsed, PASTED_APPSTOCK);
    expect(mentionsAppstock(job.must_have)).toEqual([]);
    expect(mentionsAppstock(job.nice_to_have)).toEqual([]);
  });

  it('drops the company on the text-only path the scorer takes when the job has no title', () => {
    const job = extractJobData(PASTED_APPSTOCK);
    expect(mentionsAppstock(job.must_have)).toEqual([]);
  });

  it('never shows the company as a missing skill or in any suggestion', async () => {
    const result = await scoreResume({
      resume_original_text: RESUME,
      resume_optimized_text: RESUME,
      job_clean_text: PASTED_APPSTOCK,
      job_extracted_json: buildJobDataFromExtractedJson(SCRAPED_APPSTOCK, PASTED_APPSTOCK),
      format_report: generateFormatReport(RESUME),
    });
    const shownKeywords = result.suggestions.flatMap((s) =>
      s.action?.type === 'add_keyword' ? s.action.params.keywords : [],
    );
    expect(mentionsAppstock(shownKeywords)).toEqual([]);
    expect(result.suggestions.filter((s) => /appstock/i.test(s.text))).toEqual([]);
  }, 60000);
});

describe('detectCompanyNames', () => {
  it.each([
    ['a known company field', '', ['Appstock'], 'Appstock'],
    ['"<title> at <Company>" on the first line', 'Account Executive at Kesher Commerce\n\nWe sell software.', [], 'Kesher Commerce'],
    ['"<Company> is looking for a <Title>"', 'Fresha is looking for a Data Analyst to join the team.', [], 'Fresha'],
    ['an "About <Company>" heading', 'About Monday.com\nWe build work software.', [], 'Monday.com'],
    ['a "Company:" label', 'Job Title: Data Analyst\nCompany: Fiverr\nLocation: Tel Aviv', [], 'Fiverr'],
    ['"At <Company>, we"', 'At Wix, we build websites for everyone.', [], 'Wix'],
  ])('reads %s', (_label, text, known, expected) => {
    expect(detectCompanyNames(text, known)).toContain(expected);
  });

  it('does not read section headings or generic openers as a company', () => {
    const text = 'About the role\nAbout Us\nAbout You\nThe Company is looking for a Data Analyst.\nAt our company, we care.';
    expect(detectCompanyNames(text)).toEqual([]);
  });

  it('does not take a mid-sentence "at" as a company', () => {
    const text = 'Data Analyst\n\nYou will work at scale with Python and SQL, presenting at Monthly Reviews.';
    expect(detectCompanyNames(text)).toEqual([]);
  });
});

describe('removeCompanyTerms', () => {
  it('removes a term that is only the company, including its possessive', () => {
    expect(removeCompanyTerms(['appstock', 'appstock s', "Appstock's", 'header bidding'], ['Appstock'])).toEqual([
      'header bidding',
    ]);
  });

  it('keeps the rest of a phrase the company sits in', () => {
    expect(removeCompanyTerms(['appstock industry events', 'Represent Appstock'], ['Appstock'])).toEqual([
      'industry events',
      'Represent',
    ]);
  });

  it('matches a multi-word company only as a whole', () => {
    expect(removeCompanyTerms(['kesher commerce', 'e commerce platforms', 'commerce'], ['Kesher Commerce'])).toEqual([
      'e commerce platforms',
      'commerce',
    ]);
  });

  it('ignores a legal suffix on the company name', () => {
    expect(removeCompanyTerms(['appstock', 'appstock ltd'], ['Appstock Ltd.'])).toEqual([]);
  });

  it('leaves every term alone when no company is known', () => {
    const terms = ['salesforce', 'header bidding'];
    expect(removeCompanyTerms(terms, [])).toEqual(terms);
  });
});

/**
 * Five failures the PR Steward reproduced on #187 (2026-10-16). Each one either
 * deleted a real requirement or kept the employer as a skill.
 */
describe('company detection does not delete real requirements or miss real employers', () => {
  it('(a) does not read a functional "About Engineering" heading as the employer', () => {
    const text = 'About Engineering\nWe ship the platform.\n\nRequirements\nSoftware engineering experience\nEngineering leadership';
    expect(detectCompanyNames(text)).toEqual([]);
    expect(detectCompanyNames('About Design\nWe care about craft.', ['Acme'])).toEqual(['Acme']);

    const job = buildJobDataFromExtractedJson(
      {
        job_title: 'Engineering Manager',
        company_name: '',
        qualifications: ['Software engineering experience', 'Engineering leadership'],
      },
      text,
    );
    expect(job.must_have.join(' ')).toMatch(/engineering/i);
  });

  it('(b) keeps a known company that starts with an article, and removes it from requirements', () => {
    expect(detectCompanyNames('', ['The Trade Desk'])).toEqual(['The Trade Desk']);
    expect(removeCompanyTerms(['trade desk', 'The Trade Desk', 'programmatic buying'], ['The Trade Desk'])).toEqual([
      'programmatic buying',
    ]);
    // A known field holding only a generic word is still not a company.
    expect(detectCompanyNames('', ['The Company'])).toEqual([]);
  });

  it('(c) reads the fallback heading when the parsed title is prepended', () => {
    const fallback = 'Account Executive at Appstock\n\nRepresent Appstock at industry events.\nStrong knowledge of header bidding.';
    const job = buildJobDataFromExtractedJson(
      {
        job_title: 'Account Executive',
        company_name: '',
        qualifications: ['Represent Appstock at industry events', 'Strong knowledge of header bidding'],
      },
      fallback,
    );
    expect(mentionsAppstock(job.must_have)).toEqual([]);
  });

  it('(d) reads a company name with a lowercase connector', () => {
    expect(detectCompanyNames('Data Analyst at Bank of America\n\nWe move money.')).toContain('Bank of America');
    expect(detectCompanyNames('About Bank of America\nBank of America moves money.')).toContain('Bank of America');
  });

  it('(e) keeps a product requirement that shares the employer name', () => {
    expect(removeCompanyTerms(['Salesforce administration', 'Salesforce'], ['Salesforce'])).toEqual([
      'Salesforce administration',
      'Salesforce',
    ]);
    expect(
      removeCompanyTerms(['salesforce', 'sql'], ['Salesforce'], 'Must have 3+ years of experience with Salesforce.'),
    ).toEqual(['salesforce', 'sql']);
    // The employer alone, in duty phrasing, still goes.
    expect(removeCompanyTerms(['Represent Appstock at industry events', 'appstock'], ['Appstock'])).toEqual([
      'Represent at industry events',
    ]);
  });
});

/** Codex review of c0cd451 (2026-10-16): two headings read as employers on weak evidence. */
describe('company headings need evidence that they name an employer', () => {
  it('does not read a topic heading "<Topic> at <Word>" as "<Title> at <Company>"', () => {
    expect(detectCompanyNames('Machine Learning at Scale\nWe build models with PyTorch.')).toEqual([]);
    // A real title still works.
    expect(detectCompanyNames('Senior Data Engineer at Scale AI\nWe build models.')).toContain('Scale AI');
  });

  it('does not read an unlisted function heading "About <Function>" as the employer', () => {
    expect(detectCompanyNames('About Business Development\nExcel and HubSpot experience required.')).toEqual([]);
    // A name the ad repeats, or that looks like a proper name, still counts.
    expect(detectCompanyNames('About Appstock\nAppstock connects publishers and buyers.')).toContain('Appstock');
    expect(detectCompanyNames('About HubSpot\nWe build CRM software.')).toContain('HubSpot');
  });
});

/** Codex review of fab0d97 (2026-10-17): one product phrase must not turn employer filtering off. */
describe('product evidence is decided per term, not for the whole company', () => {
  it('still removes the employer when the ad only brands it ("Appstock platform", "ecosystem", "cloud")', () => {
    const context = 'Grow the Appstock platform and the Appstock ecosystem with our Appstock cloud partners.';
    expect(
      removeCompanyTerms(['Represent Appstock at industry events', 'appstock', 'header bidding'], ['Appstock'], context),
    ).toEqual(['Represent at industry events', 'header bidding']);
  });

  it('keeps a genuine product requirement and still strips the employer from the other terms', () => {
    const context = 'Requirements: 3 years of Salesforce administration. Represent Salesforce at events.';
    expect(
      removeCompanyTerms(['Represent Salesforce at events', 'Salesforce administration', 'salesforce'], ['Salesforce'], context),
    ).toEqual(['Represent at events', 'Salesforce administration', 'salesforce']);
  });
});
