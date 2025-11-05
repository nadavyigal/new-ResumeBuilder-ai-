import { describe, it, expect } from '@jest/globals';
import { ATS } from '@/lib/agent/tools/ats';

const baseResume = {
  summary: 'Full-stack engineer experienced with React and cloud systems.',
  contact: { name: 'Alex', email: 'alex@example.com', phone: '', location: '' },
  skills: { technical: ['React', 'TypeScript', 'Node.js'], soft: ['Collaboration'] },
  experience: [
    {
      title: 'Engineer',
      company: 'Acme',
      location: '',
      startDate: '',
      endDate: '',
      achievements: ['Built multilingual UI with RTL support'],
    },
  ],
  education: [],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
};

const hebrewResume = {
  ...baseResume,
  summary: 'מפתח תוכנה עם ניסיון ב-React ותמיכה בעברית.',
  experience: [
    {
      title: 'מפתח',
      company: 'סטארטאפ',
      location: '',
      startDate: '',
      endDate: '',
      achievements: ['ניהול צוות פיתוח', 'הטמעת מערכות CI/CD'],
    },
  ],
};

describe('ATS language-aware scoring', () => {
  it('produces English language breakdown with subscores', async () => {
    const jobText = 'We need a React engineer who can manage cloud systems and collaborate.';
    const report = await ATS.score({ resume_json: baseResume as any, job_text: jobText });
    expect(report.languages.en).toBeDefined();
    expect(report.languages.en?.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.languages.en?.gaps)).toBe(true);
    expect(report.languages.en?.rtl).toBe(false);
  });

  it('detects RTL language gaps alongside English tokens', async () => {
    const jobText = 'דרוש מפתח תוכנה עם ניסיון בענן וידע ב-React.';
    const report = await ATS.score({ resume_json: hebrewResume as any, job_text: jobText });
    expect(report.languages.he).toBeDefined();
    expect(report.languages.he?.rtl).toBe(true);
    expect(report.languages.he?.gaps?.some(token => token.includes('ענן'))).toBe(true);
    expect(report.languages.en).toBeDefined();
  });
});

