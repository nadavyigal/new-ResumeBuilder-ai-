"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Suggestion } from "@/lib/ats/types";
import { localizeIssueText } from "@/lib/ats/suggestions/localize-issue-text";

/**
 * Up to four highlights for the optimization page's readiness card: the
 * optimizer's key improvements, or the top ATS suggestions when there are none.
 */
export function useReadinessHighlights(
  keyImprovements: string[] | undefined,
  atsSuggestions: Array<Pick<Suggestion, "id" | "text">>,
): string[] {
  const tIssueText = useTranslations("landing.issueCard.issueText");
  const locale = useLocale();

  if (keyImprovements && keyImprovements.length > 0) {
    return keyImprovements.slice(0, 4);
  }

  // The API sends English text (iOS reads it as-is); other locales re-render it here.
  return atsSuggestions
    .slice(0, 4)
    .map((suggestion) => (locale === "en" ? suggestion.text : localizeIssueText(suggestion, tIssueText)));
}
