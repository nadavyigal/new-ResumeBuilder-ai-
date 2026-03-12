import type { OptimizedResume } from "@/lib/ai-optimizer";
import { getOpenAI } from "@/lib/openai";

const STRUCTURE_RESUME_SYSTEM_PROMPT = `You convert a resume into structured JSON.

Rules:
- Return valid JSON only.
- Extract only what is explicitly supported by the resume text.
- Do not invent employers, dates, metrics, tools, certifications, links, or projects.
- Preserve the candidate's original language when possible.
- Keep the schema exactly as requested.

Schema:
{
  "summary": "string",
  "contact": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "title": "string (optional)",
    "company": "string (optional)",
    "linkedin": "string (optional)",
    "portfolio": "string (optional)"
  },
  "skills": {
    "technical": ["string"],
    "soft": ["string"]
  },
  "experience": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "achievements": ["string"],
      "responsibilities": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "location": "string",
      "graduationDate": "string",
      "gpa": "string (optional)"
    }
  ],
  "certifications": ["string"],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"]
    }
  ],
  "matchScore": 0,
  "keyImprovements": [],
  "missingKeywords": []
}`;

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function createEmptyOptimizedResume(): OptimizedResume {
  return {
    summary: "",
    contact: {
      name: "",
      email: "",
      phone: "",
      location: "",
      title: "",
      company: "",
      linkedin: "",
      portfolio: "",
    },
    skills: {
      technical: [],
      soft: [],
    },
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
  };
}

export function normalizeOptimizedResume(
  value: unknown,
  fallback?: Partial<OptimizedResume>
): OptimizedResume {
  const base = createEmptyOptimizedResume();
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const contactSource =
    source.contact && typeof source.contact === "object" && !Array.isArray(source.contact)
      ? (source.contact as Record<string, unknown>)
      : {};

  const skillsSource =
    source.skills && typeof source.skills === "object" && !Array.isArray(source.skills)
      ? (source.skills as Record<string, unknown>)
      : {};

  const normalized: OptimizedResume = {
    summary: firstNonEmptyString(source.summary, fallback?.summary, base.summary),
    contact: {
      name: firstNonEmptyString(contactSource.name, fallback?.contact?.name, base.contact.name),
      email: firstNonEmptyString(contactSource.email, fallback?.contact?.email, base.contact.email),
      phone: firstNonEmptyString(contactSource.phone, fallback?.contact?.phone, base.contact.phone),
      location: firstNonEmptyString(
        contactSource.location,
        fallback?.contact?.location,
        base.contact.location
      ),
      title: firstNonEmptyString(contactSource.title, fallback?.contact?.title, base.contact.title),
      company: firstNonEmptyString(
        contactSource.company,
        fallback?.contact?.company,
        base.contact.company
      ),
      linkedin: firstNonEmptyString(
        contactSource.linkedin,
        fallback?.contact?.linkedin,
        base.contact.linkedin
      ),
      portfolio: firstNonEmptyString(
        contactSource.portfolio,
        fallback?.contact?.portfolio,
        base.contact.portfolio
      ),
    },
    skills: {
      technical: toStringArray(skillsSource.technical),
      soft: toStringArray(skillsSource.soft),
    },
    experience: Array.isArray(source.experience)
      ? source.experience
          .map((item) => {
            const row =
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>)
                : {};
            return {
              title: firstNonEmptyString(row.title),
              company: firstNonEmptyString(row.company),
              location: firstNonEmptyString(row.location),
              startDate: firstNonEmptyString(row.startDate),
              endDate: firstNonEmptyString(row.endDate),
              achievements: toStringArray(row.achievements),
              responsibilities: toStringArray(row.responsibilities),
            };
          })
          .filter((item) => item.title || item.company || item.achievements.length > 0)
      : fallback?.experience || base.experience,
    education: Array.isArray(source.education)
      ? source.education
          .map((item) => {
            const row =
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>)
                : {};
            return {
              degree: firstNonEmptyString(row.degree),
              institution: firstNonEmptyString(row.institution),
              location: firstNonEmptyString(row.location),
              graduationDate: firstNonEmptyString(row.graduationDate),
              gpa: firstNonEmptyString(row.gpa),
            };
          })
          .filter((item) => item.degree || item.institution)
      : fallback?.education || base.education,
    certifications: Array.isArray(source.certifications)
      ? toStringArray(source.certifications)
      : fallback?.certifications || base.certifications,
    projects: Array.isArray(source.projects)
      ? source.projects
          .map((item) => {
            const row =
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>)
                : {};
            return {
              name: firstNonEmptyString(row.name),
              description: firstNonEmptyString(row.description),
              technologies: toStringArray(row.technologies),
            };
          })
          .filter((item) => item.name || item.description)
      : fallback?.projects || base.projects,
    matchScore:
      typeof source.matchScore === "number" && Number.isFinite(source.matchScore)
        ? Math.max(0, Math.min(100, Math.round(source.matchScore)))
        : fallback?.matchScore || base.matchScore,
    keyImprovements: Array.isArray(source.keyImprovements)
      ? toStringArray(source.keyImprovements)
      : fallback?.keyImprovements || base.keyImprovements,
    missingKeywords: Array.isArray(source.missingKeywords)
      ? toStringArray(source.missingKeywords)
      : fallback?.missingKeywords || base.missingKeywords,
  };

  return normalized;
}

function heuristicCanonicalResume(rawText: string): OptimizedResume {
  const fallback = createEmptyOptimizedResume();
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const email =
    rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || fallback.contact.email;
  const phone =
    rawText.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() || fallback.contact.phone;
  const linkedin =
    rawText.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+/i)?.[0] || fallback.contact.linkedin;

  const summary = lines.slice(0, Math.min(lines.length, 4)).join(" ");

  return {
    ...fallback,
    summary,
    contact: {
      ...fallback.contact,
      name: lines[0] || "",
      email,
      phone,
      linkedin,
      location: lines[1] || "",
    },
  };
}

export async function parseResumeToCanonical(rawText: string): Promise<OptimizedResume> {
  if (!rawText.trim()) {
    return createEmptyOptimizedResume();
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: STRUCTURE_RESUME_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Resume text:\n${rawText}\n\nReturn only the structured JSON.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return heuristicCanonicalResume(rawText);
    }

    return normalizeOptimizedResume(JSON.parse(content));
  } catch (error) {
    console.error("Failed to structure original resume, using heuristic fallback:", error);
    return heuristicCanonicalResume(rawText);
  }
}
