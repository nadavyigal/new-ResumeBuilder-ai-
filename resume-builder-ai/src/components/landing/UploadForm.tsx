"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface UploadFormProps {
  onSubmit: (file: File, jobDescription: string) => Promise<void>;
  onFileSelected?: (file: File) => void;
  errorMessage?: string | null;
}

export function UploadForm({ onSubmit, onFileSelected, errorMessage }: UploadFormProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const wordCount = useMemo(() => {
    return jobDescription.trim().split(/\s+/).filter(Boolean).length;
  }, [jobDescription]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setResumeFile(file);
    if (file && onFileSelected) {
      onFileSelected(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resumeFile) return;

    setSubmitting(true);
    try {
      await onSubmit(resumeFile, jobDescription);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="resume">Upload resume (PDF)</Label>
        <Input
          id="resume"
          type="file"
          data-testid="resume-upload"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          required
        />
        {resumeFile && (
          <p className="text-xs text-foreground/60">Selected: {resumeFile.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobDescription">Paste job description</Label>
        <Textarea
          id="jobDescription"
          data-testid="job-description-input"
          placeholder="Paste the full job description here..."
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          rows={6}
          required
        />
        <div className="flex items-center justify-between text-xs text-foreground/60">
          <span>Minimum 100 words for accurate scoring.</span>
          <span>{wordCount} words</span>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        data-testid="analyze-button"
        className="w-full bg-[hsl(142_76%_24%)] hover:bg-[hsl(142_76%_20%)] text-white"
        disabled={!resumeFile || submitting}
      >
        {submitting ? "Checking..." : "Check My ATS Score"}
      </Button>
    </form>
  );
}
