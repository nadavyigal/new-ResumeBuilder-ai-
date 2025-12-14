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
export const OptimizedResumeSchema = z.object({
  summary: z.string().default(""),
  contact: z.object({
    name: z.string().default(""),
    email: z.string().email("Invalid email format").default(""),
    phone: z.string().default(""),
    location: z.string().default(""),
    linkedin: z.string().url().optional().or(z.literal("")),
    github: z.string().url().optional().or(z.literal("")),
    portfolio: z.string().url().optional().or(z.literal("")),
  }),
  skills: z.object({
    technical: z.array(z.string()).default([]),
    soft: z.array(z.string()).default([]),
    certifications: z.array(z.string()).optional().default([]),
  }),
  experience: z
    .array(
      z.object({
        position: z.string().default(""),
        company: z.string().default(""),
        location: z.string().optional().default(""),
        startDate: z.string().default(""),
        endDate: z.string().optional().default(""),
        description: z.string().optional().default(""),
        highlights: z.array(z.string()).optional().default([]),
        achievements: z.array(z.string()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string().default(""),
        institution: z.string().default(""),
        location: z.string().optional().default(""),
        startDate: z.string().default(""),
        endDate: z.string().optional().default(""),
        graduationDate: z.string().optional().default(""),
        gpa: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  certifications: z.array(z.string()).optional().default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        technologies: z.array(z.string()).default([]),
        url: z.string().url().optional().or(z.literal("")),
      }),
    )
    .optional()
    .default([]),
  // Accept number or numeric string (e.g., "85" or "85%"), then coerce to 0-100
  matchScore: z
    .union([z.number(), z.string()])
    .transform((val) => {
      if (typeof val === 'number') return val;
      const cleaned = val.replace(/%/g, '').trim();
      const parsed = parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    })
    .pipe(z.number().min(0).max(100)),
  improvements: z.array(z.string()).default([]),
  keyImprovements: z.array(z.string()).optional().default([]),
  keywords: z.array(z.string()).default([]),
  missingKeywords: z.array(z.string()).optional().default([]),
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
 * Schema for resume data (used in tests and API validation)
 * Flexible schema that matches both test fixtures and database records
 */
export const ResumeDataSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  summary: z.string().optional(),
  contact: z.object({
    name: z.string(),
    email: z.string().email("Invalid email format"),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    portfolio: z.string().optional(),
  }).optional(),
  experience: z.array(z.object({
    company: z.string(),
    position: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    description: z.string().optional(),
    highlights: z.array(z.string()).optional(),
  })).optional(),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    gpa: z.string().optional(),
  })).optional(),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
  }).optional(),
  filename: z.string().optional(),
  storage_path: z.string().optional(),
  raw_text: z.string().optional(),
  canonical_data: z.record(z.any()).optional(),
  created_at: z.string().optional(),
});

/**
 * Schema for job description (used in tests and API validation)
 * Flexible schema that matches both test fixtures and database records
 */
export const JobDescriptionSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters"),
  company: z.string().optional(),
  location: z.string().optional(),
  description: z.string(),
  requirements: z.array(z.string()).optional(),
  niceToHave: z.array(z.string()).optional(),
  salary: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
});

/**
 * Schema for job description data from database
 */
export const JobDescriptionDataSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  company: z.string(),
  raw_text: z.string(),
  clean_text: z.string(),
  extracted_data: z.record(z.any()).optional(),
  source_url: z.string().url().optional().or(z.null()),
  created_at: z.string(),
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
 * Safely parse JSON string without throwing
 * Returns parsed object or null on failure
 */
export function safeParseJson(jsonString: string): unknown | null {
  try {
    if (!jsonString || jsonString.trim() === '') {
      return null;
    }
    return JSON.parse(jsonString);
  } catch {
    return null;
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
