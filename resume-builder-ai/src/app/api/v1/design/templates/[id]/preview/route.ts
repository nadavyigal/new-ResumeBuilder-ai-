/**
 * API Route: GET /api/v1/design/templates/[id]/preview
 * Generates HTML preview of a template with sample data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getDesignTemplateById } from '@/lib/supabase/design-templates';

// Force dynamic rendering to prevent build-time static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ColorScheme = {
  primary: string;
  secondary: string;
  accent: string;
};

type FontFamily = {
  heading: string;
  body: string;
};

const sample = {
  name: 'John Doe',
  title: 'Senior Software Engineer',
  location: 'San Francisco, CA',
  email: 'john.doe@email.com',
  phone: '+1 (555) 123-4567',
  linkedin: 'linkedin.com/in/johndoe',
  website: 'johndoe.com',
};

function buildStyles(colors: ColorScheme, fonts: FontFamily, lineHeight: number, compact: boolean) {
  return `
    :root {
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-accent: ${colors.accent};
      --font-heading: ${fonts.heading};
      --font-body: ${fonts.body};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--font-body);
      background: #f5f7fb;
      padding: 20px;
      color: #0f172a;
      line-height: ${lineHeight};
      font-size: 13px;
    }
    .resume {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      padding: ${compact ? '28px' : '40px'};
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
      border-radius: 18px;
      border: 1px solid rgba(15, 23, 42, 0.06);
    }
    .header {
      border-bottom: 3px solid var(--color-primary);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .name {
      font-family: var(--font-heading);
      font-size: 26px;
      font-weight: 800;
      color: var(--color-primary);
      letter-spacing: -0.02em;
    }
    .title {
      font-family: var(--font-heading);
      font-size: 14px;
      font-weight: 600;
      color: var(--color-secondary);
      margin-top: 6px;
    }
    .contact {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      margin-top: 10px;
      font-size: 12px;
      color: #475569;
    }
    .contact span::before {
      content: '•';
      margin-right: 6px;
      color: var(--color-accent);
      font-weight: 700;
    }
    section { margin-top: 18px; }
    h2 {
      font-family: var(--font-heading);
      font-size: 15px;
      color: var(--color-primary);
      margin-bottom: 10px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    h2::before {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-accent);
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
    }
    p { color: #1f2937; font-size: 13px; }
    .pill-row, .pill-col {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .pill-row span, .pill-col span {
      background: rgba(26, 115, 232, 0.08);
      color: var(--color-primary);
      padding: 6px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .experience .job { margin-top: 14px; }
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .job-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 13.5px;
    }
    .job-company {
      color: #475569;
      font-size: 12px;
      margin-top: 4px;
    }
    .job-dates {
      color: var(--color-secondary);
      font-size: 11px;
      font-weight: 600;
    }
    ul { margin-top: 8px; margin-left: 18px; color: #1f2937; }
    li { margin-bottom: 6px; }
    li::marker { color: var(--color-accent); }
    .degree { font-weight: 700; color: #0f172a; font-size: 13px; }
    .school { color: #475569; font-size: 12px; }

    /* Two-column layouts */
    .two-col { display: grid; grid-template-columns: 32% 68%; gap: 14px; }
    .sidebar {
      background: linear-gradient(180deg, rgba(26,115,232,0.08), rgba(26,115,232,0.03));
      border: 1px solid rgba(15,23,42,0.05);
      border-radius: 14px;
      padding: 14px;
    }
    .sidebar section { margin-top: 14px; }
    .sidebar h3 {
      font-family: var(--font-heading);
      font-size: 14px;
      color: var(--color-primary);
      margin-bottom: 8px;
    }
    .content section { margin-top: 12px; }

    /* Corporate tweaks */
    .corporate .sidebar {
      background: linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.65));
      color: #e2e8f0;
      border-color: rgba(255,255,255,0.08);
    }
    .corporate .sidebar h3 { color: #e2e8f0; }
    .corporate .sidebar .pill-col span {
      background: rgba(255,255,255,0.08);
      color: #e2e8f0;
    }
  `;
}

function buildHeader() {
  return `
    <div class="header">
      <div class="name">${sample.name}</div>
      <div class="title">${sample.title}</div>
      <div class="contact">
        <span>${sample.location}</span>
        <span>${sample.email}</span>
        <span>${sample.phone}</span>
        <span>${sample.linkedin}</span>
        <span>${sample.website}</span>
      </div>
    </div>
  `;
}

function singleColumnBody() {
  return `
    ${buildHeader()}
    <section>
      <h2>Summary</h2>
      <p>
        Experienced engineer with 5+ years across cloud, frontend, and leadership. Delivers scalable platforms and mentors teams.
      </p>
    </section>
    <section>
      <h2>Skills</h2>
      <div class="pill-row">
        <span>JavaScript</span><span>TypeScript</span><span>React</span><span>Node.js</span><span>AWS</span><span>SQL</span>
      </div>
    </section>
    <section>
      <h2>Experience</h2>
      <div class="experience">
        <div class="job">
          <div class="job-header">
            <div>
              <div class="job-title">Senior Software Engineer</div>
              <div class="job-company">Tech Corp — San Francisco, CA</div>
            </div>
            <div class="job-dates">2020 — Present</div>
          </div>
          <ul>
            <li>Led migration to microservices serving 1M+ users.</li>
            <li>Reduced deployment time by 60% with CI/CD automation.</li>
            <li>Mentored 5 engineers and drove code quality standards.</li>
          </ul>
        </div>
        <div class="job">
          <div class="job-header">
            <div>
              <div class="job-title">Software Engineer</div>
              <div class="job-company">StartupXYZ — Remote</div>
            </div>
            <div class="job-dates">2018 — 2020</div>
          </div>
          <ul>
            <li>Built and maintained 10+ REST APIs with 99.9% uptime.</li>
            <li>Improved performance by 40% via caching and profiling.</li>
            <li>Collaborated with PM/design to ship weekly releases.</li>
          </ul>
        </div>
      </div>
    </section>
    <section>
      <h2>Education</h2>
      <div class="education">
        <div>
          <div class="degree">B.Sc. Computer Science</div>
          <div class="school">UC Berkeley — 2018</div>
        </div>
      </div>
    </section>
  `;
}

function twoColumnBody() {
  return `
    <div class="two-col">
      <aside class="sidebar">
        ${buildHeader()}
        <section>
          <h3>Skills</h3>
          <div class="pill-col">
            <span>TypeScript</span><span>React</span><span>Next.js</span><span>Node.js</span><span>PostgreSQL</span><span>AWS</span>
          </div>
        </section>
        <section>
          <h3>Education</h3>
          <p class="degree">B.Sc. Computer Science</p>
          <p class="school">UC Berkeley — 2018</p>
        </section>
      </aside>
      <main class="content">
        <section>
          <h2>Summary</h2>
          <p>
            Builder with a track record of shipping high-impact features, optimizing cloud costs, and leading cross-functional delivery.
          </p>
        </section>
        <section>
          <h2>Experience</h2>
          <div class="job">
            <div class="job-header">
              <div>
                <div class="job-title">Senior Software Engineer</div>
                <div class="job-company">Tech Corp — San Francisco, CA</div>
              </div>
              <div class="job-dates">2020 — Present</div>
            </div>
            <ul>
              <li>Owned end-to-end delivery of microservice suite powering billing.</li>
              <li>Drove 30% latency reduction by redesigning data layer.</li>
              <li>Partnered with design to launch new dashboard used by 50k users.</li>
            </ul>
          </div>
          <div class="job">
            <div class="job-header">
              <div>
                <div class="job-title">Software Engineer</div>
                <div class="job-company">StartupXYZ — Remote</div>
              </div>
              <div class="job-dates">2018 — 2020</div>
            </div>
            <ul>
              <li>Built growth experiments that increased activation by 12%.</li>
              <li>Implemented observability stack (logs, traces, alerts).</li>
              <li>Improved CI throughput by parallelizing test suites.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  `;
}

function renderLayout(category: string) {
  switch (category) {
    case 'modern':
      return twoColumnBody();
    case 'corporate':
      return twoColumnBody();
    case 'creative':
      return singleColumnBody().replace('<div class="header">', '<div class="header" style="background: linear-gradient(90deg, var(--color-primary), var(--color-accent)); color: #fff; padding: 18px; border-radius: 12px; border: none;">');
    case 'traditional':
    default:
      return singleColumnBody();
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const templateId = params.id;
    const template = await getDesignTemplateById(supabase, templateId);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const colors = template.default_config?.color_scheme || {
      primary: '#1a73e8',
      secondary: '#6b7280',
      accent: '#22c55e',
    };
    const fonts = template.default_config?.font_family || {
      heading: `'Inter', system-ui, sans-serif`,
      body: `'Inter', system-ui, sans-serif`,
    };
    const lineHeight = template.default_config?.spacing_settings?.lineHeight || 1.6;
    const compact = template.default_config?.spacing_settings?.compact ?? false;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.name} Preview</title>
  <style>${buildStyles(colors, fonts, lineHeight, compact)}</style>
</head>
<body>
  <div class="resume ${template.category}">
    ${renderLayout(template.category)}
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating template preview:', error);

    const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Preview Error</title>
</head>
<body>
  <h1>Template Preview Error</h1>
  <p>Failed to generate preview. Please try again.</p>
  <p style="color: red;">${error instanceof Error ? error.message : 'Unknown error'}</p>
</body>
</html>`;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
}
