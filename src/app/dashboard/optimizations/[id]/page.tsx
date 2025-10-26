"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@/lib/supabase";

import { TemplateSelector } from "@/components/templates/template-selector";

// Ensure this dynamic route is not statically optimized and avoids stale caching
export const dynamic = 'force-dynamic';

export default function OptimizationPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [optimizedResume, setOptimizedResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchOptimizationData = async () => {
      try {
        const idVal = String(params.id || "");

        // Fetch optimization row first (no joins to avoid 406/single coercion errors)
        const { data: opt, error: optError } = await supabase
          .from('optimizations')
          .select('rewrite_data, resume_id, jd_id')
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-muted/50 p-4 md:p-10">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Original Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap">{resumeText}</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap">{jobDescriptionText}</pre>
          </CardContent>
        </Card>
      </div>
      {optimizedResume && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimized Resume</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap">{JSON.stringify(optimizedResume, null, 2)}</pre>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="mt-4 flex space-x-4">
        <Button onClick={() => window.location.href = `/api/download/${params.id}?fmt=pdf`}>Download as PDF</Button>
        <Button onClick={() => window.location.href = `/api/download/${params.id}?fmt=docx`}>Download as DOCX</Button>
      </div>
    </div>
  );
}
