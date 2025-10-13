
import React from 'react';

export default function Resume({ data, customization }) {
  const b = data.basics || {};
  const work = data.work || [];
  const education = data.education || [];
  const skills = data.skills || [];

  // Apply customization if provided
  const colors = customization?.color_scheme || {
    primary: '#111827',
    secondary: '#6b7280',
    accent: '#3b82f6'
  };

  const fonts = customization?.font_family || {
    headings: 'Georgia, "Times New Roman", serif',
    body: 'Georgia, "Times New Roman", serif'
  };

  // Generate unique class name for this instance to avoid style conflicts
  const instanceId = 'resume-minimal-ssr';

  // Build CSS as a string for inline style tag (SSR-compatible)
  const cssStyles = `
    .${instanceId} * { margin: 0; padding: 0; box-sizing: border-box; }

    .${instanceId} {
      font-family: ${fonts.body};
      max-width: 850px;
      margin: 0 auto;
      padding: 60px 40px;
      color: ${colors.primary};
      background: #fff;
      line-height: 1.6;
    }

    /* Header */
    .${instanceId} header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 3px double ${colors.primary};
      margin-bottom: 40px;
    }
    .${instanceId} h1 {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .${instanceId} .title {
      font-size: 16px;
      font-style: italic;
      color: ${colors.secondary};
      margin-bottom: 12px;
    }
    .${instanceId} .contact {
      font-size: 14px;
      color: ${colors.secondary};
      margin-top: 12px;
    }
    .${instanceId} .contact span { margin: 0 8px; }

    /* Section Titles */
    .${instanceId} h2 {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      border-bottom: 2px solid ${colors.primary};
      padding-bottom: 8px;
      margin: 32px 0 20px;
    }

    /* Summary */
    .${instanceId} .summary {
      font-size: 15px;
      line-height: 1.8;
      text-align: justify;
    }

    /* Experience */
    .${instanceId} .job {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .${instanceId} .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .${instanceId} .job-title {
      font-size: 16px;
      font-weight: 700;
    }
    .${instanceId} .job-date {
      font-size: 14px;
      font-style: italic;
      color: ${colors.secondary};
    }
    .${instanceId} .job-company {
      font-size: 15px;
      margin-bottom: 8px;
    }
    .${instanceId} .job-summary {
      font-size: 14px;
      line-height: 1.7;
      margin-top: 6px;
    }
    .${instanceId} .highlights {
      list-style-position: outside;
      margin-left: 20px;
      margin-top: 6px;
    }
    .${instanceId} .highlights li {
      font-size: 14px;
      margin-bottom: 4px;
    }

    /* Education */
    .${instanceId} .edu {
      margin-bottom: 16px;
    }
    .${instanceId} .edu-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .${instanceId} .edu-degree {
      font-size: 15px;
      font-weight: 700;
    }
    .${instanceId} .edu-date {
      font-size: 14px;
      font-style: italic;
      color: ${colors.secondary};
    }
    .${instanceId} .edu-school {
      font-size: 14px;
      margin-top: 2px;
    }

    /* Skills */
    .${instanceId} .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .${instanceId} .skill-category {
      border: 1px solid ${colors.primary};
      padding: 12px;
    }
    .${instanceId} .skill-name {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .${instanceId} .skill-keywords {
      font-size: 13px;
      line-height: 1.6;
    }

    @media print {
      .${instanceId} { padding: 0; margin: 0; }
      .${instanceId} .job { page-break-inside: avoid; }
    }
  `;

  return (
    <div className={instanceId} style={{
      fontFamily: fonts.body,
      maxWidth: '850px',
      margin: '0 auto',
      padding: '60px 40px',
      color: colors.primary,
      background: '#fff',
      lineHeight: '1.6'
    }}>
      {/* Use regular style tag instead of styled-jsx for SSR compatibility */}
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />

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
                        {skill.keywords && skill.keywords.length > 0 && (
                          <div className="skill-keywords">
                            {skill.keywords.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
    </div>
  );
}
