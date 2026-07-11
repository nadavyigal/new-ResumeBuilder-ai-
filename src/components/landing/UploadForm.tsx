"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS } from "@/lib/ats/public-ats-check-constants";

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

  const hasValidWordCount = inputMode !== "text" || wordCount >= PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS;
  const hasValidUrl = inputMode !== "url" || isLikelyJobUrl(jobDescriptionUrl);
  const hasJobInput = inputMode === "text" ? jobDescription.trim() : jobDescriptionUrl.trim();
  const hasStartedTextInput = inputMode === "text" && jobDescription.trim().length > 0;
  const isLinkedInUrl = inputMode === "url" && /linkedin\.com/i.test(jobDescriptionUrl);
  const jobRequirementMet = Boolean(hasJobInput) && hasValidWordCount && hasValidUrl;

  const canSubmit = Boolean(
    resumeFile
    && hasJobInput
    && hasValidWordCount
    && hasValidUrl
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

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="resume">{t("resumeLabel")}</Label>
        <label
          htmlFor="resume"
          className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center transition-colors hover:border-mobile-cta/60 hover:bg-mobile-cta/5"
        >
          <span className="rounded-full bg-mobile-cta/10 px-4 py-2 text-sm font-semibold text-mobile-cta">
            {t("dropzoneCta")}
          </span>
          <span className="text-xs text-foreground/60">{t("fileConstraints")}</span>
        </label>
        <Input
          id="resume"
          type="file"
          data-testid="resume-upload"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          required
          className="sr-only"
        />
        {resumeFile && (
          <p className="break-all text-xs text-foreground/60">
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
            <div className="flex items-center justify-between gap-3 text-xs text-foreground/60">
              <span>{t("minimumWords", { count: PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS })}</span>
              <span className={hasStartedTextInput && !hasValidWordCount ? "text-destructive" : ""}>
                {t("wordCount", { count: wordCount })}
              </span>
            </div>
            {hasStartedTextInput && !hasValidWordCount && (
              <p className="text-xs text-foreground/65">{t("shortTextNudge")}</p>
            )}
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
            {isLinkedInUrl && (
              <p className="text-xs text-destructive">{t("linkedinWarning")}</p>
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
      {!submitting && (
        <ul className="space-y-1 text-xs text-foreground/65" role="status" data-testid="submit-checklist">
          <li className="flex items-center gap-2">
            <span aria-hidden="true">{resumeFile ? "✓" : "○"}</span>
            {t("checklist.resume")}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true">{jobRequirementMet ? "✓" : "○"}</span>
            {t("checklist.job")}
          </li>
        </ul>
      )}
    </form>
  );
}