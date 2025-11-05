/**
 * Validation Schemas using Zod
 *
 * This module provides type-safe validation schemas for:
 * - AI responses (OpenAI JSON outputs)
 * - API request payloads
 * - Database records
 */

import { z } from "zod";

// ==================== AI RESPONSE SCHEMAS ====================

/**
 * Schema for optimized resume returned by OpenAI
 * This ensures the AI response is properly structured
 */
const ExperienceSchema = z
  .object({
    company: z.string().default(""),
    position: z.string().optional(),
    title: z.string().optional(),
    location: z.string().default(""),
    startDate: z.string().default(""),
    endDate: z.string().optional(),
    description: z.string().optional().default(""),
    achievements: z.array(z.string()).optional(),
    highlights: z.array(z.string()).optional(),
  })
  .transform((experience) => ({
    ...experience,
    position: experience.position ?? experience.title ?? "",
    achievements: experience.achievements ?? experience.highlights ?? [],
  }));

const EducationSchema = z
  .object({
    institution: z.string().default(""),
    degree: z.string().default(""),
    field: z.string().optional(),
    location: z.string().optional().default(""),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    graduationDate: z.string().optional(),
    gpa: z.string().optional(),
  })
  .transform((education) => ({
    ...education,
    graduationDate: education.graduationDate ?? education.endDate ?? "",
  }));

export const OptimizedResumeSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  contact: z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(1, "Phone is required"),
    location: z.string().min(1, "Location is required"),
    linkedin: z.string().url().optional(),
    github: z.string().url().optional(),
    portfolio: z.string().url().optional(),
  }),
  skills: z.object({
    technical: z.array(z.string()).default([]),
    soft: z.array(z.string()).default([]),
    certifications: z.array(z.string()).optional().default([]),
  }),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  certifications: z.array(z.string()).optional().default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        technologies: z.array(z.string()).default([]),
        url: z.string().url().optional(),
      }),
    )
    .default([]),
  // Accept number or numeric string (e.g., "85" or "85%"), then coerce to 0-100
  matchScore: z
    .union([z.number(), z.string()])
    .transform((val) => {
      if (typeof val === "number") return val;
      const cleaned = val.replace(/%/g, "").trim();
      const parsed = parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    })
    .pipe(z.number().min(0).max(100)),
  improvements: z.array(z.string()).default([]),
  keyImprovements: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  missingKeywords: z.array(z.string()).default([]),
});

export type OptimizedResume = z.infer<typeof OptimizedResumeSchema>;

// ==================== API REQUEST SCHEMAS ====================

/**
 * Schema for optimize endpoint request
 */
export const OptimizeRequestSchema = z.object({
  resumeId: z.string().uuid("Invalid resume ID format"),
  jobDescriptionId: z.string().uuid("Invalid job description ID format"),
});

/**
 * Schema for upload resume endpoint request
 */
export const UploadResumeRequestSchema = z
  .object({
    resume: z.instanceof(File, { message: "Resume file is required" }),
    jobDescription: z
      .string()
      .min(10, "Job description must be at least 10 characters")
      .optional(),
    jobDescriptionUrl: z.string().url("Invalid job description URL").optional(),
  })
  .refine((data) => data.jobDescription || data.jobDescriptionUrl, {
    message: "Either job description text or URL is required",
    path: ["jobDescription"],
  });

/**
 * Schema for download endpoint request
 */
export const DownloadRequestSchema = z.object({
  id: z.string().uuid("Invalid optimization ID format"),
  format: z.enum(["pdf", "docx"], {
    errorMap: () => ({ message: "Format must be either 'pdf' or 'docx'" }),
  }),
});

// ==================== DATABASE SCHEMAS ====================

/**
 * Schema for resume data from database
 */
export const ResumeDataSchema = z.object({
  summary: z.string().min(1),
  contact: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    location: z.string().min(1),
    linkedin: z.string().url().optional(),
    github: z.string().url().optional(),
  }),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.object({
    technical: z.array(z.string()).default([]),
    soft: z.array(z.string()).default([]),
    certifications: z.array(z.string()).optional().default([]),
  }),
});

/**
 * Schema for job description data from database
 */
export const JobDescriptionSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters"),
  company: z.string().optional(),
  location: z.string().optional(),
  description: z.string().min(10, "Description must be at least 10 characters"),
  requirements: z.array(z.string().min(1)).default([]),
  niceToHave: z.array(z.string().min(1)).default([]),
  salary: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().optional(),
      currency: z.string().min(1),
    })
    .optional(),
});

/**
 * Schema for optimization data from database
 */
export const OptimizationDataSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  resume_id: z.string().uuid(),
  jd_id: z.string().uuid(),
  match_score: z.number().min(0).max(100),
  gaps_data: z.object({
    missingKeywords: z.array(z.string()),
    keyImprovements: z.array(z.string()),
  }),
  rewrite_data: OptimizedResumeSchema,
  template_key: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  created_at: z.string(),
});

export type JobDescription = z.infer<typeof JobDescriptionSchema>;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Safely parse JSON with Zod validation
 * Returns parsed data or throws with descriptive error
 */
export function parseAndValidate<T>(
  jsonString: string,
  schema: z.ZodSchema<T>,
  context?: string,
): T {
  try {
    const parsed = JSON.parse(jsonString);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const contextMsg = context ? ` (${context})` : "";
      const issues = error.errors
        .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
        .join("\n");
      throw new Error(`Invalid data structure${contextMsg}:\n${issues}`);
    }
    if (error instanceof SyntaxError) {
      const contextMsg = context ? ` (${context})` : "";
      throw new Error(`Invalid JSON format${contextMsg}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Safely validate data with Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function safeValidate<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return { success: false, error: issues };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

/**
 * Helper that safely parses JSON without throwing. Returns the parsed value or null when parsing fails.
 */
export function safeParseJson<T = unknown>(jsonString: string): T | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}
