
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
  const instanceId = 'resume-timeline-ssr';

  // Build CSS as a string for inline style tag (SSR-compatible)
  const cssStyles = `
    .${instanceId} * { margin: 0; padding: 0; box-sizing: border-box; }

              .resume-timeline-ssr .resume-timeline-ssr {
                font-family: 'Trebuchet MS', system-ui, sans-serif;
                max-width: 950px;
                margin: 0 auto;
                padding: 50px 40px;
                background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
                color: #1f2937;
              }
    
              /* Header */
              .resume-timeline-ssr header {
                text-align: center;
                padding: 40px 0;
                margin-bottom: 50px;
                background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
                color: #fff;
                border-radius: 20px;
                box-shadow: 0 10px 40px rgba(124, 58, 237, 0.3);
                position: relative;
                overflow: hidden;
              }
              header:before {
                content: '';
                position: absolute;
                top: -50%;
                right: -10%;
                width: 300px;
                height: 300px;
                background: rgba(255,255,255,0.1);
                border-radius: 50%;
              }
              .resume-timeline-ssr h1 {
                font-size: 48px;
                font-weight: 700;
                margin-bottom: 12px;
                position: relative;
                z-index: 1;
                text-shadow: 0 2px 10px rgba(0,0,0,0.2);
              }
              .resume-timeline-ssr .title {
                font-size: 20px;
                font-weight: 500;
                opacity: 0.95;
                position: relative;
                z-index: 1;
                text-transform: uppercase;
                letter-spacing: 2px;
              }
              .resume-timeline-ssr .contact {
                font-size: 14px;
                margin-top: 20px;
                display: flex;
                justify-content: center;
                flex-wrap: wrap;
                gap: 20px;
                opacity: 0.9;
                position: relative;
                z-index: 1;
              }
    
              /* Section Headers */
              .resume-timeline-ssr h2 {
                font-size: 26px;
                font-weight: 700;
                color: #7c3aed;
                margin: 40px 0 24px 0;
                padding-left: 20px;
                border-left: 6px solid #a855f7;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
    
              /* Summary */
              .resume-timeline-ssr .summary {
                font-size: 16px;
                line-height: 1.8;
                color: #4b5563;
                padding: 24px;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(124, 58, 237, 0.1);
                border-left: 4px solid #a855f7;
                margin-bottom: 40px;
              }
    
              /* Timeline */
              .resume-timeline-ssr .timeline {
                position: relative;
                padding-left: 50px;
              }
              .timeline:before {
                content: '';
                position: absolute;
                left: 15px;
                top: 8px;
                bottom: 8px;
                width: 4px;
                background: linear-gradient(180deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%);
                border-radius: 4px;
              }
    
              /* Timeline Items */
              .resume-timeline-ssr .timeline-item {
                position: relative;
                margin-bottom: 40px;
                background: #fff;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(124, 58, 237, 0.08);
                transition: transform 0.2s, box-shadow 0.2s;
              }
              .timeline-item:hover {
                transform: translateX(4px);
                box-shadow: 0 6px 25px rgba(124, 58, 237, 0.15);
              }
              .timeline-item:before {
                content: '';
                position: absolute;
                left: -36px;
                top: 30px;
                width: 16px;
                height: 16px;
                background: #7c3aed;
                border: 4px solid #fff;
                border-radius: 50%;
                box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.2);
                z-index: 1;
              }
              .timeline-.resume-timeline-ssr header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
                gap: 16px;
              }
              .resume-timeline-ssr .timeline-title {
                font-size: 20px;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 6px;
              }
              .resume-timeline-ssr .timeline-subtitle {
                font-size: 16px;
                color: #7c3aed;
                font-weight: 600;
              }
              .resume-timeline-ssr .timeline-date {
                font-size: 13px;
                color: #fff;
                background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
                padding: 6px 16px;
                border-radius: 20px;
                white-space: nowrap;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
              }
              .resume-timeline-ssr .timeline-summary {
                font-size: 14px;
                line-height: 1.6;
                color: #4b5563;
                margin: 12px 0;
              }
              .resume-timeline-ssr .highlights {
                list-style: none;
                margin-top: 12px;
              }
              .highlights li {
                font-size: 14px;
                color: #374151;
                padding-left: 24px;
                margin-bottom: 8px;
                position: relative;
                line-height: 1.5;
              }
              .highlights li:before {
                content: '◆';
                position: absolute;
                left: 0;
                color: #a855f7;
                font-size: 12px;
              }
    
              /* Education Timeline */
              .resume-timeline-ssr .edu-timeline-item {
                position: relative;
                margin-bottom: 24px;
                background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
                padding: 20px;
                border-radius: 10px;
                border-left: 4px solid #7c3aed;
              }
              .edu-timeline-item:before {
                content: '';
                position: absolute;
                left: -36px;
                top: 26px;
                width: 14px;
                height: 14px;
                background: #a855f7;
                border: 3px solid #fff;
                border-radius: 50%;
                box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2);
              }
              .edu-.resume-timeline-ssr header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
              }
              .resume-timeline-ssr .edu-degree {
                font-size: 17px;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 6px;
              }
              .resume-timeline-ssr .edu-school {
                font-size: 15px;
                color: #7c3aed;
                font-weight: 600;
              }
              .resume-timeline-ssr .edu-date {
                font-size: 13px;
                color: #6b7280;
                font-weight: 500;
                background: #fff;
                padding: 4px 12px;
                border-radius: 12px;
                white-space: nowrap;
              }
    
              /* Skills Grid */
              .resume-timeline-ssr .skills-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 16px;
                margin-top: 24px;
              }
              .resume-timeline-ssr .skill-badge {
                background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
                color: #fff;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(124, 58, 237, 0.2);
                transition: transform 0.2s;
              }
              .skill-badge:hover {
                transform: translateY(-4px);
                box-shadow: 0 6px 25px rgba(124, 58, 237, 0.3);
              }
              .resume-timeline-ssr .skill-name {
                font-size: 15px;
                font-weight: 700;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .resume-timeline-ssr .skill-keywords {
                font-size: 13px;
                line-height: 1.6;
                opacity: 0.95;
              }
    
              @media print {
                .resume-timeline-ssr .resume-timeline-ssr {
                  background: #fff;
                  padding: 20px;
                }
                .resume-timeline-ssr header {
                  box-shadow: none;
                }
                .timeline-item, .resume-timeline-ssr .edu-timeline-item {
                  page-break-inside: avoid;
                  box-shadow: none;
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

      <header>
                <h1>{b.name || 'Your Name'}</h1>
                {b.label && <div className="title">{b.label}</div>}
                <div className="contact">
                  {b.email && <span>✉ {b.email}</span>}
                  {b.phone && <span>📱 {b.phone}</span>}
                  {b.location?.city && <span>📍 {b.location.city}, {b.location.region || b.location.country}</span>}
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
                  <div className="timeline">
                    {work.map((job, i) => (
                      <div className="timeline-item" key={i}>
                        <div className="timeline-header">
                          <div>
                            <div className="timeline-title">{job.position || job.title}</div>
                            <div className="timeline-subtitle">
                              {job.company || job.name}
                              {job.location && ` • ${job.location}`}
                            </div>
                          </div>
                          <div className="timeline-date">
                            {job.startDate || job.start} – {job.endDate || job.end || 'Present'}
                          </div>
                        </div>
                        {job.summary && <div className="timeline-summary">{job.summary}</div>}
                        {job.highlights && job.highlights.length > 0 && (
                          <ul className="highlights">
                            {job.highlights.map((h, j) => <li key={j}>{h}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
      
              {education.length > 0 && (
                <section>
                  <h2>Education</h2>
                  <div className="timeline">
                    {education.map((edu, i) => (
                      <div className="edu-timeline-item" key={i}>
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
                  </div>
                </section>
              )}
      
              {skills.length > 0 && (
                <section>
                  <h2>Skills</h2>
                  <div className="skills-grid">
                    {skills.map((skill, i) => (
                      <div className="skill-badge" key={i}>
                        <div className="skill-name">{skill.name || skill.category}</div>
                        <div className="skill-keywords">
                          {(skill.keywords || []).join(' • ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
    </div>
  );
}
