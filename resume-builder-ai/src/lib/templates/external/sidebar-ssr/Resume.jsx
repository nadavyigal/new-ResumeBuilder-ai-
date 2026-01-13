
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
  const instanceId = 'resume-sidebar-ssr';

  // Build CSS as a string for inline style tag (SSR-compatible)
  // CRITICAL: Transform CSS selectors carefully to avoid duplicated class names
  // Problem: "body {" → ".resume-X {" then ".resume-X {" → ".resume-X .resume-X {"
  // Solution: Do class selector replacement FIRST, then body replacement
  const cssStyles = `
    .${instanceId} * { margin: 0; padding: 0; box-sizing: border-box; }

    
              * { margin: 0; padding: 0; box-sizing: border-box; }
              .resume-sidebar-ssr {
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
              .resume-sidebar-ssr .sidebar-header {
                margin-bottom: 32px;
                padding-bottom: 24px;
                border-bottom: 2px solid #334155;
              }
              .resume-sidebar-ssr .sidebar-name {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 8px;
                color: #fff;
              }
              .resume-sidebar-ssr .sidebar-title {
                font-size: 15px;
                color: #06b6d4;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
    
              /* Contact Section in Sidebar */
              .resume-sidebar-ssr .sidebar-section {
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
              .resume-sidebar-ssr .contact-item {
                font-size: 13px;
                color: #cbd5e1;
                margin-bottom: 8px;
                line-height: 1.5;
                display: flex;
                align-items: flex-start;
                gap: 8px;
              }
              .resume-sidebar-ssr .contact-icon {
                color: #06b6d4;
                margin-top: 2px;
              }
    
              /* Skills in Sidebar */
              .resume-sidebar-ssr .sidebar-skills {
                margin-bottom: 28px;
              }
              .resume-sidebar-ssr .skill-item {
                background: #334155;
                padding: 10px 14px;
                border-radius: 6px;
                margin-bottom: 8px;
                border-left: 3px solid #06b6d4;
              }
              .resume-sidebar-ssr .skill-item-name {
                font-size: 13px;
                font-weight: 700;
                color: #06b6d4;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .resume-sidebar-ssr .skill-item-keywords {
                font-size: 12px;
                color: #cbd5e1;
                line-height: 1.4;
              }
    
              /* Main Content */
              main {
                padding: 50px 60px;
                background: #fff;
              }
              .resume-sidebar-ssr h2 {
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
              .resume-sidebar-ssr .summary {
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
              .resume-sidebar-ssr .experience-section {
                margin-bottom: 32px;
              }
              .resume-sidebar-ssr .job {
                margin-bottom: 28px;
                padding-bottom: 28px;
                border-bottom: 1px solid #e2e8f0;
              }
              .job:last-child {
                border-bottom: none;
              }
              .resume-sidebar-ssr .job-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
                gap: 16px;
              }
              .resume-sidebar-ssr .job-title {
                font-size: 18px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 4px;
              }
              .resume-sidebar-ssr .job-company {
                font-size: 15px;
                color: #06b6d4;
                font-weight: 600;
              }
              .resume-sidebar-ssr .job-date {
                font-size: 13px;
                color: #64748b;
                white-space: nowrap;
                font-weight: 500;
                background: #f1f5f9;
                padding: 4px 12px;
                border-radius: 4px;
              }
              .resume-sidebar-ssr .job-summary {
                font-size: 14px;
                line-height: 1.6;
                color: #475569;
                margin: 12px 0;
              }
              .resume-sidebar-ssr .highlights {
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
              .resume-sidebar-ssr .education-section {
                margin-bottom: 32px;
              }
              .resume-sidebar-ssr .edu {
                margin-bottom: 20px;
                padding: 16px;
                background: #f8fafc;
                border-left: 3px solid #06b6d4;
                border-radius: 4px;
              }
              .resume-sidebar-ssr .edu-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
              }
              .resume-sidebar-ssr .edu-degree {
                font-size: 16px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 4px;
              }
              .resume-sidebar-ssr .edu-school {
                font-size: 14px;
                color: #06b6d4;
                font-weight: 600;
              }
              .resume-sidebar-ssr .edu-date {
                font-size: 13px;
                color: #64748b;
                white-space: nowrap;
                font-weight: 500;
              }
    
              @media print {
                .resume-sidebar-ssr {
                  grid-template-columns: 280px 1fr;
                }
              aside {
                  box-shadow: none;
                }
              .resume-sidebar-ssr .job {
                  page-break-inside: avoid;
                }
              }
    
              @media (max-width: 768px) {
                .resume-sidebar-ssr {
                  grid-template-columns: 1fr;
                }
              aside {
                  padding: 30px 20px;
                }
              main {
                  padding: 30px 20px;
                }
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
    </div>
  );
}
