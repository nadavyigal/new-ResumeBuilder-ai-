import type { ExpertWorkflowType } from './types';

export interface WorkflowValidationResult {
  valid: boolean;
  error?: string;
  missingEvidence: string[];
}

export function safeJsonObjectParse(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return tryParse(trimmed.slice(first, last + 1));
  }

  return null;
}

function tryParse(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function hasTruthyObject(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function detectPotentialFabrication(
  original: string,
  optimized: string,
  evidenceUsed: string[]
): boolean {
  const originalNumbers = (original.match(/\d+/g) || []).length;
  const optimizedNumbers = (optimized.match(/\d+/g) || []).length;
  const evidenceText = evidenceUsed.join(' ');
  const evidenceNumbers = (evidenceText.match(/\d+/g) || []).length;
  return optimizedNumbers > originalNumbers && evidenceNumbers === 0;
}

export function validateWorkflowOutput(
  workflowType: ExpertWorkflowType,
  parsed: Record<string, unknown>
): WorkflowValidationResult {
  const missingEvidence = getStringArray(parsed.missing_evidence);

  if (workflowType === 'full_resume_rewrite') {
    if (!hasTruthyObject(parsed.rewritten_resume)) {
      return { valid: false, error: 'rewritten_resume is required', missingEvidence };
    }
    return { valid: true, missingEvidence };
  }

  if (workflowType === 'achievement_quantifier') {
    const rows = Array.isArray(parsed.bullet_rewrites) ? parsed.bullet_rewrites : [];
    if (!Array.isArray(rows)) {
      return { valid: false, error: 'bullet_rewrites must be an array', missingEvidence };
    }

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const rewrite = row as Record<string, unknown>;
      const original = String(rewrite.original_bullet || '');
      const optimized = String(rewrite.optimized_bullet || '');
      const evidence = getStringArray(rewrite.evidence_used);
      if (!original || !optimized) {
        return { valid: false, error: 'original_bullet and optimized_bullet are required', missingEvidence };
      }
      if (detectPotentialFabrication(original, optimized, evidence)) {
        return { valid: false, error: 'Potential fabricated metric detected', missingEvidence };
      }
    }

    return { valid: true, missingEvidence };
  }

  if (workflowType === 'ats_optimization_report') {
    if (!hasTruthyObject(parsed.ats_report)) {
      return { valid: false, error: 'ats_report is required', missingEvidence };
    }
    return { valid: true, missingEvidence };
  }

  if (workflowType === 'professional_summary_lab') {
    const options = Array.isArray(parsed.summary_options) ? parsed.summary_options : [];
    const recommendedIndex = Number(parsed.recommended_index);

    if (options.length < 3) {
      return { valid: false, error: 'summary_options must include at least 3 options', missingEvidence };
    }
    if (Number.isNaN(recommendedIndex) || recommendedIndex < 0 || recommendedIndex >= options.length) {
      return { valid: false, error: 'recommended_index is invalid', missingEvidence };
    }
    return { valid: true, missingEvidence };
  }

  return { valid: false, error: 'Unknown workflow type', missingEvidence };
}
