"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/navigation";
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
import { useToast } from "@/hooks/useToast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale, useTranslations } from "next-intl";


// Disable static generation for this dynamic page
export const dynamic = 'force-dynamic';

export default function OptimizationPage() {
  const [resumeText, setResumeText] = useState("");
  const [optimizedResume, setOptimizedResume] = useState<OptimizedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [isDemoOptimization, setIsDemoOptimization] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  // Ephemeral customization from chat for instant preview
  const [ephemeralCustomization, setEphemeralCustomization] = useState<any>(null);

  // Language preference state
  const [languagePreference, setLanguagePreference] = useState<'auto' | 'hebrew' | 'english'>('auto');

  // Job description data for Apply functionality
  const [jobDescription, setJobDescription] = useState<any>(null);
  const [jobDescriptionSummary, setJobDescriptionSummary] = useState<string>("");
  const [applying, setApplying] = useState(false);

  // Pending changes for ATS tip highlighting
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);

  const params = useParams();
  const supabase = createClientComponentClient();
  const { toast } = useToast();
  const t = useTranslations("dashboard.optimization");
  const locale = useLocale();
  const designDescription = currentDesignAssignment?.template?.description || t("design.defaultDescription");
  const designSummaryLabel = locale === "he" ? t("design.changeDesign") : designDescription;

  useEffect(() => {
    // Set initial FAB position after mount (bottom-right)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setFabPosition({ x: vw - 84, y: vh - 180 });
  }, []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragging) return;
      setFabPosition(prev => ({
        x: Math.min(Math.max(12, e.clientX - dragOffset.current.x), window.innerWidth - 72),
        y: Math.min(Math.max(12, e.clientY - dragOffset.current.y), window.innerHeight - 72),
      }));
    };
    const handleUp = () => setDragging(false);
    if (dragging) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging]);

  const generateJobDescriptionSummary = (jdData: any) => {
    try {
      const parts: string[] = [];

      if (jdData.title && jdData.company) {
        const titleLine = t("jobSummary.titleLine", {
          title: jdData.title,
          company: jdData.company,
        });
        parts.push(`**${titleLine}**`);
      }

      if (jdData.parsed_data?.location) {
        parts.push(`__LOC__${jdData.parsed_data.location}`);
      }

      if (jdData.parsed_data?.about_this_job) {
        const about = jdData.parsed_data.about_this_job;
        const summary = about.length > 200 ? `${about.substring(0, 200)}...` : about;
        parts.push(`\n**${t("jobSummary.aboutLabel")}** ${summary}`);
      }

      if (jdData.parsed_data?.requirements && jdData.parsed_data.requirements.length > 0) {
        const topReqs = jdData.parsed_data.requirements.slice(0, 3);
        parts.push(`\n**${t("jobSummary.keyRequirements")}**`);
        topReqs.forEach((req: string) => {
          parts.push(`- ${req}`);
        });
        if (jdData.parsed_data.requirements.length > 3) {
          parts.push(t("jobSummary.more", { count: jdData.parsed_data.requirements.length - 3 }));
        }
      }

      if (jdData.parsed_data?.responsibilities && jdData.parsed_data.responsibilities.length > 0) {
        const topResp = jdData.parsed_data.responsibilities.slice(0, 3);
        parts.push(`\n**${t("jobSummary.keyResponsibilities")}**`);
        topResp.forEach((resp: string) => {
          parts.push(`- ${resp}`);
        });
        if (jdData.parsed_data.responsibilities.length > 3) {
          parts.push(t("jobSummary.more", { count: jdData.parsed_data.responsibilities.length - 3 }));
        }
      }

      setJobDescriptionSummary(parts.join("\n"));
    } catch (error) {
      console.error("Failed to generate job description summary:", error);
      const fallback = jdData.title && jdData.company
        ? t("jobSummary.titleLine", { title: jdData.title, company: jdData.company })
        : t("jobSummary.detailsFallback");
      setJobDescriptionSummary(fallback);
    }
  };

  const fetchOptimizationData = async () => {
    try {
      const idVal = String(params.id || "");

      if (typeof window !== "undefined") {
        const cached = window.sessionStorage.getItem(`demo-optimization:${idVal}`);
        if (cached) {
          try {
            const demoPayload = JSON.parse(cached);
            setResumeText(demoPayload.resumeText || "");
            setOptimizedResume(demoPayload.optimizedResume || null);
            setMatchScore(demoPayload.matchScore ?? null);
            setJobDescription(demoPayload.jobDescription || null);
            if (demoPayload.atsV2Data) {
              setAtsV2Data(demoPayload.atsV2Data);
            }
            setAtsSuggestions(demoPayload.atsSuggestions || []);
            setIsDemoOptimization(true);
            setLoading(false);
            return;
          } catch (storageError) {
            console.warn('Failed to parse cached demo optimization payload', storageError);
          }
        }
      }

      // First get the optimization data including match_score and ATS v2 data
      // Use maybeSingle() instead of single() to avoid 406 errors
      const { data: optimizationRow, error: optError } = await supabase
        .from("optimizations")
        .select("rewrite_data, resume_id, jd_id, match_score, ats_version, ats_score_original, ats_score_optimized, ats_subscores, ats_subscores_original, ats_suggestions, ats_confidence")
        .eq("id", idVal)
        .maybeSingle();

      if (optError) {
        console.error('Error fetching optimization:', optError);
        throw new Error(`Failed to load optimization: ${optError.message}`);
      }

      if (!optimizationRow) {
        throw new Error(t("error.optimizationNotFound"));
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
        throw new Error(t("error.resumeNotFound"));
      }

      const { data: jdData, error: jdError } = await supabase
        .from("job_descriptions")
        .select("raw_text, clean_text, parsed_data, title, company, source_url")
        .eq("id", (optimizationRow as any).jd_id)
        .maybeSingle();

      if (jdError) {
        console.error('Error fetching job description:', jdError);
        throw new Error(`Failed to load job description: ${jdError.message}`);
      }

      if (!jdData) {
        throw new Error(t("error.jobNotFound"));
      }

      setResumeText((resumeData as any)?.raw_text || "");
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
          subscores_original: row.ats_subscores_original,
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
    console.log(' [handleChatMessageSent] CALLED! Starting refresh process...');
    try {
      const idVal2 = String(params.id || "");

      console.log(' Chat message sent, refreshing resume data for optimization:', idVal2);

      // FIXED: Database trigger sets updated_at to NOW() which may be identical for rapid updates
      // Solution: Wait 1.5 seconds for database to process, then fetch fresh data
      // This ensures the trigger has fired and committed the transaction
      console.log(' Waiting 1.5 seconds for database transaction to complete...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Fetch fresh data from database with cache-busting
      // Add random query param to prevent browser/Supabase caching
      console.log(' Fetching fresh optimization data with cache-busting...');
      const cacheBuster = Date.now();
      const { data: optimizationRow, error: optError } = await supabase
        .from("optimizations")
        .select("rewrite_data, ats_score_optimized, ats_subscores, ats_score_original, ats_subscores_original, updated_at")
        .eq("id", idVal2)
        .maybeSingle();

      console.log(' Cache buster:', cacheBuster, '(prevents stale data)');

      if (!optError && optimizationRow) {
        console.log(' Refreshed resume data after chat message');
        console.log(' Resume sections:', Object.keys((optimizationRow as any).rewrite_data || {}));

        // Log sample of data to verify changes
        if ((optimizationRow as any).rewrite_data?.skills) {
          console.log(' Current skills:', (optimizationRow as any).rewrite_data.skills);
        }

        // Force a complete re-render by creating new object reference
        const newData = JSON.parse(JSON.stringify((optimizationRow as any).rewrite_data));
        setOptimizedResume(newData);

        // Update ATS scores if they changed
        const optRow = optimizationRow as any;
        if (optRow.ats_score_optimized !== null || optRow.ats_score_original !== null) {
          console.log(' Updating ATS scores:', {
            original: optRow.ats_score_original,
            optimized: optRow.ats_score_optimized,
            previousOptimized: atsV2Data?.ats_score_optimized,
            scoreChanged: optRow.ats_score_optimized !== atsV2Data?.ats_score_optimized
          });

          // Force React to detect change by creating completely new object
          setAtsV2Data({
            ats_score_original: optRow.ats_score_original,
            ats_score_optimized: optRow.ats_score_optimized,
            subscores: optRow.ats_subscores,
            subscores_original: optRow.ats_subscores_original,
            confidence: atsV2Data?.confidence || null
          });
        }

        // Force component re-render
        setRefreshKey(prev => prev + 1);
      } else {
        console.error(' No optimization data returned after refresh');
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
        console.log(' Refreshed design assignment after chat message');
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
          setCurrentDesignAssignment(data.assignment || null);
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
    setDesignLoading(true);
    setPendingTemplateId(templateId);

    try {
      const response = await fetch(`/api/v1/design/${params.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ templateId })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || t("design.applyError"));
      }

      const data = await response.json();
      console.log('Design updated successfully:', data.assignment?.template?.slug);

      // Update design assignment - this will trigger DesignRenderer's useEffect
      setCurrentDesignAssignment(data.assignment || null);
      setShowDesignBrowser(false);
      toast({
        title: t("design.toastAppliedTitle"),
        description: data.assignment?.template?.name || t("design.toastAppliedDescription")
      });

      // Remove the 500ms delay - let React handle the state update naturally
      // The DesignRenderer component will manage the transition smoothly

    } catch (error) {
      console.error('Failed to apply template:', error);
      toast({
        title: t("design.toastApplyFailedTitle"),
        description: error instanceof Error ? error.message : t("design.toastApplyFailedDescription"),
        variant: 'destructive'
      });
    } finally {
      setDesignLoading(false);
      setPendingTemplateId(null);
      console.log('Design change complete');
    }
  }, [params.id, designLoading, toast]);

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
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">{t("error.title")}</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                {t("error.reload")}
              </button>
              <button
                onClick={() => window.location.href = '/dashboard/applications'}
                className="w-full px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
              >
                {t("error.backToDashboard")}
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
      alert(t("copy.success"));
    } catch (err) {
      console.error('Failed to copy:', err);
      alert(t("copy.failure"));
    }
  };

  const generatePlainTextResume = (data: OptimizedResume): string => {
    let text = '';

    const pushLine = (line = '') => {
      text += `${line}\n`;
    };

    pushLine(data.contact.name);
    pushLine(data.contact.location);
    pushLine(`${data.contact.email} | ${data.contact.phone}`);
    if (data.contact.linkedin) pushLine(data.contact.linkedin);
    if (data.contact.portfolio) pushLine(data.contact.portfolio);
    pushLine('');

    pushLine(t("plainText.summaryTitle"));
    pushLine(data.summary);
    pushLine('');

    pushLine(t("plainText.skillsTitle"));
    pushLine(`${t("plainText.technicalSkills")}: ${data.skills.technical.join(', ')}`);
    if (data.skills.soft.length > 0) {
      pushLine(`${t("plainText.professionalSkills")}: ${data.skills.soft.join(', ')}`);
    }
    pushLine('');

    pushLine(t("plainText.experienceTitle"));
    data.experience.forEach(exp => {
      pushLine(exp.title);
      pushLine(`${exp.company} | ${exp.location} | ${exp.startDate} - ${exp.endDate || t("plainText.present")}`);
      exp.achievements.forEach(achievement => {
        pushLine(`- ${achievement}`);
      });
      pushLine('');
    });

    pushLine(t("plainText.educationTitle"));
    data.education.forEach(edu => {
      pushLine(edu.degree);
      pushLine(`${edu.institution} | ${edu.location} | ${edu.graduationDate}`);
      pushLine('');
    });

    if (data.certifications && data.certifications.length > 0) {
      pushLine(t("plainText.certificationsTitle"));
      data.certifications.forEach(cert => {
        pushLine(`- ${cert}`);
      });
      pushLine('');
    }

    if (data.projects && data.projects.length > 0) {
      pushLine(t("plainText.projectsTitle"));
      data.projects.forEach(project => {
        pushLine(project.name);
        pushLine(project.description);
        pushLine(`${t("plainText.technologies")}: ${project.technologies.join(', ')}`);
        pushLine('');
      });
    }

    return text.trimEnd();
  };

  const handleApply = async () => {
    if (isDemoOptimization) {
      alert(t("apply.demoReadOnly"));
      return;
    }
    if (!jobDescription) {
      alert(t("apply.noJobDescription"));
      return;
    }

    setApplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert(t("apply.mustLogin"));
        setApplying(false);
        return;
      }

      // Build HTML snapshot from current DOM renderer
      const resumeContainer = document.querySelector('.resume-container') || document.body;
      const html = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8"/>\n<title>${jobDescription.title} - ${jobDescription.company}</title>\n</head>\n<body>${resumeContainer.outerHTML}</body>\n</html>`;

      // Prepare metadata
      const contact = optimizedResume?.contact || null;
      const atsScore = matchScore ?? null;
      const fallbackTitle = jobDescription.title || optimizedResume?.contact?.title || t("apply.fallbackTitle");
      const fallbackCompany = jobDescription.company || optimizedResume?.contact?.company || t("apply.fallbackCompany");

      // Call API to persist snapshot
      const res = await fetch('/api/v1/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          url: jobDescription.source_url || null, // Trigger job extraction to get real company name
          optimizationId: String(params.id || ''),
          jobTitle: fallbackTitle,
          company: fallbackCompany,
          atsScore,
          contact,
          jobUrl: jobDescription.source_url || null,
          appliedDate: new Date().toISOString(),
        })
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || t("apply.saveFailure"));
      }

      // Navigate to applications list after apply
      window.location.href = `/dashboard/applications`;

    } catch (error) {
      console.error('Error in handleApply:', error);
      alert(t("apply.failure"));
      setApplying(false);
    }
  };

  return (
    <CacheBustingErrorBoundary>
      <SectionSelectionProvider>
        <div className="min-h-screen bg-muted/50 p-4 md:p-10">
      {isDemoOptimization && (
        <div className="mb-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-primary">
          {t("demo.banner")}
        </div>
      )}
      {/* Page Header with Navigation */}
      <div className="mb-4 flex justify-between items-center print:hidden">
        <Link href="/dashboard/applications" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          {t("navigation.backToApplications")}
        </Link>
        <div className="text-sm text-muted-foreground">
          {jobDescription?.title && t("navigation.titleAtCompany", { title: jobDescription.title, company: jobDescription.company })}
        </div>
      </div>

      {/* Action Buttons - Mobile Optimized */}
      <div className="mb-6 space-y-3 print:hidden">
        {/* Apply Button - Primary Action - Full Width on Mobile */}
        <Button 
          onClick={handleApply} 
          disabled={applying || isDemoOptimization} 
          className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold h-11"
        >
          {applying ? t("apply.applying") : isDemoOptimization ? t("apply.demoPreview") : t("apply.applyNow")}
        </Button>

        {/* Export Actions - Grid Layout for Mobile */}
        <div className="grid grid-cols-3 md:flex gap-2 md:gap-3">
          <Button 
            onClick={handleCopyText} 
            variant="outline"
            className="w-full text-xs md:text-sm px-2 md:px-4 h-10 md:h-9"
          >
            {t("actions.copy")}
          </Button>
          <Button 
            onClick={handlePrint} 
            variant="outline"
            className="w-full text-xs md:text-sm px-2 md:px-4 h-10 md:h-9"
          >
            {t("actions.print")}
          </Button>
          <Button 
            onClick={handleDownloadPDF}
            className="w-full text-xs md:text-sm px-2 md:px-4 h-10 md:h-9 bg-gray-900 hover:bg-gray-800 text-white"
          >
            {t("actions.download")}
          </Button>
        </div>

        {/* Design Actions - Row Layout */}
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">{t("language.label")}</span>
            <Select value={languagePreference} onValueChange={(value: any) => setLanguagePreference(value)}>
              <SelectTrigger className="flex-1 sm:w-[140px] h-10 md:h-9 text-xs md:text-sm">
                <SelectValue placeholder={t("language.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("language.auto")}</SelectItem>
                <SelectItem value="hebrew">{t("language.hebrew")}</SelectItem>
                <SelectItem value="english">{t("language.english")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

            <Button 
              onClick={() => setShowDesignBrowser(true)} 
              variant="outline"
              className="w-full sm:w-auto h-10 md:h-9 text-xs md:text-sm px-3 md:px-4"
            >
              {designSummaryLabel}
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

      {/* Top Row: ATS Score (Left) | Current Design (Right) - Matches resume and chat widths exactly */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* ATS Match Score - Left side (2/3 width) - Exactly matches Resume width */}
        {matchScore !== null && (
          <div className="lg:col-span-2">
            {atsV2Data ? (
              <CompactATSScoreCard
                atsScoreOriginal={atsV2Data.ats_score_original || matchScore}
                atsScoreOptimized={atsV2Data.ats_score_optimized || matchScore}
                subscores={atsV2Data.subscores}
                subscoresOriginal={atsV2Data.subscores_original}
              />
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">!</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      {t("atsUnavailable.title")}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                      {t("atsUnavailable.description")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current Design Info - Right side (1/3 width) - Exactly matches AI Assistant width */}
        <div className="lg:col-span-1">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {t("design.currentTitle", { name: currentDesignAssignment?.template?.name || t("design.defaultName") })}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    {designSummaryLabel}
                  </p>
                </div>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium whitespace-nowrap ms-4">
                {t("design.atsFriendly")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Resume Preview (Full Width) */}
      <div className="mb-8">
        {/* Resume Preview - Full Width */}
        <div className="w-full">
          {/* Optimized Resume - DesignRenderer handles its own loading and transitions */}
          {optimizedResume && (
            <DesignRenderer
              key={refreshKey}
              resumeData={optimizedResume}
              templateSlug={currentDesignAssignment?.template?.slug}
              customization={ephemeralCustomization || currentDesignAssignment?.customization}
              pendingChanges={pendingChanges}
              refreshKey={refreshKey}
              languagePreference={languagePreference}
            />
          )}
        </div>
      </div>

      {/* Floating AI Assistant Button - Mobile Optimized */}
      {optimizedResume && (
        <>
          <button
            onClick={() => setShowChat(!showChat)}
            onPointerDown={(e) => {
              setDragging(true);
              dragOffset.current = {
                x: e.clientX - fabPosition.x,
                y: e.clientY - fabPosition.y,
              };
            }}
            className="fixed w-14 h-14 md:w-18 md:h-18 bg-foreground text-background rounded-full shadow-2xl shadow-mobile-cta/40 ring-4 ring-white/40 hover:ring-white/60 transition-all duration-300 flex items-center justify-center z-[70] print:hidden group touch-none"
            style={{ left: fabPosition.x, top: fabPosition.y }}
            title={t("chat.title")}
            aria-label={t("chat.openLabel")}
          >
            <svg
              className="w-7 h-7 md:w-9 md:h-9 group-hover:scale-110 transition-transform drop-shadow"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            {atsSuggestions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-red-500 text-white text-[10px] md:text-xs rounded-full flex items-center justify-center font-bold">
                {atsSuggestions.length}
              </span>
            )}
          </button>

          {/* Chat Modal Overlay */}
          {showChat && (
            <div
              className="fixed inset-0 bg-black/50 z-40 print:hidden"
              onClick={() => setShowChat(false)}
            >
              <div
                className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-[450px] md:max-w-[90vw] h-[80vh] md:h-[600px] bg-background rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-full flex flex-col">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between p-4 border-b-2 border-border bg-muted/50">
                    <h3 className="font-bold text-lg">{t("chat.title")}</h3>
                    <button
                      onClick={() => setShowChat(false)}
                      className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Chat Content */}
                  <div className="flex-1 overflow-hidden">
                    <ChatSidebar
                      optimizationId={params.id as string}
                      onMessageSent={handleChatMessageSent}
                      onDesignPreview={(c) => setEphemeralCustomization(c)}
                      atsSuggestions={atsSuggestions}
                      onPendingChanges={setPendingChanges}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Original Data (Collapsible) - Below Everything */}
      <div className="grid gap-4 md:grid-cols-2 print:hidden">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{t("sections.originalResume")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
              {resumeText}
            </pre>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{t("sections.jobSummaryTitle")}</CardTitle>
            {jobDescription?.source_url && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("sections.sourceLabel")}: <a href={jobDescription.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
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
                  <span className="text-2xl">{t("jobSummary.iconLabel")}</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
                      {t("jobSummary.quickSummary")}
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-start">
                      {jobDescriptionSummary.split('\n').map((line, idx) => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) return <div key={idx} className="h-2" />;

                        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                          return <p key={idx} className="font-bold text-gray-900 dark:text-gray-100 mb-2 mt-2">{trimmedLine.replace(/\*\*/g, '')}</p>;
                        } else if (trimmedLine.startsWith('__LOC__')) {
                          const location = trimmedLine.replace(/^__LOC__/, '');
                          return <p key={idx} className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t("jobSummary.locationLine", { location })}</p>;
                        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                          const bulletText = trimmedLine.replace(/^[-*]\s*/, '');
                          return <p key={idx} className="text-sm text-gray-700 dark:text-gray-300 ms-4 mb-1.5 leading-relaxed">- {bulletText}</p>;
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
        currentTemplateId={pendingTemplateId ?? currentDesignAssignment?.template?.id}
        optimizationId={params.id as string}
        onTemplateSelect={handleTemplateSelect}
        isApplying={designLoading}
        applyingTemplateId={pendingTemplateId}
      />
        </div>
      </SectionSelectionProvider>
    </CacheBustingErrorBoundary>
  );
}
