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

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function hasDuplicateStrings(values: string[]): boolean {
  const normalized = values.map((value) => value.trim().toLowerCase()).filter(Boolean);
  return new Set(normalized).size !== normalized.length;
}

function hasRequiredString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string' && String(record[key]).trim().length > 0;
}

function validateReportEnvelope(parsed: Record<string, unknown>): string | null {
  if (!hasTruthyObject(parsed.report)) {
    return 'report is required';
  }

  const report = parsed.report as Record<string, unknown>;
  if (typeof report.headline !== 'string' || !report.headline.trim()) {
    return 'report.headline is required';
  }
  if (typeof report.executive_summary !== 'string' || !report.executive_summary.trim()) {
    return 'report.executive_summary is required';
  }
  if (!Array.isArray(report.priority_actions)) {
    return 'report.priority_actions must be an array';
  }
  if (!Array.isArray(report.evidence_gaps)) {
    return 'report.evidence_gaps must be an array';
  }
  if (!hasTruthyObject(report.ats_impact_estimate)) {
    return 'report.ats_impact_estimate is required';
  }

  return null;
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
  const reportValidationError = validateReportEnvelope(parsed);
  if (reportValidationError) {
    return { valid: false, error: reportValidationError, missingEvidence };
  }

  if (workflowType === 'full_resume_rewrite') {
    if (!hasTruthyObject(parsed.rewritten_resume)) {
      return { valid: false, error: 'rewritten_resume is required', missingEvidence };
    }
    const resume = parsed.rewritten_resume as Record<string, unknown>;
    if (!hasRequiredString(resume, 'summary')) {
      return { valid: false, error: 'rewritten_resume.summary is required', missingEvidence };
    }
    if (wordCount(String(resume.summary)) > 120) {
      return { valid: false, error: 'rewritten_resume.summary is too long', missingEvidence };
    }
    if (!Array.isArray(resume.experience)) {
      return { valid: false, error: 'rewritten_resume.experience must be an array', missingEvidence };
    }
    if (!Array.isArray(resume.education)) {
      return { valid: false, error: 'rewritten_resume.education must be an array', missingEvidence };
    }
    if (!hasTruthyObject(resume.skills)) {
      return { valid: false, error: 'rewritten_resume.skills is required', missingEvidence };
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
      const questions = getStringArray(rewrite.missing_evidence_questions);
      if (!original || !optimized) {
        return { valid: false, error: 'original_bullet and optimized_bullet are required', missingEvidence };
      }
      if (!Array.isArray(rewrite.evidence_used)) {
        return { valid: false, error: 'evidence_used must be an array', missingEvidence };
      }
      if (!Array.isArray(rewrite.missing_evidence_questions)) {
        return { valid: false, error: 'missing_evidence_questions must be an array', missingEvidence };
      }
      if (wordCount(optimized) > 45) {
        return { valid: false, error: 'optimized_bullet is too long', missingEvidence };
      }
      if (detectPotentialFabrication(original, optimized, evidence)) {
        return { valid: false, error: 'Potential fabricated metric detected', missingEvidence };
      }
      if (questions.length > 4) {
        return { valid: false, error: 'too many missing evidence questions', missingEvidence };
      }
    }

    return { valid: true, missingEvidence };
  }

  if (workflowType === 'ats_optimization_report') {
    if (!hasTruthyObject(parsed.ats_report)) {
      return { valid: false, error: 'ats_report is required', missingEvidence };
    }
    const report = parsed.ats_report as Record<string, unknown>;
    const matches = Array.isArray(report.keyword_match_analysis) ? report.keyword_match_analysis : [];
    const recommended = getStringArray(report.recommended_keywords_to_add);
    if (!Array.isArray(report.keyword_match_analysis)) {
      return { valid: false, error: 'keyword_match_analysis must be an array', missingEvidence };
    }
    if (!Array.isArray(report.recommended_keywords_to_add)) {
      return { valid: false, error: 'recommended_keywords_to_add must be an array', missingEvidence };
    }
    if (recommended.length > 20 || hasDuplicateStrings(recommended)) {
      return { valid: false, error: 'recommended keywords must be unique and at most 20', missingEvidence };
    }
    for (const row of matches) {
      if (!hasTruthyObject(row)) {
        return { valid: false, error: 'keyword_match_analysis rows must be objects', missingEvidence };
      }
      const item = row as Record<string, unknown>;
      if (!hasRequiredString(item, 'keyword') || typeof item.present !== 'boolean') {
        return { valid: false, error: 'keyword_match_analysis rows require keyword and present', missingEvidence };
      }
      const placement = String(item.suggested_placement || '');
      if (placement && !['summary', 'skills', 'experience', 'education'].includes(placement)) {
        return { valid: false, error: 'suggested_placement is invalid', missingEvidence };
      }
    }
    return { valid: true, missingEvidence };
  }

  if (workflowType === 'professional_summary_lab') {
    const options = Array.isArray(parsed.summary_options) ? parsed.summary_options : [];
    const recommendedIndex = Number(parsed.recommended_index);

    if (options.length !== 5) {
      return { valid: false, error: 'summary_options must include exactly 5 options', missingEvidence };
    }
    if (Number.isNaN(recommendedIndex) || recommendedIndex < 0 || recommendedIndex >= options.length) {
      return { valid: false, error: 'recommended_index is invalid', missingEvidence };
    }
    for (const option of options) {
      if (!hasTruthyObject(option)) {
        return { valid: false, error: 'summary_options rows must be objects', missingEvidence };
      }
      const row = option as Record<string, unknown>;
      if (!hasRequiredString(row, 'angle') || !hasRequiredString(row, 'summary') || !hasRequiredString(row, 'rationale')) {
        return { valid: false, error: 'summary_options rows require angle, summary, and rationale', missingEvidence };
      }
      if (wordCount(String(row.summary)) > 80) {
        return { valid: false, error: 'summary option is too long', missingEvidence };
      }
    }
    return { valid: true, missingEvidence };
  }

  if (workflowType === 'cover_letter_architect') {
    const variants = Array.isArray(parsed.cover_letter_variants) ? parsed.cover_letter_variants : [];
    const recommendedIndex = Number(parsed.recommended_index);
    if (variants.length !== 3) {
      return { valid: false, error: 'cover_letter_variants must include exactly 3 variants', missingEvidence };
    }
    if (Number.isNaN(recommendedIndex) || recommendedIndex < 0 || recommendedIndex >= variants.length) {
      return { valid: false, error: 'recommended_index is invalid', missingEvidence };
    }
    for (const variant of variants) {
      if (!hasTruthyObject(variant)) {
        return { valid: false, error: 'cover letter variants must be objects', missingEvidence };
      }
      const row = variant as Record<string, unknown>;
      if (
        !hasRequiredString(row, 'angle') ||
        !hasRequiredString(row, 'title') ||
        !hasRequiredString(row, 'opening_paragraph') ||
        !hasRequiredString(row, 'letter') ||
        !hasRequiredString(row, 'rationale')
      ) {
        return { valid: false, error: 'cover letter variants require all contract fields', missingEvidence };
      }
    }
    return { valid: true, missingEvidence };
  }

  if (workflowType === 'screening_answer_studio') {
    const rows = Array.isArray(parsed.screening_answers) ? parsed.screening_answers : [];
    if (rows.length < 5) {
      return { valid: false, error: 'screening_answers must include at least 5 answers', missingEvidence };
    }
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const question = String(item.question || '').trim();
      const answer = String(item.answer || '').trim();
      if (!question || !answer) {
        return { valid: false, error: 'screening answers require question and answer', missingEvidence };
      }
      if (!Array.isArray(item.evidence_used) || !hasRequiredString(item, 'confidence_note')) {
        return { valid: false, error: 'screening answers require evidence_used and confidence_note', missingEvidence };
      }
    }
    return { valid: true, missingEvidence };
  }

  if (workflowType === 'recruiter_outreach_kit') {
    if (!hasTruthyObject(parsed.outreach_kit)) {
      return { valid: false, error: 'outreach_kit is required', missingEvidence };
    }
    const kit = parsed.outreach_kit as Record<string, unknown>;
    if (
      typeof kit.linkedin_connect_note !== 'string' ||
      typeof kit.follow_up_message !== 'string' ||
      typeof kit.recruiter_email !== 'string'
    ) {
      return { valid: false, error: 'outreach_kit fields are invalid', missingEvidence };
    }
    return { valid: true, missingEvidence };
  }

  if (workflowType === 'interview_story_bank') {
    const stories = Array.isArray(parsed.story_bank) ? parsed.story_bank : [];
    if (stories.length < 3) {
      return { valid: false, error: 'story_bank must include at least 3 stories', missingEvidence };
    }
    return { valid: true, missingEvidence };
  }

  return { valid: false, error: 'Unknown workflow type', missingEvidence };
}
