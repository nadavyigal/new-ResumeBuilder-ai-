"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { posthog } from "@/lib/posthog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export default function ResumeUploadPage() {
  const t = useTranslations("dashboard.resume");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionUrl, setJobDescriptionUrl] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file type (PDF only)
      const validTypes = ['application/pdf'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.pdf$/i)) {
        setError(t("errors.pdfOnly"));
        setResumeFile(null);
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(t("errors.fileSize"));
        setResumeFile(null);
        return;
      }

      setError(null);
      setResumeFile(file);
      console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

      // Track resume upload
      posthog.capture('resume_uploaded', {
        file_type: file.type,
        file_size_kb: Math.round(file.size / 1024),
        source: 'resume_upload_page',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      setError(t("errors.missingResume"));
      return;
    }

    if (inputMode === "text" && !jobDescription.trim()) {
      setError(t("errors.missingDescription"));
      return;
    }

    if (inputMode === "url" && !jobDescriptionUrl.trim()) {
      setError(t("errors.missingUrl"));
      return;
    }

    // Normalize URL: add https:// if protocol is missing
    let normalizedUrl = jobDescriptionUrl.trim();
    if (inputMode === "url" && normalizedUrl) {
      // If it doesn't start with http:// or https://, add https://
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
    }

    setLoading(true);
    setError(null);

    // Track job description added
    posthog.capture('job_description_added', {
      input_mode: inputMode,
      has_url: inputMode === 'url',
      description_length: inputMode === 'text' ? jobDescription.length : 0,
      source: 'resume_upload_page',
    });

    // Track optimization started
    posthog.capture('optimization_started', {
      input_mode: inputMode,
      source: 'resume_upload_page',
    });

    const formData = new FormData();
    formData.append("resume", resumeFile);

    if (inputMode === "url") {
      formData.append("jobDescriptionUrl", normalizedUrl);
    } else {
      formData.append("jobDescription", jobDescription);
    }

    try {
      // Create AbortController with 60 second timeout (AI optimization can take 30-40 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("errors.generic"));
      }

      const { optimizationId } = await response.json();
      router.push(`${ROUTES.optimizations}/${optimizationId}`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setError(t("errors.timeout"));
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {t("subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="resume">{t("labels.resumeFile")}</Label>
              <Input
                id="resume"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,application/pdf"
              />
              {resumeFile && (
                <p className="text-sm text-green-600">
                  {t("labels.selected", {
                    name: resumeFile.name,
                    size: `${(resumeFile.size / 1024).toFixed(1)} KB`,
                  })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("labels.jobDescription")}</Label>
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  variant={inputMode === "text" ? "default" : "outline"}
                  onClick={() => setInputMode("text")}
                  className="flex-1"
                >
                  {t("inputModes.text")}
                </Button>
                <Button
                  type="button"
                  variant={inputMode === "url" ? "default" : "outline"}
                  onClick={() => setInputMode("url")}
                  className="flex-1"
                >
                  {t("inputModes.url")}
                </Button>
              </div>
              {inputMode === "text" ? (
                <Textarea
                  id="job-description"
                  placeholder={t("placeholders.description")}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={10}
                />
              ) : (
                <Input
                  id="job-description-url"
                  type="text"
                  placeholder={t("placeholders.url")}
                  value={jobDescriptionUrl}
                  onChange={(e) => setJobDescriptionUrl(e.target.value)}
                />
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className={cn("w-full", loading && "whitespace-normal text-center leading-snug")}
              disabled={loading}
            >
              {loading ? t("submit.loading") : t("submit.default")}
            </Button>
            {loading && (
              <p className="text-xs text-muted-foreground text-center">
                {t("submit.helper")}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
