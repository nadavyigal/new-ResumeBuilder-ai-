/**
 * API Route: Render Template Preview
 * Server-side rendering endpoint for external templates
 *
 * POST /api/v1/design/render-preview
 * Body: { templateId: string, resumeData: ResumeData, customization?: any }
 * Returns: HTML string
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSectionHeaders } from '@/lib/i18n/section-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResumeData {
  personalInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
    title?: string;
  };
  summary?: string;
  experience?: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    description?: string;
    achievements?: string[];
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    graduationDate: string;
    gpa?: string;
  }>;
    skills?: string[];
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
  }>;
}

/**
 * Detect if text contains Hebrew characters
 */
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Detect language from resume data
 */
function detectResumeLanguage(resumeData: any, languagePreference?: string): 'he' | 'en' {
  // Handle explicit preference
  if (languagePreference === 'hebrew') return 'he';
  if (languagePreference === 'english') return 'en';

  // Auto-detect from content
  const data = resumeData.content || resumeData;
  const fieldsToCheck = [
    data.contact?.name || data.personalInfo?.fullName || '',
    data.summary || '',
    (data.skills?.technical || []).join(' '),
    (data.skills?.soft || []).join(' '),
    data.experience?.[0]?.title || '',
    data.experience?.[0]?.company || '',
  ];

  const isHebrew = fieldsToCheck.some(field => containsHebrew(field));
  return isHebrew ? 'he' : 'en';
}

/**
 * Transforms internal resume format to JSON Resume schema
 */
function transformToJsonResume(resumeData: any): any {
  const data = resumeData.content || resumeData;

  // Support both OptimizedResume format (contact.name) and legacy format (personalInfo.fullName)
  const name = data.contact?.name || data.personalInfo?.fullName || '';
  const email = data.contact?.email || data.personalInfo?.email || '';
  const phone = data.contact?.phone || data.personalInfo?.phone || '';
  const location = data.contact?.location || data.personalInfo?.location || '';
  const linkedin = data.contact?.linkedin || data.personalInfo?.linkedin || '';
  const portfolio = data.contact?.portfolio || data.personalInfo?.website || '';

  return {
    basics: {
      name: name,
      label: data.personalInfo?.title || '',
      email: email,
      phone: phone,
      website: portfolio,
      summary: data.summary || '',
      location: {
        address: '',
        postalCode: '',
        city: location,
        countryCode: '',
        region: ''
      },
      profiles: linkedin
        ? [
            {
              network: 'LinkedIn',
              username: '',
              url: linkedin
            }
          ]
        : []
    },
    summary: data.summary || '',
    work: (data.experience || []).map((exp: any) => ({
      name: exp.company || '',
      position: exp.title || exp.position || '',
      location: exp.location || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || 'Present',
      summary: exp.description || '',
      highlights: exp.achievements || []
    })),
    education: (data.education || []).map((edu: any) => ({
      institution: edu.institution || '',
      area: edu.degree || edu.field || '',
      studyType: edu.degree || edu.field || '',
      location: edu.location || '',
      startDate: '',
      endDate: edu.graduationDate || edu.endDate || '',
      gpa: edu.gpa || '',
      courses: []
    })),
    skills: [
      ...(data.skills?.technical || []).map((skill: string) => ({
        name: skill,
        level: 'Technical',
        keywords: []
      })),
      ...(data.skills?.soft || []).map((skill: string) => ({
        name: skill,
        level: 'Soft',
        keywords: []
      }))
    ],
    projects: (data.projects || []).map((project: any) => ({
      name: project.name || '',
      description: project.description || '',
      keywords: project.technologies || [],
      startDate: '',
      endDate: '',
      url: ''
    })),
    certificates: (data.certifications || []).map((cert: any) =>
      typeof cert === 'string'
        ? { name: cert, date: '', issuer: '', url: '' }
        : { name: cert.name || '', date: cert.date || '', issuer: cert.issuer || '', url: '' }
    )
  };
}

function selectPalette(templateId: string) {
  if (templateId.includes('sidebar')) {
    return { primary: '#0f172a', accent: '#10b981', muted: '#e2e8f0', bg: '#ffffff' };
  }
  if (templateId.includes('card') || templateId.includes('modern')) {
    return { primary: '#1d4ed8', accent: '#22c55e', muted: '#eef2ff', bg: '#ffffff' };
  }
  if (templateId.includes('timeline') || templateId.includes('creative')) {
    return { primary: '#7c3aed', accent: '#f59e0b', muted: '#f3e8ff', bg: '#ffffff' };
  }
  return { primary: '#0f172a', accent: '#2563eb', muted: '#e5e7eb', bg: '#ffffff' };
}

function renderHtml(templateId: string, resume: any, headers: any) {
  const palette = selectPalette(templateId);
  const nameParts = (resume.basics?.name || '').split(' ');
  const initials = nameParts.slice(0, 2).map((n: string) => n[0] || '').join('').toUpperCase() || 'JD';

  const workHtml = (resume.work || []).map((job: any) => `
    <div class="job">
      <div class="job-title">${job.position || ''}</div>
      <div class="job-meta">${job.name || ''}${job.location ? ` — ${job.location}` : ''}</div>
      <div class="job-dates">${job.startDate || ''}${job.endDate ? ` — ${job.endDate}` : ''}</div>
      ${Array.isArray(job.highlights) && job.highlights.length ? `
        <ul>
          ${job.highlights.map((h: string) => `<li>${h}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');

  const educationHtml = (resume.education || []).map((edu: any) => `
    <div class="edu">
      <div class="edu-title">${edu.studyType || edu.area || ''}</div>
      <div class="edu-meta">${edu.institution || ''}${edu.endDate ? ` — ${edu.endDate}` : ''}</div>
      <div class="edu-meta">${edu.location || ''}</div>
    </div>
  `).join('');

  const skillsHtml = (resume.skills || []).map((skill: any) => `
    <span class="pill">${skill.name}</span>
  `).join('');

  const contact = resume.basics || {};

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
            ${contact.location?.city || ''}
          </div>
          <div class="meta">${contact.email || ''}</div>
          <div class="meta">${contact.phone || ''}</div>
          <div class="meta">${contact.website || ''}</div>
          ${(contact.profiles || []).map((p: any) => `<div class="meta">${p.url || ''}</div>`).join('')}
          <div class="sidebar-section">
            <h3>${headers.skills}</h3>
            <div class="pills">${skillsHtml}</div>
          </div>
        </aside>
        <main class="content">
          ${resume.summary ? `
            <section>
              <h2>${headers.professionalSummary}</h2>
              <p class="summary">${resume.summary}</p>
            </section>
          ` : ''}
          ${(resume.work || []).length ? `
            <section>
              <h2>${headers.experience}</h2>
              ${workHtml}
            </section>
          ` : ''}
          ${(resume.education || []).length ? `
            <section>
              <h2>${headers.education}</h2>
              ${educationHtml}
            </section>
          ` : ''}
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
            ${contact.location?.city || ''}${contact.email ? ` • ${contact.email}` : ''}${contact.phone ? ` • ${contact.phone}` : ''}${contact.website ? ` • ${contact.website}` : ''}
          </div>
        </div>
      </header>
      ${resume.summary ? `
        <section>
          <h2>${headers.professionalSummary}</h2>
          <p class="summary">${resume.summary}</p>
        </section>
      ` : ''}
      ${(resume.skills || []).length ? `
        <section>
          <h2>${headers.skills}</h2>
          <div class="pills">${skillsHtml}</div>
        </section>
      ` : ''}
      ${(resume.work || []).length ? `
        <section>
          <h2>${headers.experience}</h2>
          ${workHtml}
        </section>
      ` : ''}
      ${(resume.education || []).length ? `
        <section>
          <h2>${headers.education}</h2>
          ${educationHtml}
        </section>
      ` : ''}
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resume Preview</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; padding:24px; background:#f3f4f6; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .page {
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 12px 36px rgba(15,23,42,0.08);
      border: 1px solid rgba(15,23,42,0.05);
      padding: 28px;
      color: #0f172a;
    }
    h1,h2,h3 { margin: 0; padding: 0; }
    h2 { font-size: 16px; color: ${palette.primary}; margin-bottom: 10px; display:flex; align-items:center; gap:8px; }
    h2::before { content:''; width:10px; height:10px; border-radius:50%; background:${palette.accent}; box-shadow:0 0 0 4px rgba(34,197,94,0.18); }
    .header { display:flex; gap:14px; align-items:center; padding-bottom:14px; border-bottom:1px solid rgba(15,23,42,0.08); margin-bottom:14px; }
    .name { font-size: 22px; font-weight: 800; color: ${palette.primary}; letter-spacing: -0.01em; }
    .title { font-size: 13px; font-weight: 600; color: #475569; margin-top:2px; }
    .meta-row { font-size: 11px; color:#475569; margin-top:6px; line-height:1.5; }
    .avatar { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, ${palette.primary}, ${palette.accent}); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px; box-shadow:0 8px 18px rgba(15,23,42,0.15); }
    section { margin-bottom: 16px; }
    .summary { font-size: 13px; line-height: 1.65; color: #1f2937; }
    .pills { display:flex; flex-wrap:wrap; gap:6px; }
    .pill { background: ${palette.muted}; color:${palette.primary}; padding:6px 10px; border-radius: 999px; font-size: 11px; font-weight:600; }
    .job { padding:10px 12px; border:1px solid rgba(15,23,42,0.06); border-radius:12px; margin-bottom:10px; background: linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.01)); }
    .job-title { font-weight: 700; font-size: 13px; color:${palette.primary}; }
    .job-meta { font-size: 11.5px; color:#475569; margin:4px 0; }
    .job-dates { font-size: 11px; color:${palette.accent}; font-weight:700; }
    ul { margin:6px 0 0 16px; color:#1f2937; font-size:12px; line-height:1.55; }
    li { margin-bottom:5px; }
    .edu { padding:8px 0; border-bottom:1px solid rgba(15,23,42,0.05); }
    .edu:last-child { border-bottom:none; }
    .edu-title { font-weight:700; font-size:12.5px; color:${palette.primary}; }
    .edu-meta { font-size:11.5px; color:#475569; }
    .grid { display:grid; grid-template-columns: 32% 68%; gap:14px; }
    .sidebar { background: linear-gradient(180deg, ${palette.primary}, #111827); color:#e2e8f0; border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:10px; }
    .sidebar h3 { font-size:12px; margin:0 0 6px 0; color:${palette.accent}; }
    .sidebar .pill { background: rgba(255,255,255,0.08); color:#e2e8f0; }
    .sidebar .meta { font-size:11px; opacity:0.9; }
    .contact-block .name { color:#f8fafc; }
    .contact-block .title { color:#cbd5e1; }
    .content { padding:4px; }
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, resumeData, languagePreference } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    if (!resumeData) {
      return NextResponse.json(
        { error: 'Resume data is required' },
        { status: 400 }
      );
    }

    const jsonResume = transformToJsonResume(resumeData);
    const detectedLanguage = detectResumeLanguage(resumeData, languagePreference);
    const sectionHeaders = getSectionHeaders(detectedLanguage);

    const html = renderHtml(templateId, jsonResume, sectionHeaders);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Error rendering template preview:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview Error</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 40px;
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { color: #dc2626; }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Template Preview Error</h1>
  <p>Failed to render template preview.</p>
  <p><strong>Error:</strong> <code>${errorMessage}</code></p>
  <p>Please try again or select a different template.</p>
</body>
</html>`;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}
