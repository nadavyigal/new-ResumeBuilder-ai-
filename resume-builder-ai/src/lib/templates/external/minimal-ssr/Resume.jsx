
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
    .resume-minimal-ssr * { margin: 0; padding: 0; box-sizing: border-box; }
              .resume-minimal-ssr {
                font-family: ${fonts.body};
                max-width: 850px;
                margin: 0 auto;
                padding: 60px 40px;
                color: ${colors.primary};
                background: #fff;
                line-height: 1.6;
              }
    
              /* Header */
              .resume-minimal-ssr header {
                text-align: center;
                padding-bottom: 30px;
                border-bottom: 3px double ${colors.primary};
                margin-bottom: 40px;
              }
              .resume-minimal-ssr h1 {
                font-size: 36px;
                font-weight: 700;
                letter-spacing: 2px;
                text-transform: uppercase;
                margin-bottom: 8px;
              }
              .resume-minimal-ssr .title {
                font-size: 16px;
                font-style: italic;
                color: ${colors.secondary};
                margin-bottom: 12px;
              }
              .resume-minimal-ssr .contact {
                font-size: 14px;
                color: ${colors.secondary};
                margin-top: 12px;
              }
              .resume-minimal-ssr .contact span { margin: 0 8px; }
    
              /* Section Titles */
              .resume-minimal-ssr h2 {
                font-size: 14px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 2px;
                border-bottom: 2px solid ${colors.primary};
                padding-bottom: 8px;
                margin: 32px 0 20px;
              }
    
              /* Summary */
              .resume-minimal-ssr .summary {
                font-size: 15px;
                line-height: 1.8;
                text-align: justify;
              }
    
              /* Experience */
              .resume-minimal-ssr .job {
                margin-bottom: 24px;
                page-break-inside: avoid;
              }
              .resume-minimal-ssr .job header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 4px;
              }
              .resume-minimal-ssr .job-title {
                font-size: 16px;
                font-weight: 700;
              }
              .resume-minimal-ssr .job-date {
                font-size: 14px;
                font-style: italic;
                color: ${colors.secondary};
              }
              .resume-minimal-ssr .job-company {
                font-size: 15px;
                margin-bottom: 8px;
              }
              .resume-minimal-ssr .job-summary {
                font-size: 14px;
                line-height: 1.7;
                margin-top: 6px;
              }
              .resume-minimal-ssr .highlights {
                list-style-position: outside;
                margin-left: 20px;
                margin-top: 6px;
              }
              .resume-minimal-ssr .highlights li {
                font-size: 14px;
                margin-bottom: 4px;
              }
    
              /* Education */
              .resume-minimal-ssr .edu {
                margin-bottom: 16px;
              }
              .resume-minimal-ssr .edu header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
              }
              .resume-minimal-ssr .edu-degree {
                font-size: 15px;
                font-weight: 700;
              }
              .resume-minimal-ssr .edu-date {
                font-size: 14px;
                font-style: italic;
                color: ${colors.secondary};
              }
              .resume-minimal-ssr .edu-school {
                font-size: 14px;
                margin-top: 2px;
              }
    
              /* Skills */
              .resume-minimal-ssr .skills-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
              }
              .resume-minimal-ssr .skill-category {
                border: 1px solid ${colors.primary};
                padding: 12px;
              }
              .resume-minimal-ssr .skill-name {
                font-size: 14px;
                font-weight: 700;
                margin-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .resume-minimal-ssr .skill-keywords {
                font-size: 13px;
                line-height: 1.6;
              }
    
              @media print {
                .resume-minimal-ssr { padding: 0; margin: 0; }
                .resume-minimal-ssr .job { page-break-inside: avoid; }
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
                        <div className="skill-keywords">
                          {(skill.keywords || []).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
    </div>
  );
}
