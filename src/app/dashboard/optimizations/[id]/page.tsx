"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@/lib/supabase";
import { ATSResumeTemplate } from "@/components/templates/ats-resume-template";
import { type OptimizedResume } from "@/lib/validation/schemas";

// Ensure this dynamic route is not statically optimized and avoids stale caching
export const dynamic = 'force-dynamic';

export default function OptimizationPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [optimizedResume, setOptimizedResume] = useState<OptimizedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchOptimizationData = async () => {
      try {
        const idVal = String(params.id || "");

        // Fetch optimization row first (no joins to avoid 406/single coercion errors)
        const { data: opt, error: optError } = await supabase
          .from('optimizations')
          .select('rewrite_data, resume_id, jd_id, match_score')
          .eq('id', idVal)
          .maybeSingle();

        if (optError) {
          throw optError;
        }

        if (!opt) {
          throw new Error('Optimization not found');
        }

        // Fetch resume text
        const { data: resume, error: resumeError } = await supabase
          .from('resumes')
          .select('raw_text')
          .eq('id', (opt as any).resume_id)
          .maybeSingle();
        if (resumeError) throw resumeError;
        if (!resume) throw new Error('Resume not found');

        // Fetch job description fields
        const { data: jd, error: jdError } = await supabase
          .from('job_descriptions')
          .select('raw_text, title, company, source_url')
          .eq('id', (opt as any).jd_id)
          .maybeSingle();
        if (jdError) throw jdError;
        if (!jd) throw new Error('Job description not found');

        setResumeText((resume as any)?.raw_text || '');
        // Build JD panel text with optional header
        let jdText = (jd as any)?.raw_text || '';
        const header = `${(jd as any)?.title ? (jd as any).title : ''}${(jd as any)?.company ? ` @ ${(jd as any).company}` : ''}`.trim();
        if (header) {
          jdText = `${header}\n\n${jdText}`.trim();
        }
        setJobDescriptionText(jdText);
        setOptimizedResume((opt as any).rewrite_data);

      } catch (error: any) {
        setError(error.message || 'Failed to load optimization');
      } finally {
        setLoading(false);
      }
    };

    fetchOptimizationData();
  }, [params, supabase]);

  const handleDownload = async (format: 'pdf' | 'docx') => {
    setDownloading(format);
    try {
      const response = await fetch(`/api/download/${params.id}?fmt=${format}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `optimized-resume.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download resume. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <p className="text-muted-foreground">Loading optimization results...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Unable to Load Optimization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/50 p-4 md:p-10">
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="flex text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Optimization Results</span>
        </nav>
      </div>

      {/* ATS Match Score Card */}
      {optimizedResume && (
        <div className="mb-6">
          <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-none">
            <CardHeader>
              <CardTitle className="text-2xl">ATS Match Score</CardTitle>
              <CardDescription className="text-white/90">
                How well your resume matches the job requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-7xl font-bold text-center mb-2">
                {optimizedResume.matchScore}%
              </div>
              <p className="text-center text-lg text-white/90">
                Your resume matches {optimizedResume.matchScore}% of job requirements
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Key Improvements Section */}
      {optimizedResume?.keyImprovements && optimizedResume.keyImprovements.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-green-700">Key Improvements</CardTitle>
            <CardDescription>
              These changes were made to optimize your resume for this position
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {optimizedResume.keyImprovements.map((improvement, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-500 mr-3 text-xl">✓</span>
                  <span className="text-foreground leading-relaxed">{improvement}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Missing Keywords Section */}
      {optimizedResume?.missingKeywords && optimizedResume.missingKeywords.length > 0 && (
        <Card className="mb-6 border-yellow-300 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Missing Keywords</CardTitle>
            <CardDescription className="text-yellow-700">
              Consider adding these keywords from the job description to further improve your match
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {optimizedResume.missingKeywords.map((keyword, i) => (
                <span
                  key={i}
                  className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium border border-yellow-300"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimized Resume Template */}
      {optimizedResume && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Optimized Resume</CardTitle>
              <CardDescription>
                ATS-friendly resume tailored for this specific job
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ATSResumeTemplate data={optimizedResume} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Original Resume & Job Description - Collapsible */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Original Resume</CardTitle>
            <CardDescription>Your uploaded resume before optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto bg-muted p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-sm font-mono">{resumeText}</pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
            <CardDescription>The position you're optimizing for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto bg-muted p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-sm font-mono">{jobDescriptionText}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Download Buttons */}
      <div className="flex justify-center gap-4 mb-6">
        <Button
          onClick={() => handleDownload('pdf')}
          disabled={downloading !== null}
          size="lg"
        >
          {downloading === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleDownload('docx')}
          disabled={downloading !== null}
          size="lg"
        >
          {downloading === 'docx' ? 'Generating DOCX...' : 'Download DOCX'}
        </Button>
      </div>
    </div>
  );
}
