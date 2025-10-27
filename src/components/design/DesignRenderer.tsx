/**
 * DesignRenderer Component
 * Renders the selected design template inline with user's resume data and customizations
 */

'use client';

import React, { useEffect, useState } from 'react';
import { OptimizedResume } from '@/lib/ai-optimizer';
import { ATSResumeTemplate } from '@/components/templates/ats-resume-template';
import { useSectionSelection } from '@/hooks/useSectionSelection';

interface DesignRendererProps {
  resumeData: OptimizedResume;
  templateSlug?: string;
  customization?: any;
}

/**
 * Transform OptimizedResume to format expected by external templates (JSON Resume format)
 */
function transformResumeData(data: OptimizedResume): any {
  return {
    basics: {
      name: data.contact?.name || '',
      email: data.contact?.email || '',
      phone: data.contact?.phone || '',
      location: {
        city: data.contact?.location || ''
      },
      profiles: data.contact?.linkedin
        ? [
            {
              network: 'LinkedIn',
              url: data.contact.linkedin
            }
          ]
        : [],
      website: data.contact?.portfolio || ''
    },
    summary: data.summary || '',
    work: (data.experience || []).map((exp) => ({
      name: exp.company || '',
      position: exp.title || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || 'Present',
      location: exp.location || '',
      highlights: exp.achievements || []
    })),
    education: (data.education || []).map((edu) => ({
      institution: edu.institution || '',
      area: edu.degree || '',
      studyType: edu.degree || '',
      endDate: edu.graduationDate || '',
      location: edu.location || ''
    })),
    skills: [
      ...(data.skills?.technical || []).map((skill) => ({
        name: skill,
        level: 'Technical',
        keywords: []
      })),
      ...(data.skills?.soft || []).map((skill) => ({
        name: skill,
        level: 'Soft',
        keywords: []
      }))
    ],
    certificates: (data.certifications || []).map((cert) =>
      typeof cert === 'string'
        ? { name: cert, date: '', issuer: '', url: '' }
        : cert
    ),
    projects: (data.projects || []).map((project) => ({
      name: project.name || '',
      description: project.description || '',
      keywords: project.technologies || []
    }))
  };
}

/**
 * External Template Renderer (for templates that return full HTML documents)
 * Renders in iframe using server-side API endpoint
 */
function ExternalTemplateRenderer({
  resumeData,
  templateSlug,
  customization
}: DesignRendererProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!templateSlug || !resumeData) {
      setHtmlContent('');
      setLoading(false);
      return;
    }

    const fetchHtml = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/v1/design/render-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateId: templateSlug,
            resumeData: resumeData,
            customization: customization || {}
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        setHtmlContent(html);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching template HTML:', err);
        setError('Failed to render template');
        setHtmlContent('');
        setLoading(false);
      }
    };

    fetchHtml();
  }, [templateSlug, resumeData, customization]);

  if (loading) {
    return (
      <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '1100px' }}>
        <div className="text-gray-500">Loading template...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '1100px' }}>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden" style={{ isolation: 'isolate' }}>
      <iframe
        srcDoc={htmlContent}
        title="Resume Preview"
        className="w-full border-0"
        style={{
          minHeight: '1100px',
          height: '100%'
        }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

/**
 * Internal Template Renderer (for templates that are React components)
 * Renders directly with section selection support
 */
function InternalTemplateRenderer({
  resumeData,
  templateSlug,
  customization
}: DesignRendererProps) {
  const [TemplateComponent, setTemplateComponent] = useState<React.ComponentType<any> | null>(
    null
  );
  const [previousComponent, setPreviousComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
	const { beginSelection } = useSectionSelection();

	function handleMouseUp() {
		try {
			const sel = window.getSelection();
			if (!sel || sel.isCollapsed) return;
			const text = sel.toString().trim();
			if (!text || text.length < 2) return;

			let field: 'bullet' | 'summary' | 'title' | 'skills' | 'custom' = 'custom';
			let sectionId = 'custom';

			const anchorNode = sel.anchorNode as Node | null;
			const el = (anchorNode && (anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode.parentElement)) as Element | null;
			let current: Element | null = el;
			while (current) {
				const ds = (current as HTMLElement).dataset;
				if (ds && (ds.sectionId || ds.field)) {
					sectionId = ds.sectionId || sectionId;
					field = (ds.field as any) || field;
					break;
				}
				current = current.parentElement;
			}

			// Heuristic: list items are bullets
			if (field === 'custom' && el && el.closest('li')) {
				field = 'bullet';
			}

			beginSelection(sectionId, field, text.slice(0, 600));
		} catch {}
	}

  useEffect(() => {
    async function loadTemplate() {
      try {
        // When template changes, mark as transitioning but DON'T show loading
        setIsTransitioning(true);
        setError(null);

        // If no template slug provided, show "natural" (no design) state
        if (!templateSlug) {
          setPreviousComponent(TemplateComponent);
          setTemplateComponent(null);
          setLoading(false);
          setIsTransitioning(false);
          return;
        }

        // Use default ATS template for explicit safe/default selections
        if (templateSlug === 'ats-safe' || templateSlug === 'default') {
          setPreviousComponent(TemplateComponent);
          setTemplateComponent(() => ATSResumeTemplate);
          setLoading(false);
          setIsTransitioning(false);
          return;
        }

        // Only load external templates if explicitly selected
        const validExternalTemplates = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];

        if (!validExternalTemplates.includes(templateSlug)) {
          console.warn(`Unknown template slug: ${templateSlug}, falling back to natural (no design)`);
          setPreviousComponent(TemplateComponent);
          setTemplateComponent(null);
          setLoading(false);
          setIsTransitioning(false);
          return;
        }

        // Save current component as previous before loading new one
        setPreviousComponent(TemplateComponent);

        // Dynamically import the selected external template
        // This may trigger Next.js recompilation, but UI stays stable
        const templateModule = await import(
          `@/lib/templates/external/${templateSlug}/Resume.jsx`
        );

        setTemplateComponent(() => templateModule.default);
        setLoading(false);
        setIsTransitioning(false);
      } catch (err) {
        console.error('Error loading template:', err);
        setError('Failed to load template');
        setLoading(false);
        setIsTransitioning(false);

        // Clear both components to show clean error state
        setPreviousComponent(null);
        setTemplateComponent(null);
      }
    }

    loadTemplate();
  }, [templateSlug, TemplateComponent]); // Add TemplateComponent to dependencies

  // Force re-render when resumeData changes
  // Only update if not loading/transitioning to avoid race conditions
  const [renderKey, setRenderKey] = useState(0);
  useEffect(() => {
    if (!loading && !isTransitioning) {
      setRenderKey(prev => prev + 1);
    }
  }, [resumeData, customization, loading, isTransitioning]);

  // Apply customization styles (scoped to resume container only)
  useEffect(() => {
    const styleId = 'design-customization-styles';

    if (!customization) {
      // Clean up any existing style tag when customization is removed
      const existingTag = document.getElementById(styleId);
      if (existingTag?.parentNode) {
        existingTag.parentNode.removeChild(existingTag);
      }
      return;
    }

    // Remove any existing tag first to avoid duplicates
    const existingTag = document.getElementById(styleId);
    if (existingTag?.parentNode) {
      existingTag.parentNode.removeChild(existingTag);
    }

    // Create new style tag
    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    document.head.appendChild(styleTag);

    // Build CSS from customization - PROPERLY SCOPED to .resume-container only
    let css = '';

    if (customization.color_scheme) {
      // Scope CSS variables to resume-container only (not :root)
      css += `
        .resume-container {
          --resume-primary-color: ${customization.color_scheme.primary || '#2563eb'};
          --resume-secondary-color: ${customization.color_scheme.secondary || '#64748b'};
          --resume-accent-color: ${customization.color_scheme.accent || '#0ea5e9'};
          --resume-background-color: ${customization.color_scheme.background || '#ffffff'};
          --resume-text-color: ${customization.color_scheme.text || '#1f2937'};
        }
      `;
    }

    if (customization.font_family) {
      css += `
        .resume-container h1, .resume-container h2, .resume-container h3 {
          font-family: ${customization.font_family.heading || 'Arial'}, sans-serif;
        }
        .resume-container, .resume-container p, .resume-container li {
          font-family: ${customization.font_family.body || 'Arial'}, sans-serif;
        }
      `;
    }

    if (customization.spacing) {
      css += `
        .resume-container {
          line-height: ${customization.spacing.line_height || '1.6'};
        }
        .resume-container .resume-section {
          margin-bottom: ${customization.spacing.section_gap || '1.5rem'};
        }
      `;
    }

    if (customization.custom_css) {
      // Ensure custom CSS is also scoped
      css += customization.custom_css;
    }

    styleTag.textContent = css;

    // Cleanup
    return () => {
      if (styleTag && styleTag.parentNode) {
        styleTag.parentNode.removeChild(styleTag);
      }
    };
  }, [customization]);

  // Only show loading spinner on initial load, not during transitions
  if (loading && !previousComponent) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  // During transition, show previous component with overlay
  if (isTransitioning && previousComponent) {
    const PrevComp = previousComponent;
    const componentData = templateSlug ? transformResumeData(resumeData) : resumeData;

    return (
      <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden relative" style={{ isolation: 'isolate' }}>
        {/* Loading overlay during transition */}
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 z-50 flex items-center justify-center backdrop-blur-[2px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm font-medium text-muted-foreground">Switching design...</p>
          </div>
        </div>

        {/* Keep showing previous design underneath */}
        <div className="resume-container" key={renderKey} onMouseUp={handleMouseUp}>
          <PrevComp data={componentData} customization={customization} />
        </div>
      </div>
    );
  }

  if (error && !TemplateComponent) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
        <p className="text-sm text-red-600 mt-2">Falling back to default template...</p>
      </div>
    );
  }

  // If no template component, render natural (plain) resume with clean, professional styling
  if (!TemplateComponent) {
    return (
      <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden p-8 max-w-4xl mx-auto" style={{ isolation: 'isolate' }}>
        <div className="resume-container" key={renderKey} onMouseUp={handleMouseUp}>
          <header className="mb-6 pb-4 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{resumeData.contact?.name}</h1>
            <div className="text-gray-600 mb-1">{resumeData.contact?.location}</div>
            <div className="text-gray-600 text-sm">
              {resumeData.contact?.email} | {resumeData.contact?.phone}
            </div>
            {resumeData.contact?.linkedin && <div className="text-blue-600 text-sm mt-1">{resumeData.contact.linkedin}</div>}
            {resumeData.contact?.portfolio && <div className="text-blue-600 text-sm">{resumeData.contact.portfolio}</div>}
          </header>

          {resumeData.summary && (
            <section data-section-id="summary" className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-300">Professional Summary</h2>
              <p data-field="summary" className="text-gray-700 leading-relaxed">{resumeData.summary}</p>
            </section>
          )}

          {resumeData.skills && (
            <section data-section-id="skills" className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-300">Skills</h2>
              {resumeData.skills.technical && resumeData.skills.technical.length > 0 && (
                <p data-field="skills" className="text-gray-700 mb-2">
                  <span className="font-medium">Technical:</span> {resumeData.skills.technical.join(', ')}
                </p>
              )}
              {resumeData.skills.soft && resumeData.skills.soft.length > 0 && (
                <p data-field="skills" className="text-gray-700">
                  <span className="font-medium">Professional:</span> {resumeData.skills.soft.join(', ')}
                </p>
              )}
            </section>
          )}

          {Array.isArray(resumeData.experience) && resumeData.experience.length > 0 && (
            <section data-section-id="experience" className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-300">Experience</h2>
              {resumeData.experience.map((exp, index) => (
                <article key={index} data-section-id={`experience-${index}`} className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">{exp.title}</h3>
                  <div className="text-gray-600 text-sm mb-2">
                    {exp.company} | {exp.location} | {exp.startDate} – {exp.endDate}
                  </div>
                  {Array.isArray(exp.achievements) && exp.achievements.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1">
                      {exp.achievements.map((achievement, i) => (
                        <li key={i} data-field="bullet" className="text-gray-700 leading-relaxed">{achievement}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </section>
          )}

          {Array.isArray(resumeData.education) && resumeData.education.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-300">Education</h2>
              {resumeData.education.map((edu, index) => (
                <article key={index} className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">{edu.degree}</h3>
                  <div className="text-gray-600 text-sm">
                    {edu.institution} | {edu.location} | {edu.graduationDate}
                  </div>
                </article>
              ))}
            </section>
          )}

          {Array.isArray(resumeData.certifications) && resumeData.certifications.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-300">Certifications</h2>
              <ul className="list-disc pl-5 space-y-1">
                {resumeData.certifications.map((cert, index) => (
                  <li key={index} className="text-gray-700">{typeof cert === 'string' ? cert : cert.name}</li>
                ))}
              </ul>
            </section>
          )}

          {Array.isArray(resumeData.projects) && resumeData.projects.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-300">Projects</h2>
              {resumeData.projects.map((project, index) => (
                <article key={index} className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                  <p className="text-gray-700 mb-1">{project.description}</p>
                  {Array.isArray(project.technologies) && project.technologies.length > 0 && (
                    <div className="text-gray-600 text-sm">
                      <span className="font-medium">Technologies:</span> {project.technologies.join(', ')}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      </div>
    );
  }

  // Transform data for external templates (they expect JSON Resume format)
  // ATS template uses OptimizedResume format directly
  // Ensure we always have valid data, even if resumeData is null/undefined during transitions
  const componentData = templateSlug && resumeData
    ? transformResumeData(resumeData)
    : (resumeData || {});

  return (
    <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden" style={{ isolation: 'isolate' }}>
      <div className="resume-container" key={renderKey} onMouseUp={handleMouseUp}>
        <TemplateComponent data={componentData} customization={customization} />
      </div>
    </div>
  );
}

/**
 * Main DesignRenderer Component
 * Routes to appropriate renderer based on template type
 */
export function DesignRenderer({
  resumeData,
  templateSlug,
  customization
}: DesignRendererProps) {
  // Check if this is an external template
  const isExternalTemplate = templateSlug && ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'].includes(templateSlug);

  // Route to appropriate renderer
  if (isExternalTemplate) {
    return (
      <ExternalTemplateRenderer
        resumeData={resumeData}
        templateSlug={templateSlug}
        customization={customization}
      />
    );
  }

  return (
    <InternalTemplateRenderer
      resumeData={resumeData}
      templateSlug={templateSlug}
      customization={customization}
    />
  );
}
