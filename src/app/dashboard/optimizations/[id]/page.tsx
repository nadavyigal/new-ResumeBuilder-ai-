"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@/lib/supabase";

import { TemplateSelector } from "@/components/templates/template-selector";

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
        const { id } = params;

        const { data, error } = await supabase
          .from("optimizations")
          .select(`
            rewrite_data,
            resumes (raw_text),
            job_descriptions (raw_text)
          `)
          .eq("id", id)
          .single();

        if (error) throw error;

        // Supabase returns joined tables as objects when using single()
        // Access them directly from the data object
        setResumeText((data as any).resumes?.raw_text || "");
        setJobDescriptionText((data as any).job_descriptions?.raw_text || "");
        setOptimizedResume(data.rewrite_data);

      } catch (error: any) {
        setError(error.message);
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
