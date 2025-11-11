
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
    rules.push(`body { font-family: ${bodyFont}, serif !important; }`);
  }
  if (customization.fonts?.headings || customization.font_family?.heading) {
    const headingFont = customization.fonts?.headings || customization.font_family?.heading;
    rules.push(`h1, h2, h3 { font-family: ${headingFont}, serif !important; }`);
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
            font-family: Georgia, 'Times New Roman', serif;
            max-width: 850px;
            margin: 0 auto;
            padding: 60px 40px;
            color: #000;
            background: #fff;
            line-height: 1.6;
          }

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

          /* Header */
          header {
            text-align: center;
            padding-bottom: 30px;
            border-bottom: 3px double #000;
            margin-bottom: 40px;
          }
          h1 {
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .title {
            font-size: 16px;
            font-style: italic;
            color: #333;
            margin-bottom: 12px;
          }
          .contact {
            font-size: 14px;
            color: #555;
            margin-top: 12px;
          }
          .contact span { margin: 0 8px; }

          /* Section Titles */
          h2 {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin: 32px 0 20px;
          }

          /* Summary */
          .summary {
            font-size: 15px;
            line-height: 1.8;
            text-align: justify;
          }

          /* Experience */
          .job {
            margin-bottom: 24px;
            page-break-inside: avoid;
          }
          .job-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 4px;
          }
          .job-title {
            font-size: 16px;
            font-weight: 700;
          }
          .job-date {
            font-size: 14px;
            font-style: italic;
            color: #555;
          }
          .job-company {
            font-size: 15px;
            margin-bottom: 8px;
          }
          .job-summary {
            font-size: 14px;
            line-height: 1.7;
            margin-top: 6px;
          }
          .highlights {
            list-style-position: outside;
            margin-left: 20px;
            margin-top: 6px;
          }
          .highlights li {
            font-size: 14px;
            margin-bottom: 4px;
          }

          /* Education */
          .edu {
            margin-bottom: 16px;
          }
          .edu-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
          }
          .edu-degree {
            font-size: 15px;
            font-weight: 700;
          }
          .edu-date {
            font-size: 14px;
            font-style: italic;
            color: #555;
          }
          .edu-school {
            font-size: 14px;
            margin-top: 2px;
          }

          /* Skills */
          .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
          }
          .skill-category {
            border: 1px solid #000;
            padding: 12px;
          }
          .skill-name {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .skill-keywords {
            font-size: 13px;
            line-height: 1.6;
          }

          @media print {
            body { padding: 0; margin: 0; }
            .job { page-break-inside: avoid; }
          }
        `}</style>

        {/* Custom CSS from user customizations */}
        {customCss && <style>{customCss}</style>}
      </head>
      <body dir={isRTL ? 'rtl' : 'ltr'}>
        <header>
          <h1>{b.name || 'Your Name'}</h1>
          {b.label && <div className="title">{b.label}</div>}
          <div className="contact">
            {b.email && <span>{b.email}</span>}
            {b.phone && <span>•</span>}
            {b.phone && <span>{b.phone}</span>}
            {b.location?.city && <span>•</span>}
            {b.location?.city && <span>{b.location.city}, {b.location.region || b.location.country}</span>}
          </div>
        </header>

        {data.summary && (
          <section>
            <h2>Professional Summary</h2>
            <div className="summary">{data.summary.trim()}</div>
          </section>
        )}

        {work.length > 0 && (
          <section>
            <h2>Professional Experience</h2>
            {work.map((job, i) => (
              <div className="job" key={i}>
                <div className="job-header">
                  <div className="job-title">{job.position || job.title}</div>
                  <div className="job-date">
                    {job.startDate || job.start} – {job.endDate || job.end || 'Present'}
                  </div>
                </div>
                <div className="job-company">
                  {job.company || job.name}
                  {job.location && ` • ${job.location}`}
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
          <section>
            <h2>Education</h2>
            {education.map((edu, i) => (
              <div className="edu" key={i}>
                <div className="edu-header">
                  <div className="edu-degree">
                    {edu.studyType || edu.degree} in {edu.area || edu.field}
                  </div>
                  <div className="edu-date">
                    {edu.startDate || edu.start} – {edu.endDate || edu.end || 'Present'}
                  </div>
                </div>
                <div className="edu-school">{edu.institution || edu.school}</div>
              </div>
            ))}
          </section>
        )}

        {skills.length > 0 && (
          <section>
            <h2>Skills</h2>
            <div className="skills-grid">
              {skills.map((skill, i) => (
                <div className="skill-category" key={i}>
                  <div className="skill-name">{skill.name || skill.category}</div>
                  <div className="skill-keywords">
                    {(skill.keywords || []).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </body>
    </html>
  );
}