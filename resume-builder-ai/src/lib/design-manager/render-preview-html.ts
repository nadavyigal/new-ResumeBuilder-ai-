import { getSectionHeaders, type SectionHeaderTranslations } from '@/lib/i18n/section-headers';

export type LanguagePreference = 'auto' | 'hebrew' | 'english';
export type RenderMode = 'preview' | 'pdf';

type UnknownRecord = Record<string, unknown>;

interface JsonResumeBasics {
  name: string;
  label: string;
  email: string;
  phone: string;
  website: string;
  summary: string;
  location: {
    address: string;
    postalCode: string;
    city: string;
    countryCode: string;
    region: string;
  };
  profiles: Array<{ network: string; username: string; url: string }>;
}

interface JsonResumeWork {
  name: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  summary: string;
  highlights: string[];
}

interface JsonResumeEducation {
  institution: string;
  area: string;
  studyType: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
  courses: string[];
}

interface JsonResumeSkill {
  name: string;
  level: string;
  keywords: string[];
}

interface JsonResumeProject {
  name: string;
  description: string;
  keywords: string[];
  startDate: string;
  endDate: string;
  url: string;
}

interface JsonResumeCertificate {
  name: string;
  date: string;
  issuer: string;
  url: string;
}

interface JsonResume {
  basics: JsonResumeBasics;
  summary: string;
  work: JsonResumeWork[];
  education: JsonResumeEducation[];
  skills: JsonResumeSkill[];
  projects: JsonResumeProject[];
  certificates: JsonResumeCertificate[];
}

export interface DesignCustomizationLike {
  color_scheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  font_family?: {
    heading?: string;
    body?: string;
  };
  spacing?: {
    section_gap?: string;
    line_height?: string;
  };
  custom_css?: string;
}

function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter(isString);
}

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as UnknownRecord;
}

function getResumeDataObject(resumeData: unknown): UnknownRecord {
  const top = asRecord(resumeData);
  const content = asRecord(top.content);
  return Object.keys(content).length ? content : top;
}

function detectResumeLanguage(resumeData: unknown, languagePreference?: LanguagePreference): 'he' | 'en' {
  if (languagePreference === 'hebrew') return 'he';
  if (languagePreference === 'english') return 'en';

  const data = getResumeDataObject(resumeData);
  const contact = asRecord(data.contact);
  const personalInfo = asRecord(data.personalInfo);
  const experience0 = asRecord(asArray(data.experience)[0]);

  const skillsValue = data.skills;
  const skillsTextParts: string[] = [];
  if (Array.isArray(skillsValue)) {
    skillsTextParts.push(...asStringArray(skillsValue));
  } else {
    const skillsObj = asRecord(skillsValue);
    skillsTextParts.push(...asStringArray(skillsObj.technical), ...asStringArray(skillsObj.soft));
  }

  const fieldsToCheck = [
    asString(contact.name) || asString(personalInfo.fullName),
    asString(data.summary),
    skillsTextParts.join(' '),
    asString(experience0.title) || asString(experience0.position),
    asString(experience0.company),
  ];

  return fieldsToCheck.some((field) => containsHebrew(field)) ? 'he' : 'en';
}

function transformToJsonResume(resumeData: unknown): JsonResume {
  const data = getResumeDataObject(resumeData);
  const contact = asRecord(data.contact);
  const personalInfo = asRecord(data.personalInfo);

  const name = asString(contact.name) || asString(personalInfo.fullName);
  const email = asString(contact.email) || asString(personalInfo.email);
  const phone = asString(contact.phone) || asString(personalInfo.phone);
  const location = asString(contact.location) || asString(personalInfo.location);
  const linkedin = asString(contact.linkedin) || asString(personalInfo.linkedin);
  const portfolio = asString(contact.portfolio) || asString(personalInfo.website);

  const experience = asArray(data.experience);
  const education = asArray(data.education);
  const projects = asArray(data.projects);
  const certifications = asArray(data.certifications);

  const skillsValue = data.skills;
  const skills: JsonResumeSkill[] = [];
  if (Array.isArray(skillsValue)) {
    for (const s of asStringArray(skillsValue)) skills.push({ name: s, level: '', keywords: [] });
  } else {
    const skillsObj = asRecord(skillsValue);
    for (const s of asStringArray(skillsObj.technical)) skills.push({ name: s, level: 'Technical', keywords: [] });
    for (const s of asStringArray(skillsObj.soft)) skills.push({ name: s, level: 'Soft', keywords: [] });
  }

  return {
    basics: {
      name,
      label: asString(personalInfo.title),
      email,
      phone,
      website: portfolio,
      summary: asString(data.summary),
      location: {
        address: '',
        postalCode: '',
        city: location,
        countryCode: '',
        region: '',
      },
      profiles: linkedin
        ? [
            {
              network: 'LinkedIn',
              username: '',
              url: linkedin,
            },
          ]
        : [],
    },
    summary: asString(data.summary),
    work: experience.map((item) => {
      const exp = asRecord(item);
      return {
        name: asString(exp.company),
        position: asString(exp.title) || asString(exp.position),
        location: asString(exp.location),
        startDate: asString(exp.startDate),
        endDate: asString(exp.endDate) || 'Present',
        summary: asString(exp.description),
        highlights: asStringArray(exp.achievements),
      };
    }),
    education: education.map((item) => {
      const edu = asRecord(item);
      return {
        institution: asString(edu.institution),
        area: asString(edu.degree) || asString(edu.field),
        studyType: asString(edu.degree) || asString(edu.field),
        location: asString(edu.location),
        startDate: '',
        endDate: asString(edu.graduationDate) || asString(edu.endDate),
        gpa: asString(edu.gpa),
        courses: [],
      };
    }),
    skills,
    projects: projects.map((item) => {
      const project = asRecord(item);
      return {
        name: asString(project.name),
        description: asString(project.description),
        keywords: asStringArray(project.technologies),
        startDate: '',
        endDate: '',
        url: '',
      };
    }),
    certificates: certifications.map((cert) => {
      if (typeof cert === 'string') return { name: cert, date: '', issuer: '', url: '' };
      const c = asRecord(cert);
      return {
        name: asString(c.name),
        date: asString(c.date),
        issuer: asString(c.issuer),
        url: asString(c.url),
      };
    }),
  };
}

function selectPalette(templateId: string) {
  if (templateId.includes('sidebar')) {
    return { primary: '#0f172a', accent: '#10b981', muted: '#e2e8f0', bg: '#ffffff', text: '#0f172a' };
  }
  if (templateId.includes('card') || templateId.includes('modern')) {
    return { primary: '#1d4ed8', accent: '#22c55e', muted: '#eef2ff', bg: '#ffffff', text: '#0f172a' };
  }
  if (templateId.includes('timeline') || templateId.includes('creative')) {
    return { primary: '#7c3aed', accent: '#f59e0b', muted: '#f3e8ff', bg: '#ffffff', text: '#0f172a' };
  }
  return { primary: '#0f172a', accent: '#2563eb', muted: '#e5e7eb', bg: '#ffffff', text: '#0f172a' };
}

function applyCustomization(templatePalette: ReturnType<typeof selectPalette>, customization?: DesignCustomizationLike) {
  const colors = customization?.color_scheme;
  const fonts = customization?.font_family;
  const spacing = customization?.spacing;

  return {
    palette: {
      ...templatePalette,
      primary: colors?.primary || templatePalette.primary,
      accent: colors?.accent || templatePalette.accent,
      bg: colors?.background || templatePalette.bg,
      text: colors?.text || templatePalette.text,
      muted: templatePalette.muted,
      secondary: colors?.secondary || '#475569',
    },
    fonts: {
      heading: fonts?.heading || 'Inter',
      body: fonts?.body || 'Inter',
    },
    spacing: {
      sectionGap: spacing?.section_gap || null,
      lineHeight: spacing?.line_height || null,
    },
    customCss: customization?.custom_css || '',
  };
}

function renderHtml(
  templateId: string,
  resume: JsonResume,
  headers: SectionHeaderTranslations,
  mode: RenderMode,
  direction: "ltr" | "rtl",
  language: "en" | "he",
  customization?: DesignCustomizationLike
): string {
  const { palette, fonts, spacing, customCss } = applyCustomization(selectPalette(templateId), customization);
  const nameParts = (resume.basics.name || '').split(' ');
  const initials = nameParts
    .slice(0, 2)
    .map((n) => n[0] || '')
    .join('')
    .toUpperCase() || 'JD';

  const workHtml = resume.work
    .map(
      (job) => `
    <div class="job">
      <div class="job-title">${job.position || ''}</div>
      <div class="job-meta">${job.name || ''}${job.location ? ` — ${job.location}` : ''}</div>
      <div class="job-dates">${job.startDate || ''}${job.endDate ? ` — ${job.endDate}` : ''}</div>
      ${
        Array.isArray(job.highlights) && job.highlights.length
          ? `
        <ul>
          ${job.highlights.map((h) => `<li>${h}</li>`).join('')}
        </ul>
      `
          : ''
      }
    </div>
  `
    )
    .join('');

  const educationHtml = resume.education
    .map(
      (edu) => `
    <div class="edu">
      <div class="edu-title">${edu.studyType || edu.area || ''}</div>
      <div class="edu-meta">${edu.institution || ''}${edu.endDate ? ` — ${edu.endDate}` : ''}</div>
      <div class="edu-meta">${edu.location || ''}</div>
    </div>
  `
    )
    .join('');

  const skillsHtml = resume.skills.map((skill) => `<span class="pill">${skill.name}</span>`).join('');
  const contact = resume.basics;

  const layout = templateId.includes('sidebar')
    ? `
      <div class="grid">
        <aside class="sidebar">
          <div class="avatar">${initials}</div>
          <div class="contact-block">
            <div class="name">${contact.name || 'John Doe'}</div>
            <div class="title">${contact.label || 'Software Engineer'}</div>
          </div>
          <div class="meta">
            ${contact.location.city || ''}
          </div>
          <div class="meta">${contact.email || ''}</div>
          <div class="meta">${contact.phone || ''}</div>
          <div class="meta">${contact.website || ''}</div>
          ${(contact.profiles || []).map((p) => `<div class="meta">${p.url || ''}</div>`).join('')}
          <div class="sidebar-section">
            <h3>${headers.skills}</h3>
            <div class="pills">${skillsHtml}</div>
          </div>
        </aside>
        <main class="content">
          ${
            resume.summary
              ? `
            <section>
              <h2>${headers.professionalSummary}</h2>
              <p class="summary">${resume.summary}</p>
            </section>
          `
              : ''
          }
          ${
            resume.work.length
              ? `
            <section>
              <h2>${headers.experience}</h2>
              ${workHtml}
            </section>
          `
              : ''
          }
          ${
            resume.education.length
              ? `
            <section>
              <h2>${headers.education}</h2>
              ${educationHtml}
            </section>
          `
              : ''
          }
        </main>
      </div>
    `
    : `
      <header class="header">
        <div class="avatar">${initials}</div>
        <div>
          <div class="name">${contact.name || 'John Doe'}</div>
          <div class="title">${contact.label || 'Software Engineer'}</div>
          <div class="meta-row">
            ${contact.location.city || ''}${contact.email ? ` • ${contact.email}` : ''}${contact.phone ? ` • ${contact.phone}` : ''}${
              contact.website ? ` • ${contact.website}` : ''
            }
          </div>
        </div>
      </header>
      ${
        resume.summary
          ? `
        <section>
          <h2>${headers.professionalSummary}</h2>
          <p class="summary">${resume.summary}</p>
        </section>
      `
          : ''
      }
      ${
        resume.skills.length
          ? `
        <section>
          <h2>${headers.skills}</h2>
          <div class="pills">${skillsHtml}</div>
        </section>
      `
          : ''
      }
      ${
        resume.work.length
          ? `
        <section>
          <h2>${headers.experience}</h2>
          ${workHtml}
        </section>
      `
          : ''
      }
      ${
        resume.education.length
          ? `
        <section>
          <h2>${headers.education}</h2>
          ${educationHtml}
        </section>
      `
          : ''
      }
    `;

  const isPdf = mode === 'pdf';
  const bodyBg = isPdf ? palette.bg : '#f3f4f6';
  const pagePadding = isPdf ? '0.6in' : '28px';
  const pageBorderRadius = isPdf ? '0' : '20px';
  const pageShadow = isPdf ? 'none' : '0 12px 36px rgba(15,23,42,0.08)';
  const pageBorder = isPdf ? 'none' : '1px solid rgba(15,23,42,0.05)';
  const pageMaxWidth = isPdf ? '8.5in' : '900px';

  return `<!DOCTYPE html>
<html lang="${language}" dir="${direction}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resume</title>
  <style>
    ${isPdf ? '@page { size: letter; margin: 0; }' : ''}
    * { box-sizing: border-box; }
    body {
      margin:0;
      padding:${isPdf ? '0' : '24px'};
      background:${bodyBg};
      font-family: ${fonts.body}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      direction: ${direction};
      text-align: ${direction === "rtl" ? "right" : "left"};
      color: ${palette.text};
      ${spacing.lineHeight ? `line-height: ${spacing.lineHeight};` : ''}
    }
    p,
    li,
    .summary,
    .job-title,
    .job-meta,
    .job-dates,
    .edu-title,
    .edu-meta,
    .name,
    .title,
    .meta,
    .meta-row {
      unicode-bidi: plaintext;
    }
    .page {
      max-width: ${pageMaxWidth};
      margin: 0 auto;
      background: ${palette.bg};
      border-radius: ${pageBorderRadius};
      box-shadow: ${pageShadow};
      border: ${pageBorder};
      padding: ${pagePadding};
      color: ${palette.text};
    }
    h1,h2,h3 { margin: 0; padding: 0; }
    h2 { font-size: 16px; color: ${palette.primary}; margin-bottom: 10px; display:flex; align-items:center; gap:8px; font-family: ${fonts.heading}, sans-serif; }
    h2::before { content:''; width:10px; height:10px; border-radius:50%; background:${palette.accent}; box-shadow:0 0 0 4px rgba(34,197,94,0.18); }
    .header { display:flex; gap:14px; align-items:center; padding-bottom:14px; border-bottom:1px solid rgba(15,23,42,0.08); margin-bottom:14px; }
    .name { font-size: 22px; font-weight: 800; color: ${palette.primary}; letter-spacing: -0.01em; font-family: ${fonts.heading}, sans-serif; }
    .title { font-size: 13px; font-weight: 600; color: ${palette.secondary}; margin-top:2px; }
    .meta-row { font-size: 11px; color:${palette.secondary}; margin-top:6px; line-height:1.5; }
    .avatar { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, ${palette.primary}, ${palette.accent}); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px; box-shadow:0 8px 18px rgba(15,23,42,0.15); }
    section { margin-bottom: ${spacing.sectionGap || '16px'}; }
    .summary { font-size: 13px; line-height: 1.65; color: ${palette.text}; }
    .pills { display:flex; flex-wrap:wrap; gap:6px; }
    .pill { background: ${palette.muted}; color:${palette.primary}; padding:6px 10px; border-radius: 999px; font-size: 11px; font-weight:600; }
    .job { padding:10px 12px; border:1px solid rgba(15,23,42,0.06); border-radius:12px; margin-bottom:10px; background: linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.01)); }
    .job-title { font-weight: 700; font-size: 13px; color:${palette.primary}; }
    .job-meta { font-size: 11.5px; color:${palette.secondary}; margin:4px 0; }
    .job-dates { font-size: 11px; color:${palette.accent}; font-weight:700; }
    ul { margin:6px ${direction === "rtl" ? "16px" : "0"} 0 ${direction === "rtl" ? "0" : "16px"}; color:${palette.text}; font-size:12px; line-height:1.55; }
    li { margin-bottom:5px; }
    .edu { padding:8px 0; border-bottom:1px solid rgba(15,23,42,0.05); }
    .edu:last-child { border-bottom:none; }
    .edu-title { font-weight:700; font-size:12.5px; color:${palette.primary}; }
    .edu-meta { font-size:11.5px; color:${palette.secondary}; }
    .grid { display:grid; grid-template-columns: 32% 68%; gap:14px; }
    .sidebar { background: linear-gradient(180deg, ${palette.primary}, #111827); color:#e2e8f0; border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:10px; }
    .sidebar h3 { font-size:12px; margin:0 0 6px 0; color:${palette.accent}; font-family: ${fonts.heading}, sans-serif; }
    .sidebar .pill { background: rgba(255,255,255,0.08); color:#e2e8f0; }
    .sidebar .meta { font-size:11px; opacity:0.9; }
    .contact-block .name { color:#f8fafc; }
    .contact-block .title { color:#cbd5e1; }
    .content { padding:4px; }
    ${customCss || ''}
    @media (max-width: 720px) {
      body { padding:12px; }
      .page { padding:18px; }
      .grid { grid-template-columns: 1fr; }
      .sidebar { flex-direction: row; flex-wrap: wrap; gap:10px; align-items:center; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${layout}
  </div>
</body>
</html>`;
}

export function renderDesignPreviewHtml(params: {
  templateId: string;
  resumeData: unknown;
  customization?: DesignCustomizationLike;
  languagePreference?: LanguagePreference;
  mode?: RenderMode;
}): string {
  const { templateId, resumeData, customization, languagePreference, mode = 'preview' } = params;
  const jsonResume = transformToJsonResume(resumeData);
  const detectedLanguage = detectResumeLanguage(resumeData, languagePreference);
  const sectionHeaders = getSectionHeaders(detectedLanguage);
  const direction = detectedLanguage === "he" ? "rtl" : "ltr";
  return renderHtml(templateId, jsonResume, sectionHeaders, mode, direction, detectedLanguage, customization);
}

