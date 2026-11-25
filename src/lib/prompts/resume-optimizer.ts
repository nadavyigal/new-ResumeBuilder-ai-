/**
 * Prompts for the core resume optimizer (PLAN tier).
 *
 * The system prompt is static so it is identical for every call; the language
 * rules and all user data go in the user message, inside data tags.
 * Design doc: docs/ai-prompt-upgrade/phase1-review.md, section 6.1.
 * Prompts do not replace the guards: normalizeExperienceBullets,
 * stripPlaceholderValues, stripFabricatedMetrics, enforceJobAdTruth and
 * enforceSeniorityTruth all still run on the output.
 */

import { selectModel, type ModelSelection } from '@/lib/model-tiers';
import {
  CONTENT_RULES,
  DATA_NOTICE,
  TRUTH_RULES,
  languageRules,
  resolveOutputLanguage,
  wrap,
  type OutputLanguage,
} from './shared';

export const RESUME_OPTIMIZATION_SYSTEM_PROMPT = `# Role
You tailor one candidate's resume to one job posting. The candidate sends the result to employers under their own name, so every statement must be true for them.

${DATA_NOTICE}

${TRUTH_RULES}

# What to improve
- Relevance: bring forward the experience that matches the posting. Where the resume already shows something the posting asks for, use the posting's wording for it.
- Summary: 2 to 4 lines. Describe the candidate by titles they have held and what they did. The target role may appear only as a goal ("seeking a Product Manager role"), never as who the candidate already is.
- Bullets: start with a specific action verb, then scope, tools and outcome, all from the resume. You may merge, reorder or tighten bullets, and you may expand a briefly mentioned item into a full bullet without raising its scope. If a bullet has no number, keep it concrete and non-numeric.
- Readability: standard section names, plain text, no keyword lists inside sentences.
- Terms that <gap_notes> lists as not found in the resume are posting terms the resume does not contain. Do not claim them. Use one only where the resume already shows the same thing in other words, and stay within that evidence.

${CONTENT_RULES}

# Output fields
- experience: one entry per role in the resume, in the same order, each with a non-empty "achievements" array. If a role's source is thin, keep its bullets short instead of dropping it.
- startDate, endDate, graduationDate: copy exactly as the resume writes them. Use "" when the resume gives none.
- contact.linkedin, contact.portfolio: the link as written in the resume, or "".
- skills.technical: only skills the resume mentions, most relevant first. skills.soft: only soft skills the resume states or clearly shows.
- certifications and projects: only those in the resume, or [].
- keyImprovements: up to 5 short notes on what you changed.
- missingKeywords: important posting terms the resume does not support. The app shows them to the candidate as honest gaps.
- matchScore: your rough estimate, 0 to 100 with no percent sign, of how well the tailored resume matches the posting. The app labels it as an estimate.

# Before you answer, check
- Every employer, title and date matches the resume.
- No tool, credential, number or year count appears that the resume lacks.
- Every role is present with a non-empty "achievements" array.
- All text values are in the output language.`;

/**
 * Compact schema text, used only when the API rejects the strict json_schema
 * and the call falls back to json_object mode.
 */
export const RESUME_SCHEMA_TEXT = `# JSON shape (keys exactly as written)
{ "summary": string,
  "contact": { "name": string, "email": string, "phone": string, "location": string, "linkedin": string, "portfolio": string },
  "skills": { "technical": [string], "soft": [string] },
  "experience": [ { "title": string, "company": string, "location": string, "startDate": string, "endDate": string, "achievements": [string] } ],
  "education": [ { "degree": string, "institution": string, "location": string, "graduationDate": string } ],
  "certifications": [string],
  "projects": [ { "name": string, "description": string, "technologies": [string] } ],
  "matchScore": number, "keyImprovements": [string], "missingKeywords": [string] }
The bullet array of every role is named "achievements".`;

const STRING = { type: 'string' } as const;
const STRING_ARRAY = { type: 'array', items: STRING } as const;

function strictObject(properties: Record<string, unknown>) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

/**
 * Structured Outputs schema for the tailored resume. Same keys as the prose
 * schema the optimizer used before, so stored rows and API responses keep
 * their shape. A strict schema makes the "achievements" key a guarantee
 * (WP-64 key drift), not a request.
 */
export const TAILORED_RESUME_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'tailored_resume',
    strict: true,
    schema: strictObject({
      summary: STRING,
      contact: strictObject({
        name: STRING,
        email: STRING,
        phone: STRING,
        location: STRING,
        linkedin: STRING,
        portfolio: STRING,
      }),
      skills: strictObject({ technical: STRING_ARRAY, soft: STRING_ARRAY }),
      experience: {
        type: 'array',
        items: strictObject({
          title: STRING,
          company: STRING,
          location: STRING,
          startDate: STRING,
          endDate: STRING,
          achievements: STRING_ARRAY,
        }),
      },
      education: {
        type: 'array',
        items: strictObject({ degree: STRING, institution: STRING, location: STRING, graduationDate: STRING }),
      },
      certifications: STRING_ARRAY,
      projects: {
        type: 'array',
        items: strictObject({ name: STRING, description: STRING, technologies: STRING_ARRAY }),
      },
      matchScore: { type: 'number' },
      keyImprovements: STRING_ARRAY,
      missingKeywords: STRING_ARRAY,
    }),
  },
};

function bulletList(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'none';
}

/**
 * Fallback / retry user prompt (optimizeResume): no gap data.
 */
export const RESUME_OPTIMIZATION_USER_PROMPT = (
  resumeText: string,
  jobDescription: string,
  outputLanguage: OutputLanguage = resolveOutputLanguage(resumeText, jobDescription)
) => `${languageRules(outputLanguage)}

${wrap('original_resume', resumeText)}

${wrap('job_posting', jobDescription)}

Tailor the resume to the posting. Return only the JSON object.`;

/**
 * Configuration for OpenAI API calls.
 * `model` is the code default only; OPENAI_MODEL_PLAN overrides it (selectOptimizerModel).
 */
export const OPTIMIZATION_CONFIG = {
  model: 'gpt-4o',
  temperature: 0.35,
  maxTokens: 4000,
  /** Cap for reasoning models only (reasoning tokens count against it). */
  reasoningMaxTokens: 8000,
  timeout: 50000,
};

/** PLAN tier: core CV tailoring. Target gpt-6.2-sol at effort low. */
export function selectOptimizerModel(): ModelSelection {
  return selectModel('PLAN', OPTIMIZATION_CONFIG.model);
}

/**
 * Shape of gap data passed into the second-pass prompt
 */
export interface ResumeOptimizationGaps {
  missingKeywords: string[];
  lowSubscores: Record<string, number>;
  mustHave: string[];
}

export interface GapPromptOptions {
  /** Defaults to resolveOutputLanguage(resumeText, jobDescription). */
  outputLanguage?: OutputLanguage;
  /**
   * Pass 2: the pass-1 result to improve. `resumeText` stays the ORIGINAL
   * resume, which is the only evidence; the draft is the starting point.
   */
  draftText?: string;
}

/**
 * Gap-injected user prompt. Pass 1 sends the original resume; pass 2 sends the
 * original resume as evidence plus the pass-1 draft to improve.
 */
export const RESUME_OPTIMIZATION_GAP_PROMPT = (
  resumeText: string,
  jobDescription: string,
  gaps: ResumeOptimizationGaps,
  options: GapPromptOptions = {}
) => {
  const outputLanguage = options.outputLanguage ?? resolveOutputLanguage(resumeText, jobDescription);
  const lowSubscores = Object.entries(gaps.lowSubscores).map(([k, v]) => `${k} ${v}`);
  const gapNotes = wrap(
    'gap_notes',
    [
      `Posting terms not found in the resume (do not claim them): ${bulletList(gaps.missingKeywords)}`,
      `Must-have requirements (make real evidence easier to see; never claim one the resume lacks): ${bulletList(gaps.mustHave)}`,
      `Weak areas (subscores below 60): ${bulletList(lowSubscores)}`,
    ].join('\n')
  );
  const draft = options.draftText !== undefined;
  return [
    languageRules(outputLanguage),
    wrap('original_resume', resumeText),
    ...(draft ? [wrap('current_draft', options.draftText)] : []),
    wrap('job_posting', jobDescription),
    gapNotes,
    draft
      ? 'Improve <current_draft> for the gaps above. <original_resume> is the only evidence about the candidate: remove anything in the draft it does not support, and keep every role and true strength the draft already has. Return only the JSON object.'
      : 'Tailor the resume to the posting. Where the resume supports a listed gap, make that evidence easier to see; where it does not, leave the gap open. Return only the JSON object.',
  ].join('\n\n');
};

/**
 * One bounded repair after the job-ad terms guard finds a tool the original
 * résumé never mentions, or a supported tool the rewrite dropped. It names the
 * terms, never the reason text, and asks for the full JSON back so the
 * pipeline's own checks can run on it again.
 */
export const RESUME_TRUTH_REPAIR_PROMPT = (
  originalResumeText: string,
  candidate: object,
  issues: { unsupported: string[]; lost: string[] },
  outputLanguage?: OutputLanguage
) => {
  const fixes: string[] = [];
  if (issues.unsupported.length > 0) {
    fixes.push(
      `- The draft claims ${issues.unsupported.join(', ')}, which the original resume never mentions. Remove every claim of them from the summary, skills, bullets, certifications and projects. Do not replace them with any other tool, platform or credential the original resume does not mention.`
    );
  }
  if (issues.lost.length > 0) {
    fixes.push(
      `- The original resume shows ${issues.lost.join(', ')}, and the job asks for it, but the draft dropped it. Bring it back where the original resume supports it.`
    );
  }
  return [
    ...(outputLanguage ? [languageRules(outputLanguage)] : []),
    wrap('original_resume', originalResumeText),
    wrap('current_draft', JSON.stringify(candidate, null, 2)),
    `Fix only these problems in <current_draft> and return the full corrected JSON with the same keys:
${fixes.join('\n')}
- Keep every employer, title, date, number and unaffected bullet exactly as it is.
- Every role keeps a non-empty "achievements" array.
Return only the JSON object.`,
  ].join('\n\n');
};
