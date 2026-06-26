import { describe, it, expect } from '@jest/globals';
import { cases } from './cases';
import { runChecks, criticalFailures } from './checks';
import type { OptimizedResume } from '@/lib/ai-optimizer';

/**
 * Offline tests (no API): prove the fabrication-detection logic actually
 * catches fabrication, and that a clean/honest resume passes. Runs free.
 */

const honestCase = cases[0]; // 'no-cloud-cert' — knownEntities: Acme Retail Co / UT Austin

function honestResume(): OptimizedResume {
  return {
    summary: 'Backend engineer with experience in Python and Django.',
    contact: { name: 'Jane Doe', email: 'jane.doe@example.com', phone: '555-0100', location: 'Austin, TX' },
    skills: { technical: ['Python', 'Django', 'REST APIs'], soft: ['Communication'] },
    experience: [
      {
        title: 'Software Engineer',
        company: 'Acme Retail Co',
        location: 'Austin, TX',
        startDate: 'Jan 2021',
        endDate: 'Present',
        achievements: ['Built and maintained internal order-management REST APIs in Django.'],
      },
    ],
    education: [
      { degree: 'BS Computer Science', institution: 'University of Texas at Austin', location: 'Austin, TX', graduationDate: '2020' },
    ],
    certifications: [],
    matchScore: 55,
    keyImprovements: ['Clarified API ownership'],
    missingKeywords: ['AWS', 'Kubernetes'],
  };
}

describe('resume-optimizer deterministic checks (offline)', () => {
  it('an honest resume with no fabricated entities passes all critical checks', () => {
    const failures = criticalFailures(runChecks(honestResume(), honestCase));
    expect(failures.map((f) => `${f.id}: ${f.detail}`)).toEqual([]);
  });

  it('catches a fabricated employer name', () => {
    const resume = honestResume();
    resume.experience[0].company = 'Amazon Web Services'; // not in original resume text
    const result = runChecks(resume, honestCase).find((r) => r.id === 'no-new-employers');
    expect(result?.pass).toBe(false);
  });

  it('catches a fabricated institution', () => {
    const resume = honestResume();
    resume.education[0].institution = 'Stanford University'; // not in original resume text
    const result = runChecks(resume, honestCase).find((r) => r.id === 'no-new-institutions');
    expect(result?.pass).toBe(false);
  });

  it('catches a fabricated certification (the core fabrication trap)', () => {
    const resume = honestResume();
    resume.certifications = ['AWS Certified Solutions Architect']; // the JD's exact ask, not in original
    const result = runChecks(resume, honestCase).find((r) => r.id === 'no-new-certifications');
    expect(result?.pass).toBe(false);
  });

  it('flags an out-of-range matchScore', () => {
    const resume = honestResume();
    resume.matchScore = 150;
    const result = runChecks(resume, honestCase).find((r) => r.id === 'matchscore-in-range');
    expect(result?.pass).toBe(false);
  });

  it('every golden case has the entities it claims to know about', () => {
    for (const c of cases) {
      for (const employer of c.knownEntities.employers) {
        if (!c.resumeText.includes(employer)) throw new Error(`${c.id}: missing employer "${employer}" in resumeText`);
      }
      for (const institution of c.knownEntities.institutions) {
        if (!c.resumeText.includes(institution)) throw new Error(`${c.id}: missing institution "${institution}" in resumeText`);
      }
    }
  });
});
