import {
  buildJobDataFromExtractedJson,
  buildJobDescriptionTextFromParsed,
  buildParsedDataFromPlainText,
  filterRequirementFragments,
  normalizeParsedJobData,
  resolveJobDescriptionText,
} from '@/lib/ats/job-data-resolver';
import { scoreResume } from '@/lib/ats/index';
import type { ExtractedJobData } from '@/lib/scraper/jobExtractor';

function mockExtractedJobData(
  overrides: Partial<ExtractedJobData> = {},
): ExtractedJobData {
  return {
    source_url: 'https://example.com/jobs/1',
    source_domain: 'example.com',
    scraped_at: '2026-06-19T00:00:00.000Z',
    company_name: 'Example Corp',
    job_title: 'Business Development Manager',
    contact_person: null,
    location: 'Tel Aviv',
    employment_type: null,
    seniority: null,
    compensation: null,
    about_this_job: null,
    requirements: null,
    responsibilities: [],
    qualifications: [],
    nice_to_have: null,
    benefits: null,
    application_instructions: null,
    posting_id: null,
    provenance: {},
    summary_for_ui: {
      company_name: 'Example Corp',
      job_title: 'Business Development Manager',
      contact_person: null,
      location: 'Tel Aviv',
    },
    ...overrides,
  };
}

describe('ats job-data resolver', () => {
  const cleanText = `
    Business Development Manager - Tel Aviv
    Requirements:
    - 5+ years B2B sales experience
    - CRM proficiency (Salesforce, HubSpot)
    - Fluent English and Hebrew
    - SaaS or technology industry background
    - Strong negotiation and pipeline management skills
  `;

  const parsedData = mockExtractedJobData({
    requirements: null,
    qualifications: [
      '5+ years B2B sales experience',
      'CRM proficiency (Salesforce, HubSpot)',
      'Fluent English and Hebrew',
    ],
    responsibilities: [
      'Own enterprise pipeline and quarterly revenue targets',
      'Partner with marketing on lead generation campaigns',
    ],
    nice_to_have: ['Experience selling SaaS products'],
  });

  it('fills must_have from qualifications when requirements is null', () => {
    const jobData = buildJobDataFromExtractedJson(parsedData, cleanText);

    expect(jobData.must_have.length).toBeGreaterThan(0);
    expect(jobData.must_have).toEqual(
      expect.arrayContaining(['b2b sales experience', 'crm proficiency salesforce']),
    );
    expect(jobData.must_have.every((keyword) => keyword.split(' ').length <= 3)).toBe(true);
  });

  it('keeps explicit requirements without double-counting qualifications', () => {
    const withRequirements = mockExtractedJobData({
      requirements: ['Existing requirement only'],
      qualifications: ['Should not appear in must_have'],
    });

    const jobData = buildJobDataFromExtractedJson(withRequirements, cleanText);
    expect(jobData.must_have).toEqual(['requirement only']);
    expect(jobData.must_have).not.toEqual(
      expect.arrayContaining(['should not appear']),
    );
  });

  it('normalizes parsed_data at scrape time', () => {
    const normalized = normalizeParsedJobData(parsedData);
    expect(normalized.requirements).not.toBeNull();
    expect(normalized.requirements?.length).toBeGreaterThan(0);
  });

  it('filters sentence fragments from requirement bullets', () => {
    const filtered = filterRequirementFragments([
      'SQL',
      'leadership',
      'We',
      'go',
      '5+ years B2B sales',
    ]);
    expect(filtered).toEqual(['SQL', 'leadership', '5+ years B2B sales']);
  });

  it('builds parsed_data from pasted plain text', () => {
    const pasted = `
      Business Development Manager
      Requirements:
      - B2B sales experience
      - Salesforce CRM
      - SaaS background
    `;
    const parsed = buildParsedDataFromPlainText(pasted);
    expect(parsed.requirements?.length).toBeGreaterThan(0);
  });

  it('prefers richer clean_text over truncated raw_text', () => {
    const parsed = {
      job_title: 'Business Development Manager',
      requirements: ['B2B sales', 'Salesforce', 'SaaS', 'negotiation', 'pipeline management'],
      qualifications: ['Fluent English'],
      responsibilities: ['Own enterprise pipeline'],
    };

    const resolved = resolveJobDescriptionText({
      raw_text: 'BDM role in Tel Aviv. Great opportunity.',
      clean_text: buildJobDescriptionTextFromParsed(parsed),
      parsed_data: parsed,
    });

    expect(resolved.length).toBeGreaterThan(80);
    expect(resolved).toContain('Requirements:');
  });
});

describe('scoreResume with sparse parsed_data', () => {
  it('produces keyword_exact > 0 when qualifications exist but requirements is null', async () => {
    const resumeText = `
      Business Development Manager with 6 years of B2B SaaS sales.
      Skills: Salesforce, HubSpot, pipeline management, negotiation, enterprise sales.
      Fluent in English and Hebrew. Closed $2M ARR across Tel Aviv accounts.
    `;

    const optimizedText = resumeText;

    const result = await scoreResume({
      resume_original_text: resumeText,
      resume_optimized_text: optimizedText,
      job_clean_text: `
        Business Development Manager Tel Aviv
        Qualifications: B2B sales, Salesforce, HubSpot, SaaS, negotiation, pipeline management
      `,
      job_extracted_json: buildJobDataFromExtractedJson(
        {
          job_title: 'Business Development Manager',
          requirements: null,
          qualifications: ['B2B sales', 'Salesforce', 'HubSpot', 'SaaS', 'negotiation'],
          responsibilities: ['Pipeline management', 'Enterprise revenue targets'],
        },
        'Business Development Manager Tel Aviv',
      ),
      format_report: {
        has_tables: false,
        has_images: false,
        has_headers_footers: false,
        has_nonstandard_fonts: false,
        has_odd_glyphs: false,
        has_multi_column: false,
        format_safety_score: 85,
        issues: [],
      },
    });

    expect(result.subscores.keyword_exact).toBeGreaterThan(0);
    expect(result.ats_score_optimized).toBeGreaterThan(35);
  });
});
