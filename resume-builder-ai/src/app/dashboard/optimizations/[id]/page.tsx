'use client'
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@/lib/supabase";
import { OptimizedResume } from "@/lib/ai-optimizer";
import { DesignBrowser } from "@/components/design/DesignBrowser";
import { DesignRenderer } from "@/components/design/DesignRenderer";
import { UndoControls } from "@/components/design/UndoControls";
import { AIAssistantSidebar } from "@/components/ai-assistant"; // T016: Import AIAssistantSidebar

// Disable static generation for this dynamic page
export const dynamic = 'force-dynamic';

export default function OptimizationPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [optimizedResume, setOptimizedResume] = useState<OptimizedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render key

  // Design feature state
  const [showDesignBrowser, setShowDesignBrowser] = useState(false);
  const [currentDesignAssignment, setCurrentDesignAssignment] = useState<any>(null);
  const [designLoading, setDesignLoading] = useState(false);

  // Job description data for Apply functionality
  const [jobDescription, setJobDescription] = useState<any>(null);
  const [applying, setApplying] = useState(false);

  // T016: AI Assistant state
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

  const params = useParams();
  const supabase = createClientComponentClient();

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
      setJobDescription(jdData); // Store full job description for Apply button
      setOptimizedResume(optimizationData.rewrite_data);

    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptimizationData();
  }, [params, supabase]);

  // Refresh resume data and design when chat sends a message
  const handleChatMessageSent = async () => {
    try {
      const { id } = params;

      console.log('🔄 Chat message sent, refreshing resume data...');

      // Add delay to ensure database has been updated (increased to 2s for reliability)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh resume content with force update
      const { data: optimizationData, error: optError } = await supabase
        .from("optimizations")
        .select("rewrite_data")
        .eq("id", id)
        .single();

      if (optError) {
        console.error('❌ Error fetching optimization data:', optError);
      } else if (optimizationData) {
        console.log('✅ Refreshed resume data after chat message');
        console.log('📊 Resume sections:', Object.keys(optimizationData.rewrite_data));

        // Log sample of data to verify changes
        if (optimizationData.rewrite_data.skills) {
          console.log('🔧 Current skills:', optimizationData.rewrite_data.skills);
        }

        // Force a complete re-render by creating new object reference
        const newData = JSON.parse(JSON.stringify(optimizationData.rewrite_data));
        setOptimizedResume(newData);
        // Force component re-render
        setRefreshKey(prev => prev + 1);
      } else {
        console.error('❌ No optimization data returned after refresh');
      }

      // Refresh design assignment (in case of design customization)
      const response = await fetch(`/api/v1/design/${id}`, {
        cache: 'no-store', // Ensure fresh data
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Refreshed design assignment after chat message');
        // Deep clone to ensure React detects the change
        setCurrentDesignAssignment(data.assignment ? JSON.parse(JSON.stringify(data.assignment)) : null);
        // Force component re-render
        setRefreshKey(prev => prev + 1);
      } else if (response.status !== 404) {
        // 404 is okay (no design assigned yet)
        console.error('Error fetching design assignment:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to refresh after chat:', error);
    }
  };

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

  const handleApply = async () => {
    if (!jobDescription) {
      alert('No job description found');
      return;
    }

    setApplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to apply');
        setApplying(false);
        return;
      }

      // Create application record via API to keep schema/types centralized
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optimizationId: params.id,
          jobTitle: jobDescription.title,
          companyName: jobDescription.company,
          jobUrl: jobDescription.source_url,
          status: 'applied',
          appliedDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to create application via API:', err);
        alert('Failed to save application. Please check the applications migration.');
        setApplying(false);
        return;
      }

      // Download PDF
      const id = params.id;
      const downloadLink = document.createElement('a');
      downloadLink.href = `/api/download/${id}?fmt=pdf`;
      downloadLink.download = `resume-${jobDescription.company}-${jobDescription.title}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Small delay to ensure download starts
      await new Promise(resolve => setTimeout(resolve, 500));

      // Open job URL if available
      if (jobDescription.source_url) {
        window.open(jobDescription.source_url, '_blank');
      }

      // Redirect to history page after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard/history';
      }, 1000);

    } catch (error) {
      console.error('Error in handleApply:', error);
      alert('Failed to process application. Please try again.');
      setApplying(false);
    }
  };

  const [showAiAssistant, setShowAiAssistant] = useState(false);

  useEffect(() => {
    const checkFeatureFlag = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('features')
          .eq('id', user.id)
          .single();
        
        const hasOverride = (profile as any)?.features?.includes('ai_assistant');
        const isEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_ASSISTANT === 'true' || hasOverride;
        setShowAiAssistant(isEnabled);

        // T036: Monitoring for feature flag checks (example)
        if (isEnabled) {
            console.log(`AI Assistant enabled for user ${user.id}`);
        }
      }
    };

    checkFeatureFlag();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-muted/50 p-4 md:p-10">
      {/* Page Header with Navigation */}
      <div className="mb-4 flex justify-between items-center print:hidden">
        <Link href="/dashboard/history" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          ← Back to History
        </Link>
        <div className="text-sm text-muted-foreground">
          {jobDescription?.title && `${jobDescription.title} at ${jobDescription.company}`}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3 items-center print:hidden">
        {/* Apply Button - Primary Action */}
        <Button onClick={handleApply} disabled={applying} className="bg-green-600 hover:bg-green-700">
          {applying ? '⏳ Applying...' : '✓ Apply Now'}
        </Button>

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

      {/* Current Design Info - Always show */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Current Design: {currentDesignAssignment?.template?.name || 'Natural (No Design)'}
            </p>
            {currentDesignAssignment?.customization && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Customized • ATS Score: {currentDesignAssignment.template?.ats_score || 'N/A'}
              </p>
            )}
            {!currentDesignAssignment && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Plain resume format • Click "Change Design" to apply a template
              </p>
            )}
          </div>
          {currentDesignAssignment?.template?.category && (
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium capitalize">
              {currentDesignAssignment.template.category}
            </span>
          )}
        </div>
      </div>

      {/* Main Layout: Resume on Left, Chat on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: Optimized Resume (2/3 width) */}
        <div className="lg:col-span-2" key={refreshKey}>
          {optimizedResume && (
            <DesignRenderer
              resumeData={optimizedResume}
              templateSlug={currentDesignAssignment?.template?.slug}
              customization={currentDesignAssignment?.customization}
            />
          )}
        </div>

        {/* Right Column: AI Chat (1/3 width) - Replaced by AIAssistantSidebar */}
        {/* <div className="print:hidden">
          {optimizedResume && (
            <div className="sticky top-4 h-[calc(100vh-120px)]">
              <ChatSidebar
                optimizationId={params.id as string}
                onMessageSent={handleChatMessageSent}
              />
            </div>
          )}
        </div> */}
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

      {/* T016 & T036: Floating Action Button for AI Assistant */}
      {showAiAssistant && (
        <div className="fixed bottom-4 right-4 print:hidden">
          <Button
            onClick={() => setIsAiAssistantOpen(true)}
            className="rounded-full w-14 h-14 shadow-lg bg-purple-600 hover:bg-purple-700 text-white text-lg"
            aria-label="Open AI Assistant"
          >
            🤖
          </Button>
        </div>
      )}

      {/* T016: AI Assistant Sidebar */}
      {isAiAssistantOpen && (
        <AIAssistantSidebar
          optimizationId={params.id as string}
          onClose={() => setIsAiAssistantOpen(false)}
        />
      )}
    </div>
  );
