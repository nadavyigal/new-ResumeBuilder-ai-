import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { UnsupportedCategory } from './grounding';
import { manifest, type ManifestCase } from './manifest';

/**
 * Planted failures (Phase 1, 2026-10-16): optimizer outputs with one deliberate
 * fabrication each, the three kinds the portfolio review asked to pin, in English and
 * Hebrew. `planted.test.ts` feeds each one to the real pipeline as the model's answer
 * and checks what ships with the same grounding checks the repeat eval uses. The raw
 * output must fail those checks; what the pipeline ships must pass them. If a guard is
 * taken out of `runOptimizePipeline`, its two cases fail.
 *
 * Sources are manifest cases, so the résumé text is the eval's own, not a new fixture.
 */

export type PlantedKind = 'seniority' | 'tool' | 'metric';

export interface PlantedFailure {
  id: string;
  kind: PlantedKind;
  language: 'en' | 'he';
  caseId: string;
  /** The production guard expected to remove it. */
  guard: 'enforceSeniorityTruth' | 'enforceJobAdTruth' | 'stripFabricatedMetrics';
  /** The grounding category the raw output must be flagged under. */
  category: UnsupportedCategory;
  /** The planted text, which must not appear anywhere in what the pipeline ships. */
  planted: string;
  resume: OptimizedResume;
}

export function plantedCase(id: string): ManifestCase {
  const c = manifest.find((m) => m.id === id);
  if (!c) throw new Error(`planted: manifest case "${id}" not found`);
  return c;
}

const priya = (title: string, summary: string, oakridgeBullet: string): OptimizedResume => ({
  summary,
  contact: { name: 'Priya Raman', email: 'priya.raman@example.com', phone: '555-0117', location: 'Raleigh, NC' },
  skills: { technical: ['Java', 'Payment services'], soft: ['Mentoring'] },
  experience: [
    {
      title,
      company: 'Triangle Payments',
      location: 'Raleigh, NC',
      startDate: 'May 2022',
      endDate: 'Present',
      achievements: [
        'Led the design of a refund service handling 30,000 requests a day.',
        'Mentored 2 summer interns.',
        'Ran sprint planning for a 5-person team while the manager was on leave for 3 months.',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'Oakridge Bank',
      location: 'Raleigh, NC',
      startDate: 'Jun 2021',
      endDate: 'Apr 2022',
      achievements: [oakridgeBullet],
    },
  ],
  education: [{ degree: 'BS Computer Engineering', institution: 'NC State University', location: 'Raleigh, NC', graduationDate: '2021' }],
  certifications: [],
  matchScore: 70,
  keyImprovements: [],
  missingKeywords: [],
});

const daniel = (skills: string[], cycleBullet: string): OptimizedResume => ({
  summary: 'SaaS account executive with 5 years of mid-market sales experience.',
  contact: { name: 'Daniel Brooks', email: 'daniel.brooks@example.com', phone: '555-0114', location: 'Atlanta, GA' },
  skills: { technical: skills, soft: [] },
  experience: [
    {
      title: 'Account Executive',
      company: 'Peachtree Software',
      location: 'Atlanta, GA',
      startDate: 'Apr 2021',
      endDate: 'Present',
      achievements: [
        'Closed $1.2M in new annual recurring revenue in 2025.',
        'Reached 118% of annual quota in 2024 and 2025.',
        cycleBullet,
      ],
    },
    {
      title: 'Sales Development Representative',
      company: 'Northwind CRM',
      location: 'Atlanta, GA',
      startDate: 'Jan 2020',
      endDate: 'Mar 2021',
      achievements: ['Booked qualified meetings for three account executives.'],
    },
  ],
  education: [{ degree: 'BBA Marketing', institution: 'Georgia State University', location: 'Atlanta, GA', graduationDate: '2019' }],
  certifications: [],
  matchScore: 80,
  keyImprovements: [],
  missingKeywords: [],
});

const itai = (title: string, summary: string, skills: string[], warehouseBullet: string): OptimizedResume => ({
  summary,
  contact: { name: 'איתי ברק', email: 'itai.barak@example.com', phone: '050-0000003', location: 'באר שבע' },
  skills: { technical: skills, soft: [] },
  experience: [
    {
      title,
      company: 'צבא ההגנה לישראל (צה"ל)',
      location: '',
      startDate: 'אוגוסט 2019',
      endDate: 'יולי 2024',
      achievements: [warehouseBullet, 'פיקוד על צוות של 9 חיילים.', 'הובלת מעבר ממעקב ידני לגיליונות Excel משותפים.'],
    },
    {
      title: 'רכז תפעול',
      company: 'מרכז הפצה נגב',
      location: '',
      startDate: 'ספטמבר 2024',
      endDate: 'היום',
      achievements: ['תיאום משמרות וקליטת סחורה במרכז הפצה אזורי.'],
    },
  ],
  education: [{ degree: 'תואר ראשון בכלכלה וניהול', institution: 'האוניברסיטה הפתוחה', location: '', graduationDate: '2023' }],
  certifications: [],
  matchScore: 60,
  keyImprovements: [],
  missingKeywords: [],
});

const ITAI_SUMMARY = 'קצין לוגיסטיקה לשעבר עם 5 שנות ניסיון בניהול שרשרת אספקה בצבא.';
const ITAI_WAREHOUSE = 'ניהול מחסן ציוד של 1,200 פריטים ותכנון הפצה ל-14 יחידות.';

const michal = (campaignBullet: string): OptimizedResume => ({
  summary: 'רכזת שיווק דיגיטלי עם 3 שנות ניסיון בניהול קמפיינים ברשתות חברתיות.',
  contact: { name: 'מיכל אברהם', email: 'michal.avraham@example.com', phone: '050-0000004', location: 'ירושלים' },
  skills: { technical: ['פייסבוק', 'אינסטגרם'], soft: [] },
  experience: [
    {
      title: 'רכזת שיווק דיגיטלי',
      company: 'סטודיו אורן',
      location: 'ירושלים',
      startDate: 'יוני 2023',
      endDate: 'היום',
      achievements: [campaignBullet, 'כתיבת תוכן לניוזלטר החודשי.', 'תיאום עם מעצבים על קריאייטיב לקמפיינים.'],
    },
  ],
  education: [{ degree: 'תואר ראשון בתקשורת', institution: 'המכללה האקדמית ספיר', location: '', graduationDate: '2023' }],
  certifications: [],
  matchScore: 55,
  keyImprovements: [],
  missingKeywords: [],
});

const PRIYA_SUMMARY = 'Software engineer with 5 years of experience building payment services in Java.';
const PRIYA_OAKRIDGE = 'Maintained Java batch jobs for account statements.';

export const planted: PlantedFailure[] = [
  {
    id: 'planted-en-seniority',
    kind: 'seniority',
    language: 'en',
    caseId: 'unsupported-seniority-eng-manager',
    guard: 'enforceSeniorityTruth',
    category: 'seniority-title',
    planted: 'Engineering Manager',
    resume: priya('Engineering Manager', 'Engineering Manager with 5 years of experience building payment services in Java.', PRIYA_OAKRIDGE),
  },
  {
    id: 'planted-en-tool',
    kind: 'tool',
    language: 'en',
    caseId: 'fit-saas-account-exec',
    guard: 'enforceJobAdTruth',
    category: 'forbidden-claim',
    planted: 'Salesforce',
    resume: daniel(
      ['Full-cycle sales', 'Salesforce'],
      'Ran full-cycle sales from discovery to contract for 40 to 60 active opportunities in Salesforce.'
    ),
  },
  {
    id: 'planted-en-metric',
    kind: 'metric',
    language: 'en',
    caseId: 'unsupported-seniority-eng-manager',
    guard: 'stripFabricatedMetrics',
    category: 'metric',
    planted: '40%',
    resume: priya('Software Engineer II', PRIYA_SUMMARY, 'Maintained Java batch jobs for account statements, cutting run time by 40%.'),
  },
  {
    id: 'planted-he-seniority',
    kind: 'seniority',
    language: 'he',
    caseId: 'he-career-change-army-to-ops',
    guard: 'enforceSeniorityTruth',
    category: 'seniority-title',
    planted: 'מנהל',
    resume: itai('מנהל לוגיסטיקה', 'מנהל תפעול עם 5 שנות ניסיון בניהול שרשרת אספקה בצבא.', ['Excel'], ITAI_WAREHOUSE),
  },
  {
    id: 'planted-he-tool',
    kind: 'tool',
    language: 'he',
    caseId: 'he-career-change-army-to-ops',
    guard: 'enforceJobAdTruth',
    category: 'forbidden-claim',
    planted: 'SAP',
    resume: itai('קצין לוגיסטיקה', ITAI_SUMMARY, ['Excel', 'SAP'], 'ניהול מחסן ציוד של 1,200 פריטים ב-SAP ותכנון הפצה ל-14 יחידות.'),
  },
  {
    id: 'planted-he-metric',
    kind: 'metric',
    language: 'he',
    caseId: 'he-unquantified-marketing',
    guard: 'stripFabricatedMetrics',
    category: 'metric',
    planted: '35%',
    resume: michal('ניהול קמפיינים ממומנים בפייסבוק ובאינסטגרם, שהעלו את ההמרות ב-35%.'),
  },
];
