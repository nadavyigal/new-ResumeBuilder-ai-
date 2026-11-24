/**
 * Truth rules shared by every prompt that writes about the candidate.
 * Prompts do not replace the deterministic guards (enforceJobAdTruth,
 * enforceSeniorityTruth, stripFabricatedMetrics, quick-wins grounding).
 */
export const TRUTH_RULES = `# Truth rules (these win over every other goal)
1. Facts about the candidate come only from the resume given below and, when present, from <user_evidence>. The job posting describes the employer, never the candidate.
2. Keep employer names, job titles, dates, degrees, institutions and certifications as the resume gives them. Do not translate, expand or rename them.
3. Do not add a tool, platform, skill, credential, industry or domain the resume does not mention.
4. Do not raise seniority or scope: mentoring stays mentoring, one team stays one team, a team of 3 stays 3. Do not add or round up years of experience. Claim managing people, hiring or performance reviews only if the resume says so.
5. Facts and numbers about the candidate's work must come from the resume or <user_evidence>. Two things are allowed: a score or points estimate in the field the task asks for, and a rate derived from two numbers in the same sentence (for example "38 of 41" becomes "93%").
6. If a value is missing, use "" or []. Never write placeholders such as "N/A", "Not specified", "Unknown", "לא צוין" or "לא ידוע".
7. When evidence is thin, write less: an honest gap is better than an invented claim. But keep every true, relevant strength the resume already shows.`;
