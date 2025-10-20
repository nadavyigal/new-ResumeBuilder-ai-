/**
 * DesignRenderer Component
 * Renders the selected design template inline with user's resume data and customizations
 */

'use client';

import React, { useEffect, useState } from 'react';
import { OptimizedResume } from '@/lib/ai-optimizer';
import { ATSResumeTemplate } from '@/components/templates/ats-resume-template';
import { useSectionSelection } from '@/hooks/useSectionSelection.tsx';

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
 * Dynamically loads and renders the appropriate template
 */
export function DesignRenderer({
  resumeData,
  templateSlug,
  customization
}: DesignRendererProps) {
  const [TemplateComponent, setTemplateComponent] = useState<React.ComponentType<any> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
        setLoading(true);
        setError(null);

        // If no template slug provided, show "natural" (no design) state
        // This renders a plain, unstyled resume
        if (!templateSlug) {
          setTemplateComponent(null);
          setLoading(false);
          return;
        }

        // Use default ATS template for explicit safe/default selections
        if (templateSlug === 'ats-safe' || templateSlug === 'default') {
          setTemplateComponent(() => ATSResumeTemplate);
          setLoading(false);
          return;
        }

        // Only load external templates if explicitly selected (minimal-ssr, card-ssr, sidebar-ssr, timeline-ssr)
        const validExternalTemplates = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];

        if (!validExternalTemplates.includes(templateSlug)) {
          console.warn(`Unknown template slug: ${templateSlug}, falling back to natural (no design)`);
          setTemplateComponent(null);
          setLoading(false);
          return;
        }

        // Dynamically import the selected external template
        const templateModule = await import(
          `@/lib/templates/external/${templateSlug}/Resume.jsx`
        );

        setTemplateComponent(() => templateModule.default);
        setLoading(false);
      } catch (err) {
        console.error('Error loading template:', err);
        setError('Failed to load template');
        setLoading(false);

        // Fallback to natural (no design)
        setTemplateComponent(null);
      }
    }

    loadTemplate();
  }, [templateSlug]);

  // Force re-render when resumeData changes
  const [renderKey, setRenderKey] = useState(0);
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [resumeData, customization]);

  // Apply customization styles (scoped to resume container only)
  useEffect(() => {
    if (!customization) return;

    const styleId = 'design-customization-styles';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-gray-600">Loading template...</p>
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
  const componentData = templateSlug ? transformResumeData(resumeData) : resumeData;

  return (
    <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden" style={{ isolation: 'isolate' }}>
      <div className="resume-container" key={renderKey} onMouseUp={handleMouseUp}>
        <TemplateComponent data={componentData} customization={customization} />
      </div>
    </div>
  );
}
