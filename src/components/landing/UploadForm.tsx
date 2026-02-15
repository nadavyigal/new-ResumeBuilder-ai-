"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const MIN_JOB_DESCRIPTION_WORDS = 80;

function isLikelyJobUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);
    return Boolean(parsed.hostname && parsed.hostname.includes("."));
  } catch {
    return false;
  }
}

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

  const wordCount = useMemo(() => {
    if (inputMode !== "text") return 0;
    return jobDescription.trim().split(/\s+/).filter(Boolean).length;
  }, [jobDescription, inputMode]);

  const hasValidWordCount = inputMode !== "text" || wordCount >= MIN_JOB_DESCRIPTION_WORDS;
  const hasValidUrl = inputMode !== "url" || isLikelyJobUrl(jobDescriptionUrl);
  const hasJobInput = inputMode === "text" ? jobDescription.trim() : jobDescriptionUrl.trim();

  const canSubmit = Boolean(
    resumeFile
    && hasJobInput
    && hasValidWordCount
    && hasValidUrl
  );

  const submitHint = useMemo(() => {
    if (submitting) return null;
    if (!resumeFile) return t("hints.resumeRequired");
    if (inputMode === "text" && !jobDescription.trim()) return t("hints.jobDescriptionRequired");
    if (inputMode === "url" && !jobDescriptionUrl.trim()) return t("hints.jobUrlRequired");
    if (inputMode === "text" && !hasValidWordCount) {
      return t("hints.minimumWords", { count: MIN_JOB_DESCRIPTION_WORDS });
    }
    if (inputMode === "url" && !hasValidUrl) return t("hints.validUrlRequired");
    return null;
  }, [submitting, resumeFile, inputMode, jobDescription, jobDescriptionUrl, hasValidWordCount, hasValidUrl, t]);

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
        <div className="flex gap-2">
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
              <span>{t("minimumWords", { count: MIN_JOB_DESCRIPTION_WORDS })}</span>
              <span className={hasValidWordCount ? "" : "text-destructive"}>
                {t("wordCount", { count: wordCount })}
              </span>
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
              required
            />
            <p className="text-xs text-foreground/60">
              {t("urlHelper")}
            </p>
            {!hasValidUrl && jobDescriptionUrl.trim() && (
              <p className="text-xs text-destructive">{t("invalidUrl")}</p>
            )}
          </>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        data-testid="analyze-button"
        className="w-full border-0 bg-[hsl(142_76%_24%)] text-white hover:bg-[hsl(142_76%_20%)] disabled:opacity-100 disabled:bg-muted disabled:text-foreground/65 disabled:border-2 disabled:border-border"
        disabled={!canSubmit || submitting}
      >
        {submitting ? t("checking") : t("submit")}
      </Button>
      {submitHint && (
        <p className="text-xs text-foreground/65 text-center" role="status">
          {submitHint}
        </p>
      )}
    </form>
  );
}
