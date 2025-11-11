import React from 'react';

/**
 * Detect if resume content is primarily Hebrew
 */
function detectLanguage(data) {
  const text = JSON.stringify(data);
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text) ? 'he' : 'en';
}

/**
 * Build custom CSS from user customizations
 */
function buildCustomCss(customization) {
  if (!customization) return '';

  const rules = [];

  // Font customizations
  if (customization.fonts?.body || customization.font_family?.body) {
    const bodyFont = customization.fonts?.body || customization.font_family?.body;
    rules.push(`body { font-family: ${bodyFont}

          /* RTL Support for Hebrew */
          body[dir="rtl"] {
            text-align: right;
            direction: rtl;
          }
          body[dir="rtl"] .highlights,
          body[dir="rtl"] ul,
          body[dir="rtl"] ol {
            padding-right: 20px;
            padding-left: 0;
            margin-right: 0;
            margin-left: 0;
          }
          body[dir="rtl"] .job-header,
          body[dir="rtl"] .edu-header {
            flex-direction: row-reverse;
          }
          body[dir="rtl"] header {
            text-align: center; /* Keep header centered even in RTL */
          }
, sans-serif !important; }`);
  }
  if (customization.fonts?.headings || customization.font_family?.heading) {
    const headingFont = customization.fonts?.headings || customization.font_family?.heading;
    rules.push(`h1, h2, h3 { font-family: ${headingFont}, sans-serif !important; }`);
  }

  // Color customizations
  if (customization.colors?.background || customization.color_scheme?.background) {
    const bgColor = customization.colors?.background || customization.color_scheme?.background;
    rules.push(`body { background: ${bgColor} !important; }`);
  }
  if (customization.colors?.text || customization.color_scheme?.text) {
    const textColor = customization.colors?.text || customization.color_scheme?.text;
    rules.push(`body, p, li, span, div { color: ${textColor} !important; }`);
  }
  if (customization.colors?.primary || customization.color_scheme?.primary) {
    const primaryColor = customization.colors?.primary || customization.color_scheme?.primary;
    rules.push(`h1, h2 { color: ${primaryColor} !important; }`);
  }

  // Custom CSS from design engine
  if (customization.custom_css) {
    rules.push(customization.custom_css);
  }

  return rules.length > 0 ? rules.join('\n') : '';
}

export default function Resume({ data = {}, customization = {} }) {
  const b = data.basics || {};
  const work = data.work || [];
  const education = data.education || [];
  const skills = data.skills || [];

  // Detect language for RTL support
  const lang = detectLanguage(data);
  const isRTL = lang === 'he';

  // Build custom CSS from customizations
  const customCss = buildCustomCss(customization);

  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>{`Resume - ${b.name||''}`}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            margin: 0;
            display: grid;
            grid-template-columns: 320px 1fr;
            min-height: 100vh;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background: #f8fafc;
          }

          /* Sidebar */
          aside {
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
            color: #fff;
            padding: 40px 30px;
            box-shadow: 4px 0 24px rgba(0,0,0,0.1);
          }
          .sidebar-header {
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 2px solid #334155;
          }
          .sidebar-name {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #fff;
          }
          .sidebar-title {
            font-size: 15px;
            color: #06b6d4;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          /* Contact Section in Sidebar */
          .sidebar-section {
            margin-bottom: 28px;
          }
          .sidebar-section h3 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #06b6d4;
            margin-bottom: 12px;
            font-weight: 700;
          }
          .contact-item {
            font-size: 13px;
            color: #cbd5e1;
            margin-bottom: 8px;
            line-height: 1.5;
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }
          .contact-icon {
            color: #06b6d4;
            margin-top: 2px;
          }

          /* Skills in Sidebar */
          .sidebar-skills {
            margin-bottom: 28px;
          }
          .skill-item {
            background: #334155;
            padding: 10px 14px;
            border-radius: 6px;
            margin-bottom: 8px;
            border-left: 3px solid #06b6d4;
          }
          .skill-item-name {
            font-size: 13px;
            font-weight: 700;
            color: #06b6d4;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .skill-item-keywords {
            font-size: 12px;
            color: #cbd5e1;
            line-height: 1.4;
          }

          /* Main Content */
          main {
            padding: 50px 60px;
            background: #fff;
          }
          h2 {
            font-size: 22px;
            font-weight: 700;
            color: #1e293b;
            margin: 0 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 3px solid #06b6d4;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          /* Summary */
          .summary {
            font-size: 15px;
            line-height: 1.8;
            color: #475569;
            margin-bottom: 32px;
            padding: 20px;
            background: #f1f5f9;
            border-left: 4px solid #06b6d4;
            border-radius: 4px;
          }

          /* Experience */
          .experience-section {
            margin-bottom: 32px;
          }
          .job {
            margin-bottom: 28px;
            padding-bottom: 28px;
            border-bottom: 1px solid #e2e8f0;
          }
          .job:last-child {
            border-bottom: none;
          }
          .job-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
            gap: 16px;
          }
          .job-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .job-company {
            font-size: 15px;
            color: #06b6d4;
            font-weight: 600;
          }
          .job-date {
            font-size: 13px;
            color: #64748b;
            white-space: nowrap;
            font-weight: 500;
            background: #f1f5f9;
            padding: 4px 12px;
            border-radius: 4px;
          }
          .job-summary {
            font-size: 14px;
            line-height: 1.6;
            color: #475569;
            margin: 12px 0;
          }
          .highlights {
            list-style: none;
            margin-top: 12px;
          }
          .highlights li {
            font-size: 14px;
            color: #334155;
            padding-left: 20px;
            margin-bottom: 6px;
            position: relative;
            line-height: 1.5;
          }
          .highlights li:before {
            content: '●';
            position: absolute;
            left: 0;
            color: #06b6d4;
            font-size: 10px;
            top: 6px;
          }

          /* Education */
          .education-section {
            margin-bottom: 32px;
          }
          .edu {
            margin-bottom: 20px;
            padding: 16px;
            background: #f8fafc;
            border-left: 3px solid #06b6d4;
            border-radius: 4px;
          }
          .edu-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
          }
          .edu-degree {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .edu-school {
            font-size: 14px;
            color: #06b6d4;
            font-weight: 600;
          }
          .edu-date {
            font-size: 13px;
            color: #64748b;
            white-space: nowrap;
            font-weight: 500;
          }

          @media print {
            body {
              grid-template-columns: 280px 1fr;
            }
            aside {
              box-shadow: none;
            }
            .job {
              page-break-inside: avoid;
            }
          }

          @media (max-width: 768px) {
            body {
              grid-template-columns: 1fr;
            }
            aside {
              padding: 30px 20px;
            }
            main {
              padding: 30px 20px;
            }
          }
        `}</style>
              {/* Custom CSS from user customizations */}
        {customCss && <style>{customCss}</style>}
      </head>
      <body dir={isRTL ? 'rtl' : 'ltr'}>
        <aside>
          <div className="sidebar-header">
            <div className="sidebar-name">{b.name || 'Your Name'}</div>
            {b.label && <div className="sidebar-title">{b.label}</div>}
          </div>

          <div className="sidebar-section">
            <h3>Contact</h3>
            {b.email && (
              <div className="contact-item">
                <span className="contact-icon">✉</span>
                <span>{b.email}</span>
              </div>
            )}
            {b.phone && (
              <div className="contact-item">
                <span className="contact-icon">📱</span>
                <span>{b.phone}</span>
              </div>
            )}
            {b.location?.city && (
              <div className="contact-item">
                <span className="contact-icon">📍</span>
                <span>{b.location.city}, {b.location.region || b.location.country}</span>
              </div>
            )}
          </div>

          {skills.length > 0 && (
            <div className="sidebar-skills">
              <h3>Skills</h3>
              {skills.map((skill, i) => (
                <div className="skill-item" key={i}>
                  <div className="skill-item-name">{skill.name || skill.category}</div>
                  <div className="skill-item-keywords">
                    {(skill.keywords || []).join(' • ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main>
          {data.summary && (
            <section>
              <h2>Professional Summary</h2>
              <div className="summary">{data.summary.trim()}</div>
            </section>
          )}

          {work.length > 0 && (
            <section className="experience-section">
              <h2>Professional Experience</h2>
              {work.map((job, i) => (
                <div className="job" key={i}>
                  <div className="job-header">
                    <div>
                      <div className="job-title">{job.position || job.title}</div>
                      <div className="job-company">
                        {job.company || job.name}
                        {job.location && ` • ${job.location}`}
                      </div>
                    </div>
                    <div className="job-date">
                      {job.startDate || job.start} – {job.endDate || job.end || 'Present'}
                    </div>
                  </div>
                  {job.summary && <div className="job-summary">{job.summary}</div>}
                  {job.highlights && job.highlights.length > 0 && (
                    <ul className="highlights">
                      {job.highlights.map((h, j) => <li key={j}>{h}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          {education.length > 0 && (
            <section className="education-section">
              <h2>Education</h2>
              {education.map((edu, i) => (
                <div className="edu" key={i}>
                  <div className="edu-header">
                    <div>
                      <div className="edu-degree">
                        {edu.studyType || edu.degree} in {edu.area || edu.field}
                      </div>
                      <div className="edu-school">{edu.institution || edu.school}</div>
                    </div>
                    <div className="edu-date">
                      {edu.startDate || edu.start} – {edu.endDate || edu.end || 'Present'}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </main>
      </body>
    </html>
  );
}
