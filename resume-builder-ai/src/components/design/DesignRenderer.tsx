/**
 * DesignRenderer Component
 * Renders the selected design template inline with user's resume data and customizations
 */

'use client';

import React, { useEffect, useState } from 'react';
import { OptimizedResume } from '@/lib/ai-optimizer';
import { ATSResumeTemplate } from '@/components/templates/ats-resume-template';

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

  useEffect(() => {
    async function loadTemplate() {
      try {
        setLoading(true);
        setError(null);

        // Use default ATS template if no template is selected
        if (!templateSlug) {
          setTemplateComponent(() => ATSResumeTemplate);
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

        // Fallback to ATS template
        setTemplateComponent(() => ATSResumeTemplate);
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

  if (!TemplateComponent) {
    return (
      <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">No template loaded</p>
      </div>
    );
  }

  // Transform data for external templates (they expect JSON Resume format)
  // ATS template uses OptimizedResume format directly
  const componentData = templateSlug ? transformResumeData(resumeData) : resumeData;

  return (
    <div className="resume-wrapper bg-white rounded-lg shadow-lg overflow-hidden" style={{ isolation: 'isolate' }}>
      <div className="resume-container" key={renderKey}>
        <TemplateComponent data={componentData} customization={customization} />
      </div>
    </div>
  );
}
