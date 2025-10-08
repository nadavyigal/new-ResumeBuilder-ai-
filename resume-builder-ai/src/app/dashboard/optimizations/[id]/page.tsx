"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@/lib/supabase";
import { ATSResumeTemplate } from "@/components/templates/ats-resume-template";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { OptimizedResume } from "@/lib/ai-optimizer";
import { DesignBrowser } from "@/components/design/DesignBrowser";
import { DesignCustomizer } from "@/components/design/DesignCustomizer";
import { UndoControls } from "@/components/design/UndoControls";

// Disable static generation for this dynamic page
export const dynamic = 'force-dynamic';

export default function OptimizationPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [optimizedResume, setOptimizedResume] = useState<OptimizedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Design feature state
  const [showDesignBrowser, setShowDesignBrowser] = useState(false);
  const [showDesignCustomizer, setShowDesignCustomizer] = useState(false);
  const [currentDesignAssignment, setCurrentDesignAssignment] = useState<any>(null);
  const [designLoading, setDesignLoading] = useState(false);

  const params = useParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchOptimizationData = async () => {
      try {
        const { id } = params;

        // First get the optimization data
        const { data: optimizationData, error: optError } = await supabase
          .from("optimizations")
          .select("rewrite_data, resume_id, jd_id")
          .eq("id", id)
          .single();

        if (optError) throw optError;

        // Then fetch the resume and job description separately
        const { data: resumeData, error: resumeError } = await supabase
          .from("resumes")
          .select("raw_text")
          .eq("id", optimizationData.resume_id)
          .single();

        if (resumeError) throw resumeError;

        const { data: jdData, error: jdError } = await supabase
          .from("job_descriptions")
          .select("raw_text")
          .eq("id", optimizationData.jd_id)
          .single();

        if (jdError) throw jdError;

        setResumeText(resumeData.raw_text || "");
        setJobDescriptionText(jdData.raw_text || "");
        setOptimizedResume(optimizationData.rewrite_data);

      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOptimizationData();
  }, [params, supabase]);

  // Fetch design assignment
  useEffect(() => {
    const fetchDesignAssignment = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/v1/design/${params.id}`);

        if (response.ok) {
          const data = await response.json();
          setCurrentDesignAssignment(data.assignment);
        } else if (response.status === 404) {
          // No design assigned yet - that's okay
          setCurrentDesignAssignment(null);
        }
      } catch (error) {
        console.error('Failed to fetch design assignment:', error);
      }
    };

    if (!loading) {
      fetchDesignAssignment();
    }
  }, [params.id, loading]);

  const handleTemplateSelect = async (templateId: string) => {
    setDesignLoading(true);
    try {
      const response = await fetch(`/api/v1/design/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ templateId })
      });

      if (!response.ok) {
        throw new Error('Failed to apply template');
      }

      const data = await response.json();
      setCurrentDesignAssignment(data.assignment);
      setShowDesignBrowser(false);
    } catch (error) {
      console.error('Failed to apply template:', error);
      alert('Failed to apply template');
    } finally {
      setDesignLoading(false);
    }
  };

  const handleDesignUpdate = async () => {
    // Refresh design assignment after customization
    try {
      const response = await fetch(`/api/v1/design/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentDesignAssignment(data.assignment);
      }
    } catch (error) {
      console.error('Failed to refresh design assignment:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.location.href = `/api/download/${params.id}?fmt=pdf`;
  };

  const handleDownloadDOCX = () => {
    window.location.href = `/api/download/${params.id}?fmt=docx`;
  };

  const handleCopyText = async () => {
    if (!optimizedResume) return;

    // Generate plain text version of resume
    const plainText = generatePlainTextResume(optimizedResume);

    try {
      await navigator.clipboard.writeText(plainText);
      alert('Resume copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy resume to clipboard');
    }
  };

  const generatePlainTextResume = (data: OptimizedResume): string => {
    let text = '';

    // Header
    text += `${data.contact.name}\n`;
    text += `${data.contact.location}\n`;
    text += `${data.contact.email} | ${data.contact.phone}\n`;
    if (data.contact.linkedin) text += `${data.contact.linkedin}\n`;
    if (data.contact.portfolio) text += `${data.contact.portfolio}\n`;
    text += '\n';

    // Summary
    text += 'PROFESSIONAL SUMMARY\n';
    text += `${data.summary}\n\n`;

    // Skills
    text += 'SKILLS\n';
    text += `Technical Skills: ${data.skills.technical.join(', ')}\n`;
    if (data.skills.soft.length > 0) {
      text += `Professional Skills: ${data.skills.soft.join(', ')}\n`;
    }
    text += '\n';

    // Experience
    text += 'EXPERIENCE\n';
    data.experience.forEach(exp => {
      text += `${exp.title}\n`;
      text += `${exp.company} | ${exp.location} | ${exp.startDate} – ${exp.endDate}\n`;
      exp.achievements.forEach(achievement => {
        text += `• ${achievement}\n`;
      });
      text += '\n';
    });

    // Education
    text += 'EDUCATION\n';
    data.education.forEach(edu => {
      text += `${edu.degree}\n`;
      text += `${edu.institution} | ${edu.location} | ${edu.graduationDate}\n\n`;
    });

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      text += 'CERTIFICATIONS\n';
      data.certifications.forEach(cert => {
        text += `• ${cert}\n`;
      });
      text += '\n';
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      text += 'PROJECTS\n';
      data.projects.forEach(project => {
        text += `${project.name}\n`;
        text += `${project.description}\n`;
        text += `Technologies: ${project.technologies.join(', ')}\n\n`;
      });
    }

    return text;
  };

  return (
    <div className="min-h-screen bg-muted/50 p-4 md:p-10">
      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3 items-center print:hidden">
        {/* Export Actions */}
        <div className="flex gap-3">
          <Button onClick={handleCopyText} variant="outline">
            📋 Copy as Text
          </Button>
          <Button onClick={handlePrint} variant="outline">
            🖨️ Print
          </Button>
          <Button onClick={handleDownloadPDF}>
            📄 Download PDF
          </Button>
          <Button onClick={handleDownloadDOCX} variant="outline">
            📝 Download DOCX
          </Button>
        </div>

        {/* Design Actions */}
        <div className="flex gap-3 ml-auto">
          <Button onClick={() => setShowDesignBrowser(true)} variant="outline">
            🎨 Change Design
          </Button>
          {currentDesignAssignment && (
            <Button onClick={() => setShowDesignCustomizer(true)}>
              ✨ Customize with AI
            </Button>
          )}
        </div>
      </div>

      {/* Design Controls (if customizations exist) */}
      {currentDesignAssignment?.customization && (
        <div className="mb-6 print:hidden">
          <UndoControls
            optimizationId={params.id as string}
            canUndo={!!currentDesignAssignment?.previous_customization_id}
            hasCustomizations={!!currentDesignAssignment?.customization}
            onUndo={handleDesignUpdate}
            onRevert={handleDesignUpdate}
          />
        </div>
      )}

      {/* Current Design Info */}
      {currentDesignAssignment && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Current Design: {currentDesignAssignment.template?.name || 'Default'}
              </p>
              {currentDesignAssignment.customization && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Customized • ATS Score: {currentDesignAssignment.template?.ats_score || 'N/A'}
                </p>
              )}
            </div>
            {currentDesignAssignment.template?.category && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium capitalize">
                {currentDesignAssignment.template.category}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Layout: Resume on Left, Chat on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: Optimized Resume (2/3 width) */}
        <div className="lg:col-span-2">
          {optimizedResume && (
            <ATSResumeTemplate data={optimizedResume} />
          )}
        </div>

        {/* Right Column: AI Chat (1/3 width) */}
        <div className="print:hidden">
          {optimizedResume && (
            <div className="sticky top-4 h-[calc(100vh-120px)]">
              <ChatSidebar optimizationId={params.id as string} />
            </div>
          )}
        </div>
      </div>

      {/* Original Data (Collapsible) - Below Everything */}
      <div className="grid gap-4 md:grid-cols-2 print:hidden">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Original Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
              {resumeText}
            </pre>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
              {jobDescriptionText}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Design Browser Modal */}
      <DesignBrowser
        isOpen={showDesignBrowser}
        onClose={() => setShowDesignBrowser(false)}
        currentTemplateId={currentDesignAssignment?.template?.id}
        optimizationId={params.id as string}
        onTemplateSelect={handleTemplateSelect}
      />

      {/* Design Customizer Modal */}
      <DesignCustomizer
        isOpen={showDesignCustomizer}
        onClose={() => setShowDesignCustomizer(false)}
        optimizationId={params.id as string}
        onCustomizationApplied={handleDesignUpdate}
      />
    </div>
  );
}
