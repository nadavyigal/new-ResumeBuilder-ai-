"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface UploadFormProps {
  onSubmit: (
    file: File,
    input: { inputMode: "text" | "url"; jobDescription: string; jobDescriptionUrl: string }
  ) => Promise<void>;
  onFileSelected?: (file: File) => void;
  errorMessage?: string | null;
}

export function UploadForm({ onSubmit, onFileSelected, errorMessage }: UploadFormProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionUrl, setJobDescriptionUrl] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations("landing.uploadForm");

  const sanitizeUrlInput = (value: string) => {
    const cleaned = value
      .trim()
      // Strip directional marks or other invisible characters that can appear in mobile copy/paste.
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
    const match = cleaned.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|linkedin\.com\/[^\s<>"']+/i);
    if (!match) return cleaned;
    return match[0].replace(/[)\].,;:]+$/g, "");
  };

  const wordCount = useMemo(() => {
    if (inputMode !== "text") return 0;
    return jobDescription.trim().split(/\s+/).filter(Boolean).length;
  }, [jobDescription, inputMode]);

  const canSubmit = Boolean(
    resumeFile
    && (inputMode === "text" ? jobDescription.trim() : jobDescriptionUrl.trim())
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setResumeFile(file);
    if (file && onFileSelected) {
      onFileSelected(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resumeFile || !canSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit(resumeFile, {
        inputMode,
        jobDescription,
        jobDescriptionUrl,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUrlPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    const sanitized = sanitizeUrlInput(pasted);
    if (sanitized && sanitized !== pasted.trim()) {
      event.preventDefault();
      setJobDescriptionUrl(sanitized);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="resume">{t("resumeLabel")}</Label>
        <Input
          id="resume"
          type="file"
          data-testid="resume-upload"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          required
        />
        {resumeFile && (
          <p className="text-xs text-foreground/60">
            {t("selectedFile", { fileName: resumeFile.name })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("jobDescriptionLabel")}</Label>
        <div className="flex gap-2" role="tablist" aria-label="Job description input method">
          <Button
            type="button"
            role="tab"
            aria-selected={inputMode === "text"}
            variant={inputMode === "text" ? "default" : "outline"}
            onClick={() => setInputMode("text")}
            className="flex-1"
          >
            {t("inputModes.text")}
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={inputMode === "url"}
            variant={inputMode === "url" ? "default" : "outline"}
            onClick={() => setInputMode("url")}
            className="flex-1"
          >
            {t("inputModes.url")}
          </Button>
        </div>
        {inputMode === "text" ? (
          <>
            <Textarea
              id="jobDescription"
              data-testid="job-description-input"
              placeholder={t("placeholders.description")}
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              rows={6}
              required
            />
            <div className="flex items-center justify-between text-xs text-foreground/60">
              <span>{t("minimumWords")}</span>
              <span>{t("wordCount", { count: wordCount })}</span>
            </div>
          </>
        ) : (
          <>
            <Input
              id="jobDescriptionUrl"
              data-testid="job-description-url-input"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t("placeholders.url")}
              value={jobDescriptionUrl}
              onChange={(event) => setJobDescriptionUrl(event.target.value)}
              onPaste={handleUrlPaste}
              onBlur={() => setJobDescriptionUrl(sanitizeUrlInput(jobDescriptionUrl))}
              required
            />
            <p className="text-xs text-foreground/60">
              {t("urlHelper")}
            </p>
          </>
        )}
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-2xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        data-testid="analyze-button"
        className="w-full bg-mobile-cta hover:bg-mobile-cta-hover text-white border-0 disabled:opacity-100 disabled:bg-muted/70 disabled:text-foreground/70 disabled:border-2 disabled:border-border"
        disabled={!canSubmit || submitting}
      >
        {submitting ? t("checking") : t("submit")}
      </Button>
    </form>
  );
}
