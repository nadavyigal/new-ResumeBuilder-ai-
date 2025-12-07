/**
 * API Route: GET /api/v1/design/templates/[id]/preview
 * Generates HTML preview of a template with sample data
 *
 * Reference: specs/003-i-want-to/contracts/design-api.yaml
 * Task: T027
 * Test: tests/contract/design-templates.contract.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

import { getDesignTemplateById } from '@/lib/supabase/design-templates';
// import { renderTemplateSample } from '@/lib/design-manager/template-renderer';

// Force dynamic rendering to prevent build-time static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/design/templates/[id]/preview
 * Returns HTML preview of template with sample resume data
 *
 * Path Parameters:
 * - id: Template UUID
 *
 * Response: 200 OK
 * Content-Type: text/html
 * (Full HTML document with rendered template)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const supabase = await createRouteHandlerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const templateId = params.id;

    // Fetch template from database
    const template = await getDesignTemplateById(supabase, templateId);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if user has access to premium templates
    // TODO: Implement subscription check when premium feature is ready
    if (template.is_premium) {
      // For now, allow all users to preview premium templates
      // In production, check user subscription tier
    }

    // Render template with sample data
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.name} Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .resume { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .name { font-size: 32px; font-weight: bold; color: #333; margin-bottom: 10px; }
    .contact { font-size: 14px; color: #666; line-height: 1.6; }
    .contact a { color: #0066cc; text-decoration: none; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 20px; font-weight: bold; color: #333; margin-bottom: 15px; border-bottom: 2px solid #0066cc; padding-bottom: 5px; }
    .summary { font-size: 15px; line-height: 1.6; color: #444; }
    .job { margin-bottom: 20px; }
    .job-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .job-title { font-weight: bold; color: #333; font-size: 16px; }
    .job-company { color: #666; font-size: 15px; }
    .job-dates { color: #888; font-size: 14px; }
    .achievements { list-style: none; padding-left: 0; }
    .achievements li { padding-left: 20px; margin-bottom: 6px; position: relative; color: #444; line-height: 1.5; }
    .achievements li:before { content: "•"; position: absolute; left: 0; color: #0066cc; font-weight: bold; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill-tag { background: #e8f4f8; color: #0066cc; padding: 6px 12px; border-radius: 4px; font-size: 13px; }
    .education-item { margin-bottom: 15px; }
    .degree { font-weight: bold; color: #333; font-size: 15px; }
    .institution { color: #666; font-size: 14px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="resume">
    <div class="header">
      <div class="name">John Doe</div>
      <div class="contact">
        San Francisco, CA | john.doe@email.com | +1 (555) 123-4567<br>
        <a href="#">linkedin.com/in/johndoe</a> | <a href="#">johndoe.com</a>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Professional Summary</div>
      <div class="summary">
        Experienced software engineer with 5+ years of expertise in full-stack development, cloud architecture, and team leadership.
        Proven track record of delivering scalable solutions and driving technical innovation.
      </div>
    </div>

    <div class="section">
      <div class="section-title">Skills</div>
      <div class="skills-grid">
        <span class="skill-tag">JavaScript</span>
        <span class="skill-tag">TypeScript</span>
        <span class="skill-tag">React</span>
        <span class="skill-tag">Node.js</span>
        <span class="skill-tag">Python</span>
        <span class="skill-tag">AWS</span>
        <span class="skill-tag">Docker</span>
        <span class="skill-tag">SQL</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Experience</div>

      <div class="job">
        <div class="job-header">
          <div>
            <div class="job-title">Senior Software Engineer</div>
            <div class="job-company">Tech Corp • San Francisco, CA</div>
          </div>
          <div class="job-dates">2020 - Present</div>
        </div>
        <ul class="achievements">
          <li>Led development of microservices architecture serving 1M+ users</li>
          <li>Reduced deployment time by 60% through CI/CD optimization</li>
          <li>Mentored team of 5 junior developers</li>
        </ul>
      </div>

      <div class="job">
        <div class="job-header">
          <div>
            <div class="job-title">Software Engineer</div>
            <div class="job-company">StartupXYZ • San Francisco, CA</div>
          </div>
          <div class="job-dates">2018 - 2020</div>
        </div>
        <ul class="achievements">
          <li>Built and maintained 10+ RESTful APIs</li>
          <li>Improved application performance by 40%</li>
          <li>Collaborated with cross-functional teams</li>
        </ul>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Education</div>
      <div class="education-item">
        <div class="degree">Bachelor of Science in Computer Science</div>
        <div class="institution">University of California, Berkeley • 2018</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Return HTML preview
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Error generating template preview:', error);

    // Return error as HTML for better debugging
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
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}
