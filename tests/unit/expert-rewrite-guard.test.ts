/**
 * Expert full rewrite: deterministic truth guards at generation time (S4),
 * planted-failure style like evals/resume-optimizer/planted.ts.
 */
jest.mock('openai');

import type { OptimizedResume } from '@/lib/ai-optimizer';
import { guardRewriteOutput, rewriteEvidenceSource } from '@/lib/expert-workflows/rewrite-guard';
import { buildRewritePrompt } from '@/lib/expert-workflows/prompts/rewrite';
import { buildCoverLetterPrompt } from '@/lib/expert-workflows/prompts/cover-letter';
import { buildATSReportPrompt } from '@/lib/expert-workflows/prompts/ats-report';
import type { ExpertWorkflowContext } from '@/lib/expert-workflows/types';

const ORIGINAL = `Dana Cohen
Backend Developer, Acme Ltd, 2020 - Present
- Built microservices in Go and Docker.
- Led the move to CI in GitHub Actions.
Skills: Go, Docker, GitHub Actions`;

function resume(overrides: Partial<OptimizedResume> = {}): OptimizedResume {
  return {
    summary: 'Backend Developer building services in Go.',
    contact: { name: 'Dana Cohen', email: '', phone: '', location: '' },
    skills: { technical: ['Go', 'Docker', 'GitHub Actions'], soft: [] },
    experience: [
      {
        title: 'Backend Developer',
        company: 'Acme Ltd',
        location: '',
        startDate: '2020',
        endDate: 'Present',
        achievements: ['Built microservices in Go and Docker.', 'Led the move to CI in GitHub Actions.'],
      },
    ],
    education: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
    ...overrides,
  };
}

function context(overrides: Partial<ExpertWorkflowContext> = {}): ExpertWorkflowContext {
  return {
    user_id: 'u',
    optimization_id: 'o',
    workflow_type: 'full_resume_rewrite',
    options: {},
    evidence_inputs: {},
    resume_original_text: ORIGINAL,
    job_description_text: 'Senior Backend Engineer. Go, Kubernetes, AWS. Mentoring juniors.',
    job_title: 'Senior Backend Engineer',
    job_company: 'Beta',
    current_resume_json: resume(),
    current_ats_score_optimized: 64,
    current_ats_score_original: 50,
    ...overrides,
  };
}

describe('guardRewriteOutput', () => {
  it('removes a job-ad tool the resume never mentions', async () => {
    const planted = resume({
      skills: { technical: ['Go', 'Docker', 'GitHub Actions', 'Kubernetes'], soft: [] },
    });
    const out = await guardRewriteOutput({ rewritten_resume: planted, report: {} }, context());
    const text = JSON.stringify(out.rewritten_resume);
    expect(text).not.toContain('Kubernetes');
    expect(text).toContain('GitHub Actions');
  });

  it('removes an invented percentage', async () => {
    const planted = resume();
    planted.experience[0].achievements = ['Built microservices in Go and Docker, cutting latency by 40%.'];
    const out = await guardRewriteOutput({ rewritten_resume: planted }, context());
    expect(JSON.stringify(out.rewritten_resume)).not.toContain('40%');
  });

  it('keeps a skill the user added in the app after optimizing', async () => {
    const edited = resume({ skills: { technical: ['Go', 'Docker', 'GitHub Actions', 'Kubernetes'], soft: [] } });
    const out = await guardRewriteOutput(
      { rewritten_resume: edited },
      context({ current_resume_json: edited })
    );
    expect(JSON.stringify(out.rewritten_resume)).toContain('Kubernetes');
  });

  it('keeps a fact the user gave as evidence', async () => {
    const planted = resume({ skills: { technical: ['Go', 'Docker', 'GitHub Actions', 'AWS'], soft: [] } });
    const out = await guardRewriteOutput(
      { rewritten_resume: planted },
      context({ evidence_inputs: { cloud: 'I deployed the services to AWS.' } })
    );
    expect(JSON.stringify(out.rewritten_resume)).toContain('AWS');
  });

  it('leaves other output keys untouched and tolerates a missing resume', async () => {
    const out = await guardRewriteOutput({ change_summary: ['x'] }, context());
    expect(out).toEqual({ change_summary: ['x'] });
  });

  it('evidence source joins upload, current resume and evidence answers', () => {
    const src = rewriteEvidenceSource(context({ evidence_inputs: { q: 'Answer text' } }));
    expect(src).toContain('Dana Cohen');
    expect(src).toContain('Answer text');
  });
});

describe('expert prompts', () => {
  it('rewrite no longer lists the job description as evidence', () => {
    const { system, user } = buildRewritePrompt(context());
    expect(system).not.toMatch(/traceable to the current resume, job description/i);
    expect(system).toContain('The job posting is never evidence about the candidate.');
    expect(user).toContain('<current_resume_json>');
    expect(user).toContain('64 (estimate)');
  });

  it('every expert prompt carries the content rules and an estimate-labelled report', () => {
    for (const build of [buildRewritePrompt, buildCoverLetterPrompt, buildATSReportPrompt]) {
      const { system } = build(context());
      expect(system).toContain('# Rules for text the candidate will read or send');
      expect(system).toContain('ats_impact_estimate');
      expect(system).toContain('rough estimates');
    }
  });

  it('cover letter uses no bracket placeholder and follows the language rule', () => {
    const he = buildCoverLetterPrompt(context({ job_description_text: 'דרוש/ה מפתח/ת Backend' }));
    expect(he.system).not.toContain('[Hiring Manager]');
    expect(he.user).toContain('in Hebrew');
    expect(buildCoverLetterPrompt(context()).user).toContain('in English');
  });
});

describe('guard failure', () => {
  it('keeps the validated output and logs a distinct event', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let guard: typeof guardRewriteOutput = guardRewriteOutput;
    jest.isolateModules(() => {
      jest.doMock('@/lib/ai-optimizer/seniority-claims', () => ({
        enforceSeniorityTruth: () => {
          throw new Error('boom');
        },
      }));
      guard = require('@/lib/expert-workflows/rewrite-guard').guardRewriteOutput;
    });
    const planted = resume();
    const out = await guard({ rewritten_resume: planted }, context());
    expect(out.rewritten_resume).toBe(planted);
    expect(spy.mock.calls.some((c) => String(c[0]).includes('expert_rewrite_truth_guard_failed'))).toBe(true);
    spy.mockRestore();
  });
});
