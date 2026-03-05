/**
 * Request Validators Module
 * Zod schemas for validating PDF generation requests
 *
 * Phase 2: PDF Generation Logic
 */

const { z } = require('zod');

// Personal Info Schema
const PersonalInfoSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().url().optional().or(z.literal('')),
    website: z.string().url().optional().or(z.literal('')),
    title: z.string().optional(),
  })
  .optional();

// Experience Schema
const ExperienceSchema = z.object({
  company: z.string(),
  position: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  achievements: z.array(z.string()).optional(),
});

// Education Schema
const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  graduationDate: z.string(),
  gpa: z.string().optional(),
});

// Certification Schema (supports both string and object formats)
const CertificationSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    issuer: z.string().optional(),
    date: z.string().optional(),
  }),
]);

// Project Schema
const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()).optional(),
});

// Color Scheme Schema
const ColorSchemeSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string().optional(),
    text: z.string().optional(),
  })
  .optional();

// Font Family Schema
const FontFamilySchema = z
  .object({
    heading: z.string().optional(),
    body: z.string().optional(),
  })
  .optional();

// Spacing Schema
const SpacingSchema = z
  .object({
    line_height: z.string().optional(),
    section_gap: z.string().optional(),
  })
  .optional();

// Customization Schema
const CustomizationSchema = z
  .object({
    color_scheme: ColorSchemeSchema,
    font_family: FontFamilySchema,
    spacing: SpacingSchema,
    custom_css: z.string().optional(),
  })
  .optional()
  .nullable();

// Resume Data Schema
const ResumeDataSchema = z.object({
  personalInfo: PersonalInfoSchema,
  summary: z.string().optional(),
  experience: z.array(ExperienceSchema).optional(),
  education: z.array(EducationSchema).optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(CertificationSchema).optional(),
  projects: z.array(ProjectSchema).optional(),
});

// PDF Generation Request Schema
const GeneratePdfRequestSchema = z.object({
  resumeData: ResumeDataSchema,
  templateSlug: z.enum(['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr']),
  customization: CustomizationSchema,
});

/**
 * Validates PDF generation request
 * @param {Object} data - Request data to validate
 * @returns {Object} Validation result
 */
function validateGeneratePdfRequest(data) {
  try {
    const validated = GeneratePdfRequestSchema.parse(data);
    return {
      success: true,
      data: validated,
      errors: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };
    }
    return {
      success: false,
      data: null,
      errors: [{ message: error.message }],
    };
  }
}

/**
 * Validates resume data only
 * @param {Object} data - Resume data to validate
 * @returns {Object} Validation result
 */
function validateResumeData(data) {
  try {
    const validated = ResumeDataSchema.parse(data);
    return {
      success: true,
      data: validated,
      errors: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };
    }
    return {
      success: false,
      data: null,
      errors: [{ message: error.message }],
    };
  }
}

/**
 * Validates customization object
 * @param {Object} data - Customization data to validate
 * @returns {Object} Validation result
 */
function validateCustomization(data) {
  try {
    const validated = CustomizationSchema.parse(data);
    return {
      success: true,
      data: validated,
      errors: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };
    }
    return {
      success: false,
      data: null,
      errors: [{ message: error.message }],
    };
  }
}

/**
 * Validates template slug
 * @param {string} templateSlug - Template identifier
 * @returns {boolean}
 */
function isValidTemplateSlug(templateSlug) {
  const validSlugs = ['minimal-ssr', 'card-ssr', 'sidebar-ssr', 'timeline-ssr'];
  return validSlugs.includes(templateSlug);
}

module.exports = {
  // Schemas
  ResumeDataSchema,
  CustomizationSchema,
  GeneratePdfRequestSchema,

  // Validation functions
  validateGeneratePdfRequest,
  validateResumeData,
  validateCustomization,
  isValidTemplateSlug,
};
