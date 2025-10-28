"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@/lib/supabase";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { OptimizedResume } from "@/lib/ai-optimizer";
import { DesignBrowser } from "@/components/design/DesignBrowser";
import { DesignRenderer } from "@/components/design/DesignRenderer";
import { UndoControls } from "@/components/design/UndoControls";
import { SectionSelectionProvider } from "@/hooks/useSectionSelection";
import { CacheBustingErrorBoundary } from "@/components/error/CacheBustingErrorBoundary";
import { CompactATSScoreCard } from "@/components/ats/CompactATSScoreCard";


// Disable static generation for this dynamic page
export const dynamic = 'force-dynamic';

export default function OptimizationPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [optimizedResume, setOptimizedResume] = useState<OptimizedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);

  // ATS v2 state
  const [atsV2Data, setAtsV2Data] = useState<any>(null);
  const [atsSuggestions, setAtsSuggestions] = useState<any[]>([]);

  // CRITICAL: Do not remove! Used by handleChatMessageSent and handleDesignUpdate callbacks
  // Removing this state will cause runtime crashes when designs change
  const [refreshKey, setRefreshKey] = useState(0);

  // Design feature state
  const [showDesignBrowser, setShowDesignBrowser] = useState(false);
  const [currentDesignAssignment, setCurrentDesignAssignment] = useState<any>(null);
  const [designLoading, setDesignLoading] = useState(false);
  // Ephemeral customization from chat for instant preview
  const [ephemeralCustomization, setEphemeralCustomization] = useState<any>(null);

  // Job description data for Apply functionality
  const [jobDescription, setJobDescription] = useState<any>(null);
  const [jobDescriptionSummary, setJobDescriptionSummary] = useState<string>("");
  const [applying, setApplying] = useState(false);

  const params = useParams();
  const supabase = createClientComponentClient();

  const generateJobDescriptionSummary = (jdData: any) => {
    try {
      const parts: string[] = [];

      // Extract key information
      if (jdData.title && jdData.company) {
        parts.push(`**${jdData.title}** at **${jdData.company}**`);
      }

      if (jdData.extracted_data?.location) {
        parts.push(`📍 ${jdData.extracted_data.location}`);
      }

      // Add about section
      if (jdData.extracted_data?.about_this_job) {
        const about = jdData.extracted_data.about_this_job;
        const summary = about.length > 200 ? about.substring(0, 200) + '...' : about;
        parts.push(`\n**About:** ${summary}`);
      }

      // Add top 3 requirements
      if (jdData.extracted_data?.requirements && jdData.extracted_data.requirements.length > 0) {
        const topReqs = jdData.extracted_data.requirements.slice(0, 3);
        parts.push(`\n**Key Requirements:**`);
        topReqs.forEach((req: string) => {
          parts.push(`• ${req}`);
        });
        if (jdData.extracted_data.requirements.length > 3) {
          parts.push(`...and ${jdData.extracted_data.requirements.length - 3} more`);
        }
      }

      // Add top 3 responsibilities
      if (jdData.extracted_data?.responsibilities && jdData.extracted_data.responsibilities.length > 0) {
        const topResp = jdData.extracted_data.responsibilities.slice(0, 3);
        parts.push(`\n**Key Responsibilities:**`);
        topResp.forEach((resp: string) => {
          parts.push(`• ${resp}`);
        });
        if (jdData.extracted_data.responsibilities.length > 3) {
          parts.push(`...and ${jdData.extracted_data.responsibilities.length - 3} more`);
        }
      }

      const summary = parts.join('\n');
      setJobDescriptionSummary(summary);
    } catch (error) {
      console.error('Failed to generate job description summary:', error);
      // Fallback to simple summary
      const fallback = jdData.title && jdData.company
        ? `${jdData.title} at ${jdData.company}`
        : 'Job description details available below';
      setJobDescriptionSummary(fallback);
    }
  };

  const fetchOptimizationData = async () => {
    try {
      const idVal = String(params.id || "");

      // First get the optimization data including match_score and ATS v2 data
      // Use maybeSingle() instead of single() to avoid 406 errors
      const { data: optimizationRow, error: optError } = await supabase
        .from("optimizations")
        .select("rewrite_data, resume_id, jd_id, match_score, ats_version, ats_score_original, ats_score_optimized, ats_subscores, ats_suggestions, ats_confidence")
        .eq("id", idVal)
        .maybeSingle();

      if (optError) {
        console.error('Error fetching optimization:', optError);
        throw new Error(`Failed to load optimization: ${optError.message}`);
      }

      if (!optimizationRow) {
        throw new Error('Optimization not found');
      }

      // Then fetch the resume and job description separately
      const { data: resumeData, error: resumeError } = await supabase
        .from("resumes")
        .select("raw_text")
        .eq("id", (optimizationRow as any).resume_id)
        .maybeSingle();

      if (resumeError) {
        console.error('Error fetching resume:', resumeError);
        throw new Error(`Failed to load resume: ${resumeError.message}`);
      }

      if (!resumeData) {
        throw new Error('Resume not found');
      }

      const { data: jdData, error: jdError } = await supabase
        .from("job_descriptions")
        .select("raw_text, clean_text, extracted_data, title, company, source_url")
        .eq("id", (optimizationRow as any).jd_id)
        .maybeSingle();

      if (jdError) {
        console.error('Error fetching job description:', jdError);
        throw new Error(`Failed to load job description: ${jdError.message}`);
      }

      if (!jdData) {
        throw new Error('Job description not found');
      }

      setResumeText((resumeData as any)?.raw_text || "");
      // Use clean_text if available, otherwise fall back to raw_text
      setJobDescriptionText((jdData as any)?.clean_text || (jdData as any)?.raw_text || "");
      setJobDescription(jdData as any); // Store full job description for Apply button (includes title/company/source_url)
      setOptimizedResume((optimizationRow as any).rewrite_data);
      setMatchScore((optimizationRow as any).match_score);

      // Set ATS v2 data if available
      const row = optimizationRow as any;
      if (row.ats_version === 2 && row.ats_score_optimized !== null) {
        setAtsV2Data({
          ats_score_original: row.ats_score_original,
          ats_score_optimized: row.ats_score_optimized,
          subscores: row.ats_subscores,
          confidence: row.ats_confidence,
        });
        setAtsSuggestions(row.ats_suggestions || []);
      }

      // Generate AI summary of job description
      generateJobDescriptionSummary(jdData as any);

    } catch (error: any) {
      console.error('Error in fetchOptimizationData:', error);
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
      const idVal2 = String(params.id || "");

      console.log('🔄 Chat message sent, refreshing resume data...');

      // Add delay to ensure database has been updated (increased to 2s for reliability)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh resume content with force update
      // Use maybeSingle() instead of single() to avoid 406 errors
      const { data: optimizationRow, error: optError } = await supabase
        .from("optimizations")
        .select("rewrite_data")
        .eq("id", idVal2)
        .maybeSingle();

      if (optError) {
        console.error('❌ Error fetching optimization data:', optError);
      } else if (optimizationRow) {
        console.log('✅ Refreshed resume data after chat message');
        console.log('📊 Resume sections:', Object.keys((optimizationRow as any).rewrite_data || {}));

        // Log sample of data to verify changes
        if ((optimizationRow as any).rewrite_data?.skills) {
          console.log('🔧 Current skills:', (optimizationRow as any).rewrite_data.skills);
        }

        // Force a complete re-render by creating new object reference
        const newData = JSON.parse(JSON.stringify((optimizationRow as any).rewrite_data));
        setOptimizedResume(newData);
        // Force component re-render
        setRefreshKey(prev => prev + 1);
      } else {
        console.error('❌ No optimization data returned after refresh');
      }

      // Refresh design assignment (in case of design customization)
      const response = await fetch(`/api/v1/design/${idVal2}`, {
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

  // Fetch design assignment - BUT ONLY if user has explicitly selected a design
  // By default, show natural design (no template)
  useEffect(() => {
    const fetchDesignAssignment = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/v1/design/${params.id}`);

        if (response.ok) {
          const data = await response.json();
          // IMPORTANT: Only apply design if user explicitly selected one
          // For now, we'll show natural design by default and let user choose
          // Comment out to disable auto-loading of previously assigned designs:
          // setCurrentDesignAssignment(data.assignment);
          setCurrentDesignAssignment(null); // Always start with natural design
        } else if (response.status === 404) {
          // No design assigned yet - show natural design
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

  const handleTemplateSelect = useCallback(async (templateId: string) => {
    // Don't allow multiple simultaneous design changes
    if (designLoading) {
      console.log('Design change already in progress, ignoring request');
      return;
    }

    console.log('Starting design change to template:', templateId);
    setShowDesignBrowser(false);
    setDesignLoading(true);

    try {
      const response = await fetch(`/api/v1/design/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ templateId })
      });

      if (!response.ok) {
        throw new Error('Failed to apply template');
      }

      const data = await response.json();
      console.log('Design updated successfully:', data.assignment?.template?.slug);

      // Update design assignment - this will trigger DesignRenderer's useEffect
      setCurrentDesignAssignment(data.assignment || null);

      // Remove the 500ms delay - let React handle the state update naturally
      // The DesignRenderer component will manage the transition smoothly

    } catch (error) {
      console.error('Failed to apply template:', error);
      alert('Failed to apply template. Please try again.');
    } finally {
      setDesignLoading(false);
      console.log('Design change complete');
    }
  }, [params.id, designLoading]);

  const handleDesignUpdate = async () => {
    // Refresh design assignment after customization
    try {
      const response = await fetch(`/api/v1/design/${params.id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Deep clone to ensure React detects the change
        setCurrentDesignAssignment(data.assignment ? JSON.parse(JSON.stringify(data.assignment)) : null);
        // Force re-render to show updated design
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to refresh design assignment:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading optimization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Error Loading Optimization</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = '/dashboard/applications'}
                className="w-full px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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

      // Build HTML snapshot from current DOM renderer
      const resumeContainer = document.querySelector('.resume-container') || document.body;
      const html = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8"/>\n<title>${jobDescription.title} - ${jobDescription.company}</title>\n</head>\n<body>${resumeContainer.outerHTML}</body>\n</html>`;

      // Prepare metadata
      const contact = optimizedResume?.contact || null;
      const atsScore = matchScore ?? null;

      // Call API to persist snapshot
      const res = await fetch('/api/v1/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          url: jobDescription.source_url || null, // Trigger job extraction to get real company name
          optimizationId: String(params.id || ''),
          jobTitle: jobDescription.title,
          company: jobDescription.company,
          atsScore,
          contact,
          jobUrl: jobDescription.source_url || null,
          appliedDate: new Date().toISOString(),
        })
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to save application snapshot');
      }

      // Navigate to History table after apply
      window.location.href = `/dashboard/applications`;

    } catch (error) {
      console.error('Error in handleApply:', error);
      alert('Failed to process application. Please try again.');
      setApplying(false);
    }
  };

  return (
    <CacheBustingErrorBoundary>
    <div className="min-h-screen bg-muted/50 p-4 md:p-10">
      {/* Page Header with Navigation */}
      <div className="mb-4 flex justify-between items-center print:hidden">
        <Link href="/dashboard/applications" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
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

      {/* Top Row: Current Design (Left) | ATS Score (Right) - Matches resume and chat widths exactly */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Current Design Info - Left side (2/3 width) - Exactly matches Resume width */}
        <div className="lg:col-span-2">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Current Design: {currentDesignAssignment?.template?.name || 'Natural (Clean Format)'}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  {currentDesignAssignment?.template?.description || 'Professional plain format • Click "Change Design" to browse templates'}
                </p>
              </div>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium whitespace-nowrap ml-4">
                ATS-Friendly
              </span>
            </div>
          </div>
        </div>

        {/* ATS Match Score - Right side (1/3 width) - Exactly matches AI Assistant width */}
        {matchScore !== null && (
          <div className="lg:col-span-1">
            {atsV2Data ? (
              <CompactATSScoreCard
                atsScoreOriginal={atsV2Data.ats_score_original || matchScore}
                atsScoreOptimized={atsV2Data.ats_score_optimized || matchScore}
                subscores={atsV2Data.subscores}
                subscoresOriginal={atsV2Data.subscores_original}
                legacy={false}
              />
            ) : (
              <CompactATSScoreCard
                atsScoreOriginal={matchScore}
                atsScoreOptimized={matchScore}
                legacy={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Main Layout: Resume Preview (Left) | AI Assistant (Right) */}
      <SectionSelectionProvider>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: Resume Preview (2/3 width) - Below Current Design */}
        <div className="lg:col-span-2">
          {/* Optimized Resume - DesignRenderer handles its own loading and transitions */}
          {optimizedResume && (
            <DesignRenderer
              key={refreshKey}
              resumeData={optimizedResume}
              templateSlug={currentDesignAssignment?.template?.slug}
              customization={ephemeralCustomization || currentDesignAssignment?.customization}
            />
          )}
        </div>

        {/* Right Column: AI Chat (1/3 width) - Below ATS Score */}
        <div className="print:hidden">
          {optimizedResume && (
            <div className="sticky top-4 h-[calc(100vh-220px)]">
              <ChatSidebar
                optimizationId={params.id as string}
                onMessageSent={handleChatMessageSent}
                onDesignPreview={(c) => setEphemeralCustomization(c)}
                atsSuggestions={atsSuggestions}
              />
            </div>
          )}
        </div>
      </div>
      </SectionSelectionProvider>

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
            <CardTitle>Job Description Summary</CardTitle>
            {jobDescription?.source_url && (
              <p className="text-xs text-muted-foreground mt-1">
                Source: <a href={jobDescription.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                  {jobDescription.source_url}
                </a>
              </p>
            )}
          </CardHeader>
          <CardContent>
            {/* AI-Generated Summary - Prominent display */}
            {jobDescriptionSummary && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-2xl">💼</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
                      Quick Summary
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                      {jobDescriptionSummary.split('\n').map((line, idx) => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) return <div key={idx} className="h-2" />;

                        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                          return <p key={idx} className="font-bold text-gray-900 dark:text-gray-100 mb-2 mt-2">{trimmedLine.replace(/\*\*/g, '')}</p>;
                        } else if (trimmedLine.startsWith('•')) {
                          return <p key={idx} className="text-sm text-gray-700 dark:text-gray-300 ml-4 mb-1.5 leading-relaxed">{trimmedLine}</p>;
                        } else if (trimmedLine.startsWith('📍')) {
                          return <p key={idx} className="text-sm text-gray-600 dark:text-gray-400 mb-2">{trimmedLine}</p>;
                        } else {
                          return <p key={idx} className="text-sm text-gray-700 dark:text-gray-300 mb-1.5 leading-relaxed">{trimmedLine}</p>;
                        }
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
    </div>
    </CacheBustingErrorBoundary>
  );
}
