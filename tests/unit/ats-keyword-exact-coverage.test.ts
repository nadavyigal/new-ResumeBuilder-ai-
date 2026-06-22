import { KeywordExactAnalyzer } from '@/lib/ats/analyzers/keyword-exact';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';
import type { AnalyzerInput } from '@/lib/ats/types';

const CAL = buildJobDataFromExtractedJson({
  job_title: 'Business Development Manager',
  company_name: 'Cal',
  requirements: [
    'Develop, build, and lead strategic partnerships while identifying opportunities for market expansion',
    'Conduct market research and analyze industry trends, competitive landscapes, and customer behavior',
    'Lead the identification and analysis of new business opportunities within the financial services sector',
    'Manage negotiations and close commercial agreements with strategic partners',
    'Lead cross-functional initiatives and support the execution of the growth strategy',
    '2-3 years of experience in Business Development or Strategy Consulting',
    'Experience working with senior executives and key stakeholders',
    'Experience in the financial services industry and payments ecosystem',
  ],
});

const SCALEOPS = buildJobDataFromExtractedJson({
  job_title: 'Head of Partnerships',
  company_name: 'ScaleOps',
  requirements: [
    'Strong understanding of public cloud, DevOps ecosystems, and subscription/SaaS business models',
    'Experience structuring complex partnerships and co-selling motions',
    'Deep knowledge of software channel and alliance business models',
    'Demonstrated success building and scaling partner ecosystems globally',
  ],
});

const OPTIMIZED_RESUME = `
  Business Development Manager. Conducted market research and market analysis of
  industry trends and competitive landscapes. Developed and led strategic
  partnerships across the financial services and payments sector. Led negotiations
  and closed commercial agreements with strategic partners. Drove cross-functional
  growth initiatives. Worked with senior executives and key stakeholders.
  HSBC Global Liquidity Management, Corporate Banking. Strategy consulting at EY.
`;

function inputFor(jobData: ReturnType<typeof buildJobDataFromExtractedJson>): AnalyzerInput {
  return {
    resume_text: OPTIMIZED_RESUME,
    job_text: '',
    job_data: jobData,
  } as unknown as AnalyzerInput;
}

describe('keyword-exact end-to-end (atomized + proportional)', () => {
  it('crosses the semantic-uncap threshold for a qualified, optimized candidate', async () => {
    const res = await new KeywordExactAnalyzer().analyze(inputFor(CAL));
    expect(res.score).toBeGreaterThan(40);
  });

  it('does NOT inflate a genuine domain mismatch (finance resume vs cloud role)', async () => {
    const res = await new KeywordExactAnalyzer().analyze(inputFor(SCALEOPS));
    expect(res.score).toBeLessThan(30);
  });
});
