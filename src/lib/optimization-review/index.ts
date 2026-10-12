import type { OptimizedResume } from "@/lib/ai-optimizer";
import { scoreOptimization } from "@/lib/ats/integration";
import { applyModifications, type ModificationOperation } from "@/lib/resume/modification-applier";
import { normalizeOptimizedResume } from "@/lib/resume/canonicalize";
import type { HeldPhrase } from "@/lib/ai-optimizer/job-ad-terms";
import type {
  ReviewATSPreview,
  ReviewChangeGroup,
  ReviewConfirmClaim,
  ReviewModificationOperation,
  ReviewSection,
} from "@/types/optimization-review";

type ReviewContext = {
  jobTitle?: string | null;
  jobDescriptionText: string;
  resumeOriginalText: string;
  jobExtractedJson?: Record<string, unknown>;
};

type SectionDescriptor = {
  section: ReviewSection;
  title: string;
  summary: string;
  reasonTags: string[];
};

const SECTION_DESCRIPTORS: SectionDescriptor[] = [
  {
    section: "summary",
    title: "Sharper professional summary",
    summary: "Clarifies your value proposition for the target role.",
    reasonTags: ["positioning", "clarity"],
  },
  {
    section: "contact",
    title: "Updated headline details",
    summary: "Aligns headline-level details with the job target.",
    reasonTags: ["headline", "alignment"],
  },
  {
    section: "skills",
    title: "Prioritized role-relevant skills",
    summary: "Highlights the strongest keywords and core capabilities first.",
    reasonTags: ["keywords", "coverage"],
  },
  {
    section: "experience",
    title: "Stronger experience bullets",
    summary: "Makes achievements more relevant, specific, and recruiter-friendly.",
    reasonTags: ["impact", "relevance"],
  },
  {
    section: "education",
    title: "Clearer education section",
    summary: "Tightens education details for faster recruiter scanning.",
    reasonTags: ["structure", "readability"],
  },
  {
    section: "certifications",
    title: "Refined certification proof",
    summary: "Surfaces certifications that strengthen role fit.",
    reasonTags: ["credentials", "fit"],
  },
  {
    section: "projects",
    title: "More relevant project evidence",
    summary: "Shows projects with clearer technology and business relevance.",
    reasonTags: ["portfolio", "evidence"],
  },
];

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${key}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function truncate(text: string, maxLength = 300): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function summarizeSection(section: ReviewSection, value: unknown): string {
  if (!value) return "";

  if (section === "summary" && typeof value === "string") {
    return truncate(value, 260);
  }

  if (section === "contact" && typeof value === "object" && !Array.isArray(value)) {
    const contact = value as OptimizedResume["contact"];
    return truncate(
      [contact.name, contact.title, contact.email, contact.location].filter(Boolean).join(" | "),
      220
    );
  }

  if (section === "skills" && typeof value === "object" && !Array.isArray(value)) {
    const skills = value as OptimizedResume["skills"];
    return truncate(
      [
        (skills.technical || []).slice(0, 8).join(", "),
        (skills.soft || []).slice(0, 5).join(", "),
      ]
        .filter(Boolean)
        .join("\n"),
      280
    );
  }

  if (section === "experience" && Array.isArray(value)) {
    const experience = value as OptimizedResume["experience"];
    return truncate(
      experience
        .slice(0, 2)
        .map((item) =>
          [
            `${item.title}${item.company ? ` - ${item.company}` : ""}`,
            ...(item.achievements || []).slice(0, 2).map((achievement) => `- ${achievement}`),
          ].join("\n")
        )
        .join("\n\n"),
      320
    );
  }

  if (section === "education" && Array.isArray(value)) {
    const education = value as OptimizedResume["education"];
    return truncate(
      education
        .slice(0, 2)
        .map((item) => `${item.degree}${item.institution ? ` - ${item.institution}` : ""}`)
        .join("\n"),
      240
    );
  }

  if (section === "certifications" && Array.isArray(value)) {
    return truncate((value as string[]).slice(0, 4).join("\n"), 240);
  }

  if (section === "projects" && Array.isArray(value)) {
    const projects = value as NonNullable<OptimizedResume["projects"]>;
    return truncate(
      projects
        .slice(0, 2)
        .map((project) => `${project.name}\n${project.description}`)
        .join("\n\n"),
      300
    );
  }

  return truncate(JSON.stringify(value, null, 2), 280);
}

function descriptorFor(section: ReviewSection): SectionDescriptor {
  return (
    SECTION_DESCRIPTORS.find((descriptor) => descriptor.section === section) || SECTION_DESCRIPTORS[0]
  );
}

export function createReviewChangeGroups(
  originalResume: OptimizedResume,
  optimizedResume: OptimizedResume
): ReviewChangeGroup[] {
  const normalizedOriginal = normalizeOptimizedResume(originalResume);
  const normalizedOptimized = normalizeOptimizedResume(optimizedResume, normalizedOriginal);
  const sections: ReviewSection[] = [
    "summary",
    "contact",
    "skills",
    "experience",
    "education",
    "certifications",
    "projects",
  ];

  return sections
    .filter((section) => !valuesEqual(normalizedOriginal[section], normalizedOptimized[section]))
    .map((section) => {
      const descriptor = descriptorFor(section);
      const operation: ReviewModificationOperation = {
        operation: "replace",
        field_path: section,
        old_value: normalizedOriginal[section],
        new_value: normalizedOptimized[section],
      };

      return {
        id: section,
        section,
        title: descriptor.title,
        summary: descriptor.summary,
        before_excerpt: summarizeSection(section, normalizedOriginal[section]),
        after_excerpt: summarizeSection(section, normalizedOptimized[section]),
        affected_fields: [section],
        operations: [operation],
        reason_tags: descriptor.reasonTags,
      };
    });
}

/** One "Add only if true" item per held-back phrase. Never pre-selected. */
export function createConfirmGroups(heldPhrases: HeldPhrase[] | undefined): ReviewChangeGroup[] {
  return (heldPhrases ?? []).map((held, i) => ({
    id: `confirm-${i + 1}`,
    section: held.section,
    title: "Add only if true",
    summary: "Matches the job, but your resume does not say it. Add it only if it is true for you.",
    before_excerpt: held.kept ?? "",
    after_excerpt: held.proposed,
    affected_fields: [held.section],
    operations: [],
    reason_tags: ["confirm"],
    confirm: {
      requires: held.section,
      index: held.index,
      kept: held.kept,
      proposed: held.proposed,
      after: held.after,
      terms: held.terms,
      estimated_gain: null,
      ...(held.clauses ? { clauses: held.clauses, kept_clauses: held.keptClauses ?? [], clause: held.clause } : {}),
    },
  }));
}

/** Same rule as the guard's `joinClauses`, kept here so this module stays free of the optimizer. */
function joinClauses(clauses: string[], keep: number[]): string {
  const joined = [...new Set(keep)]
    .sort((a, b) => a - b)
    .map((i) => clauses[i])
    .join(", ")
    .replace(/[\s,;.]+$/, "");
  return `${joined}.`;
}

/**
 * Clause items of the same line become one claim whose text has every
 * confirmed clause back, so confirming two of three gives exactly those two.
 */
function mergeClauseClaims(claims: ReviewConfirmClaim[]): ReviewConfirmClaim[] {
  const lines = new Map<string, ReviewConfirmClaim[]>();
  const out: ReviewConfirmClaim[] = [];
  for (const claim of claims) {
    if (!claim.clauses || claim.clause === undefined) {
      out.push(claim);
      continue;
    }
    const key = `${claim.requires}|${claim.index}|${claim.kept}`;
    lines.set(key, [...(lines.get(key) ?? []), claim]);
  }
  for (const group of lines.values()) {
    const [first] = group;
    const keep = [...(first.kept_clauses ?? []), ...group.map((c) => c.clause as number)];
    out.push({ ...first, proposed: joinClauses(first.clauses as string[], keep) });
  }
  return out;
}

const same = (a: unknown, b: string | null) => typeof a === "string" && b !== null && a.trim() === b.trim();

/** Put one confirmed phrase back where the guard took it from. */
function applyConfirmation(resume: OptimizedResume, claim: ReviewConfirmClaim): OptimizedResume {
  if (claim.requires === "summary") {
    const summary = typeof resume.summary === "string" ? resume.summary : "";
    if (claim.kept !== null) {
      return summary.includes(claim.kept.trim())
        ? { ...resume, summary: summary.replace(claim.kept.trim(), claim.proposed) }
        : resume;
    }
    if (claim.after === null) return { ...resume, summary: `${claim.proposed} ${summary}`.trim() };
    const at = summary.indexOf(claim.after.trim());
    if (at === -1) return { ...resume, summary: `${summary} ${claim.proposed}`.trim() };
    const end = at + claim.after.trim().length;
    return { ...resume, summary: `${summary.slice(0, end)} ${claim.proposed}${summary.slice(end)}` };
  }

  if (claim.requires === "projects") {
    const projects = (resume.projects ?? []).map((project, i) =>
      i === claim.index && same(project.description, claim.kept) ? { ...project, description: claim.proposed } : project
    );
    return { ...resume, projects };
  }

  // Experience: the role it came from first, then any role, so a reordered
  // section still finds the bullet.
  const roles = Array.isArray(resume.experience) ? resume.experience : [];
  const order = [claim.index, ...roles.map((_, i) => i).filter((i) => i !== claim.index)].filter((i) => roles[i]);
  for (const i of order) {
    const role = roles[i];
    const lists = { achievements: role.achievements ?? [], responsibilities: role.responsibilities ?? [] };
    if (claim.kept !== null) {
      if (![...lists.achievements, ...lists.responsibilities].some((b) => same(b, claim.kept))) continue;
      const swap = (list: string[]) => list.map((b) => (same(b, claim.kept) ? claim.proposed : b));
      const next = { ...role, achievements: swap(lists.achievements), ...(role.responsibilities ? { responsibilities: swap(lists.responsibilities) } : {}) };
      return { ...resume, experience: roles.map((r, j) => (j === i ? next : r)) };
    }
    if (i !== claim.index) continue;
    const list = lists.achievements;
    const anchor = claim.after === null ? -1 : list.findIndex((b) => same(b, claim.after));
    const at = claim.after === null ? 0 : anchor === -1 ? list.length : anchor + 1;
    const next = { ...role, achievements: [...list.slice(0, at), claim.proposed, ...list.slice(at)] };
    return { ...resume, experience: roles.map((r, j) => (j === i ? next : r)) };
  }
  return resume;
}

/** Confirmed phrases whose section change is approved too; the rest have nothing to attach to. */
export function applyConfirmedPhrases(resume: OptimizedResume, approvedGroups: ReviewChangeGroup[]): OptimizedResume {
  const approvedSections = new Set(approvedGroups.filter((g) => !g.confirm).map((g) => g.section));
  const claims = approvedGroups
    .filter((g) => g.confirm && (g.confirm.standalone || approvedSections.has(g.confirm.requires)))
    .map((g) => g.confirm as ReviewConfirmClaim);
  return mergeClauseClaims(claims).reduce(applyConfirmation, resume);
}

export function buildResumeFromApprovedGroups(
  originalResume: OptimizedResume,
  approvedGroups: ReviewChangeGroup[],
  metadata?: Partial<OptimizedResume>
): OptimizedResume {
  const operations: ModificationOperation[] = approvedGroups.flatMap((group) =>
    group.operations.map((operation) => ({
      operation: operation.operation,
      field_path: operation.field_path,
      old_value: operation.old_value,
      new_value: operation.new_value,
    }))
  );

  const updatedResume = operations.length
    ? (applyModifications(originalResume, operations) as OptimizedResume)
    : originalResume;

  return normalizeOptimizedResume(applyConfirmedPhrases(updatedResume, approvedGroups), {
    ...metadata,
    keyImprovements:
      metadata?.keyImprovements ||
      approvedGroups.filter((group) => !group.confirm).map((group) => group.title).slice(0, 6),
  });
}

function extractMissingKeywordsFromSuggestions(suggestions: unknown[] | undefined): string[] {
  if (!Array.isArray(suggestions)) return [];

  const keywords = new Set<string>();
  suggestions.forEach((suggestion) => {
    if (!suggestion || typeof suggestion !== "object" || Array.isArray(suggestion)) return;
    const action = (suggestion as Record<string, unknown>).action;
    if (!action || typeof action !== "object" || Array.isArray(action)) return;
    const actionType = (action as Record<string, unknown>).type;
    const params = (action as Record<string, unknown>).params;
    if (actionType !== "add_keyword" || !params || typeof params !== "object" || Array.isArray(params)) {
      return;
    }
    const nextKeywords = (params as Record<string, unknown>).keywords;
    if (Array.isArray(nextKeywords)) {
      nextKeywords.forEach((keyword) => {
        if (typeof keyword === "string" && keyword.trim().length > 0) {
          keywords.add(keyword.trim());
        }
      });
    }
  });
  return Array.from(keywords).slice(0, 12);
}

export async function buildATSPreview(
  optimizedResume: OptimizedResume,
  context: ReviewContext
): Promise<ReviewATSPreview | null> {
  try {
    const atsResult = await scoreOptimization({
      resumeOriginalText: context.resumeOriginalText,
      resumeOptimizedJson: optimizedResume,
      jobDescriptionText: context.jobDescriptionText,
      jobTitle: context.jobTitle || "Position",
      jobExtractedJson: context.jobExtractedJson,
    });

    return {
      before: atsResult.ats_score_original,
      after: atsResult.ats_score_optimized,
      delta: Number((atsResult.ats_score_optimized - atsResult.ats_score_original).toFixed(2)),
      confidence: atsResult.confidence,
      confidence_note:
        atsResult.confidence >= 0.8
          ? "High-confidence ATS projection based on the current job description."
          : atsResult.confidence >= 0.6
            ? "Directional ATS projection based on the current job description."
            : "Low-confidence ATS projection. Treat this as directional guidance.",
      suggestions: atsResult.suggestions,
    };
  } catch (error) {
    console.error("Failed to build ATS preview for review run:", error);
    return null;
  }
}

export function buildFinalResumeMetadata(
  approvedGroups: ReviewChangeGroup[],
  atsPreview: ReviewATSPreview | null
): Pick<OptimizedResume, "matchScore" | "keyImprovements" | "missingKeywords"> {
  return {
    matchScore:
      typeof atsPreview?.after === "number" ? Math.round(atsPreview.after) : 0,
    keyImprovements: approvedGroups.filter((group) => !group.confirm).map((group) => group.title).slice(0, 6),
    missingKeywords: extractMissingKeywordsFromSuggestions(atsPreview?.suggestions),
  };
}
