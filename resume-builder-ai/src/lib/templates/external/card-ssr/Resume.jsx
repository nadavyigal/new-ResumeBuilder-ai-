import React from 'react';
export default function Resume({ data = {}, customization = {} }) {
  const b = data.basics || {};
  const work = data.work || [];
  const education = data.education || [];
  const skills = data.skills || [];

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>{`Resume - ${b.name||''}`}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 50px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }

          .resume-container {
            background: #fff;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }

          /* Header Card */
          header {
            background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
            color: #fff;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 8px 24px rgba(37, 99, 235, 0.25);
          }
          h1 {
            font-size: 42px;
            font-weight: 700;
            margin-bottom: 8px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .title {
            font-size: 18px;
            opacity: 0.95;
            margin-bottom: 16px;
            font-weight: 500;
          }
          .contact {
            font-size: 14px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            opacity: 0.9;
          }
          .contact-item {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          /* Section Cards */
          section {
            margin-bottom: 24px;
          }
          h2 {
            font-size: 20px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 3px solid #0ea5e9;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Summary Card */
          .summary-card {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-left: 4px solid #2563eb;
            padding: 20px;
            border-radius: 8px;
            line-height: 1.7;
            color: #1e293b;
          }

          /* Experience Cards */
          .job-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .job-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.15);
          }
          .job-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
            gap: 16px;
          }
          .job-title {
            font-size: 18px;
            font-weight: 700;
            color: #1e293b;
          }
          .job-date {
            font-size: 13px;
            color: #64748b;
            background: #f1f5f9;
            padding: 4px 12px;
            border-radius: 20px;
            white-space: nowrap;
            font-weight: 500;
          }
          .job-company {
            font-size: 15px;
            color: #2563eb;
            font-weight: 600;
            margin-bottom: 10px;
          }
          .job-summary {
            font-size: 14px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 12px;
          }
          .highlights {
            list-style: none;
            margin-top: 12px;
          }
          .highlights li {
            font-size: 14px;
            color: #334155;
            padding-left: 24px;
            margin-bottom: 8px;
            position: relative;
            line-height: 1.5;
          }
          .highlights li:before {
            content: '▸';
            position: absolute;
            left: 8px;
            color: #0ea5e9;
            font-weight: bold;
          }

          /* Education Cards */
          .edu-card {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 12px;
            border-left: 4px solid #0ea5e9;
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
            color: #1e293b;
            margin-bottom: 6px;
          }
          .edu-date {
            font-size: 13px;
            color: #64748b;
            background: #fff;
            padding: 4px 12px;
            border-radius: 20px;
            white-space: nowrap;
            font-weight: 500;
          }
          .edu-school {
            font-size: 14px;
            color: #0ea5e9;
            font-weight: 600;
          }

          /* Skills Cards */
          .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
          }
          .skill-card {
            background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            transition: all 0.2s;
          }
          .skill-card:hover {
            border-color: #2563eb;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
          }
          .skill-name {
            font-size: 14px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .skill-keywords {
            font-size: 13px;
            line-height: 1.6;
            color: #475569;
          }

          @media print {
            body {
              background: #fff;
              padding: 0;
            }
            .resume-container {
              box-shadow: none;
              padding: 20px;
            }
            .job-card, .edu-card, .skill-card {
              page-break-inside: avoid;
              box-shadow: none;
            }
          }
        `}</style>
      </head>
      <body>
        <div className="resume-container">
          <header>
            <h1>{b.name || 'Your Name'}</h1>
            {b.label && <div className="title">{b.label}</div>}
            <div className="contact">
              {b.email && <div className="contact-item">✉ {b.email}</div>}
              {b.phone && <div className="contact-item">📱 {b.phone}</div>}
              {b.location?.city && <div className="contact-item">📍 {b.location.city}, {b.location.region || b.location.country}</div>}
            </div>
          </header>

          {data.summary && (
            <section>
              <h2>Professional Summary</h2>
              <div className="summary-card">{data.summary.trim()}</div>
            </section>
          )}

          {work.length > 0 && (
            <section>
              <h2>Professional Experience</h2>
              {work.map((job, i) => (
                <div className="job-card" key={i}>
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
            <section>
              <h2>Education</h2>
              {education.map((edu, i) => (
                <div className="edu-card" key={i}>
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

          {skills.length > 0 && (
            <section>
              <h2>Skills</h2>
              <div className="skills-grid">
                {skills.map((skill, i) => (
                  <div className="skill-card" key={i}>
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
      </body>
    </html>
  );
}
