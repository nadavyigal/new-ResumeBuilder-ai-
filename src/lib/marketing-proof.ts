export type ClaimStatus = "verified" | "pending_verification" | "retired";

export interface MarketingClaim {
  id: string;
  claimText: string;
  status: ClaimStatus;
  evidenceSource: string;
  owner: string;
  lastValidatedAt: string | null;
  notes?: string;
}

/**
 * Central registry for marketing claims used in public-facing copy.
 * Keep this file synchronized with analytics dashboards and evidence docs.
 */
export const MARKETING_CLAIMS: MarketingClaim[] = [
  {
    id: "job-role-specific-guidance",
    claimText: "Resumely provides role-specific ATS and resume guidance.",
    status: "verified",
    evidenceSource: "src/lib/ats + src/components/landing/FreeATSChecker.tsx",
    owner: "product",
    lastValidatedAt: "2026-02-14"
  },
  {
    id: "privacy-hash-handling",
    claimText: "Free ATS checks use privacy-first handling and hashed content identifiers.",
    status: "verified",
    evidenceSource: "src/app/api/public/ats-check/route.ts",
    owner: "engineering",
    lastValidatedAt: "2026-02-14"
  },
  {
    id: "weekly-free-checks",
    claimText: "The free checker enforces weekly usage limits per user/IP.",
    status: "verified",
    evidenceSource: "src/app/api/public/ats-check/route.ts + rate-limit library",
    owner: "engineering",
    lastValidatedAt: "2026-02-14"
  },
  {
    id: "conversion-numeric-claims",
    claimText: "Numeric growth or conversion claims appear only when validated in analytics evidence.",
    status: "pending_verification",
    evidenceSource: "docs/gtm/baseline-metrics.md",
    owner: "growth",
    lastValidatedAt: null,
    notes: "Do not publish hard numbers in funnel copy until evidence is documented."
  }
];

export function getVerifiedClaims(): MarketingClaim[] {
  return MARKETING_CLAIMS.filter((claim) => claim.status === "verified");
}
