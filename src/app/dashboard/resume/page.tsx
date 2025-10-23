"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/lib/constants";

export default function ResumeUploadPage() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionUrl, setJobDescriptionUrl] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      setError("Please select a resume file.");
      return;
    }

    if (inputMode === "text" && !jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }

    if (inputMode === "url" && !jobDescriptionUrl.trim()) {
      setError("Please enter a job description URL.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("resume", resumeFile);

    if (inputMode === "url") {
      formData.append("jobDescriptionUrl", jobDescriptionUrl);
    } else {
      formData.append("jobDescription", jobDescription);
    }

    try {
      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Something went wrong");
      }

      const { resumeId, jobDescriptionId } = await response.json();
      router.push(`${ROUTES.optimizations}/${resumeId}`);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Upload Resume and Job Description</CardTitle>
          <CardDescription>
            Upload your resume and paste the job description to get an optimized version.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="resume">Resume File</Label>
              <Input id="resume" type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
            </div>
            <div className="space-y-2">
              <Label>Job Description</Label>
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  variant={inputMode === "text" ? "default" : "outline"}
                  onClick={() => setInputMode("text")}
                  className="flex-1"
                >
                  Paste Text
                </Button>
                <Button
                  type="button"
                  variant={inputMode === "url" ? "default" : "outline"}
                  onClick={() => setInputMode("url")}
                  className="flex-1"
                >
                  Enter URL
                </Button>
              </div>
              {inputMode === "text" ? (
                <Textarea
                  id="job-description"
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={10}
                />
              ) : (
                <Input
                  id="job-description-url"
                  type="url"
                  placeholder="https://example.com/job-posting"
                  value={jobDescriptionUrl}
                  onChange={(e) => setJobDescriptionUrl(e.target.value)}
                />
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Optimizing..." : "Optimize My Resume"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
