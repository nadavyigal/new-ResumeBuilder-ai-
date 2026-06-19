import { buildJobDataFromExtractedJson, normalizeParsedJobData } from '@/lib/ats/job-data-resolver';
import { scoreResume } from '@/lib/ats/index';

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

  const parsedData = {
    job_title: 'Business Development Manager',
    company_name: 'Example Corp',
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
    location: 'Tel Aviv',
  };

  it('fills must_have from qualifications when requirements is null', () => {
    const jobData = buildJobDataFromExtractedJson(parsedData, cleanText);

    expect(jobData.must_have.length).toBeGreaterThan(0);
    expect(jobData.must_have).toEqual(
      expect.arrayContaining(['5+ years B2B sales experience', 'CRM proficiency (Salesforce, HubSpot)']),
    );
  });

  it('keeps explicit requirements without double-counting qualifications', () => {
    const withRequirements = {
      ...parsedData,
      requirements: ['Existing requirement only'],
    };

    const jobData = buildJobDataFromExtractedJson(withRequirements, cleanText);
    expect(jobData.must_have).toEqual(['Existing requirement only']);
  });

  it('normalizes parsed_data at scrape time', () => {
    const normalized = normalizeParsedJobData(parsedData);
    expect(Array.isArray(normalized.requirements)).toBe(true);
    expect((normalized.requirements as string[]).length).toBeGreaterThan(0);
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
