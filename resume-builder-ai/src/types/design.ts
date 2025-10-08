/**
 * TypeScript Type Definitions for Design Feature
 * Feature 003: AI-Powered Resume Design Selection
 * Task: T048
 *
 * Exports all interfaces from data-model.md for consumption by:
 * - API routes
 * - React components
 * - Library modules
 * - External integrations
 */

/**
 * Design Template
 * Represents an available resume design template
 */
export interface DesignTemplate {
  /** Unique template identifier */
  id: string;

  /** Human-readable template name */
  name: string;

  /** URL-friendly slug for template identification */
  slug: string;

  /** Template category for filtering */
  category: 'modern' | 'traditional' | 'creative' | 'corporate';

  /** Template description for display */
  description: string;

  /** Relative file path to template component */
  file_path: string;

  /** URL to preview thumbnail (optional) */
  preview_thumbnail_url?: string | null;

  /** Whether template requires premium subscription */
  is_premium: boolean;

  /** ATS compatibility score (0-100) */
  ats_compatibility_score: number;

  /** Supported customization features */
  supported_customizations: {
    colors: boolean;
    fonts: boolean;
    layout: boolean;
  };

  /** Default configuration values */
  default_config: DesignConfig;

  /** Template creation timestamp */
  created_at: string;

  /** Template last update timestamp */
  updated_at: string;
}

/**
 * Design Configuration
 * Defines visual styling for a template
 */
export interface DesignConfig {
  /** Color scheme configuration */
  color_scheme: ColorScheme;

  /** Font family configuration */
  font_family: FontFamily;

  /** Spacing configuration */
  spacing_settings: SpacingSettings;

  /** Layout variant (optional) */
  layout_variant?: string | null;
}

/**
 * Color Scheme
 * Defines color palette for template
 */
export interface ColorScheme {
  /** Primary brand color (hex format) */
  primary: string;

  /** Secondary accent color (hex format) */
  secondary: string;

  /** Tertiary accent color (hex format) */
  accent: string;

  /** Background color (hex format, optional) */
  background?: string;

  /** Text color (hex format, optional) */
  text?: string;
}

/**
 * Font Family
 * Defines typography settings
 */
export interface FontFamily {
  /** Font for headings */
  heading: string;

  /** Font for body text */
  body: string;
}

/**
 * Spacing Settings
 * Defines layout spacing configuration
 */
export interface SpacingSettings {
  /** Whether to use compact spacing */
  compact?: boolean;

  /** Line height multiplier (1.0 - 3.0) */
  line_height?: string | number;

  /** Section gap (CSS value) */
  section_gap?: string;
}

/**
 * Design Customization
 * Represents user-specific design modifications
 */
export interface DesignCustomization {
  /** Unique customization identifier */
  id: string;

  /** Associated template ID */
  template_id: string;

  /** Custom color scheme */
  color_scheme: ColorScheme;

  /** Custom font family */
  font_family: FontFamily;

  /** Custom spacing settings */
  spacing_settings: SpacingSettings;

  /** Layout variant override (optional) */
  layout_variant?: string | null;

  /** Custom CSS (ATS-validated, optional) */
  custom_css?: string | null;

  /** ATS safety validation result */
  is_ats_safe: boolean;

  /** ATS validation errors (if any) */
  ats_validation_errors?: ATSValidationError[];

  /** Customization creation timestamp */
  created_at: string;
}

/**
 * Resume Design Assignment
 * Links an optimization to a template and customizations
 */
export interface ResumeDesignAssignment {
  /** Unique assignment identifier */
  id: string;

  /** Owner user ID */
  user_id: string;

  /** Associated optimization ID */
  optimization_id: string;

  /** Current template ID */
  template_id: string;

  /** Current customization ID (optional) */
  customization_id?: string | null;

  /** Previous customization ID for undo (optional) */
  previous_customization_id?: string | null;

  /** Original recommended template ID */
  original_template_id: string;

  /** Whether assignment is active */
  is_active: boolean;

  /** Finalization timestamp (optional) */
  finalized_at?: string | null;

  /** Populated template object (join) */
  template?: DesignTemplate;

  /** Populated customization object (join, optional) */
  customization?: DesignCustomization | null;

  /** Populated original template object (join) */
  original_template?: DesignTemplate;

  /** Assignment creation timestamp */
  created_at: string;

  /** Assignment last update timestamp */
  updated_at: string;
}

/**
 * ATS Validation Error
 * Represents a single ATS compatibility violation
 */
export interface ATSValidationError {
  /** CSS property or HTML tag that failed validation */
  property: string;

  /** The actual value that was rejected */
  value: string;

  /** Human-readable explanation of why it failed */
  reason: string;
}

/**
 * ATS Validation Result
 * Result of validating a customization for ATS safety
 */
export interface ATSValidationResult {
  /** Whether customization passed all ATS checks */
  isValid: boolean;

  /** List of validation errors (empty if valid) */
  errors: string[];
}

/**
 * Customization Result
 * Response from AI customization endpoint
 */
export interface CustomizationResult {
  /** Applied customization configuration */
  customization: DesignCustomization & {
    is_ats_safe: boolean;
  };

  /** AI reasoning for the changes */
  reasoning: string;

  /** Rendered HTML preview */
  preview: string;
}

/**
 * Interpretation Result
 * Result of interpreting a natural language design request
 */
export interface InterpretationResult {
  /** Whether request was successfully understood */
  understood: boolean;

  /** Interpreted customization config (if understood) */
  customization?: Partial<DesignConfig>;

  /** AI reasoning for interpretation (if understood) */
  reasoning?: string;

  /** Clarification needed (if not understood) */
  clarificationNeeded?: string;

  /** Error type (if not understood) */
  error?: 'ats_violation' | 'unclear_request' | 'fabrication' | 'invalid_request';

  /** Validation errors (if ATS violation) */
  validationErrors?: string[];
}

/**
 * Template Recommendation Result
 * Response from AI template recommendation
 */
export interface TemplateRecommendationResult {
  /** Recommended template */
  recommendedTemplate: DesignTemplate;

  /** AI reasoning for recommendation */
  reasoning: string;
}

/**
 * ATS Safe Rules
 * Whitelist/blacklist rules for ATS compatibility
 */
export interface ATSSafeRules {
  /** Allowed HTML tags */
  allowedTags: string[];

  /** Blocked HTML tags */
  blockedTags: string[];

  /** Allowed CSS properties */
  allowedCssProperties: string[];

  /** Blocked CSS properties */
  blockedCssProperties: string[];

  /** Allowed font families */
  allowedFonts: string[];

  /** Maximum file size in bytes */
  maxFileSize: number;
}

/**
 * Template List Response
 * API response for GET /design/templates
 */
export interface TemplateListResponse {
  /** Array of available templates */
  templates: DesignTemplate[];
}

/**
 * Design Assignment Response
 * API response for GET /design/{optimizationId}
 */
export interface DesignAssignmentResponse extends ResumeDesignAssignment {
  /** Always includes populated template */
  template: DesignTemplate;

  /** Populated customization (may be null) */
  customization: DesignCustomization | null;

  /** Always includes original template */
  original_template: DesignTemplate;
}

/**
 * Customization Request
 * API request body for POST /design/{optimizationId}/customize
 */
export interface CustomizationRequest {
  /** Natural language design change request */
  changeRequest: string;
}

/**
 * Customization Response
 * API response for POST /design/{optimizationId}/customize
 */
export interface CustomizationResponse {
  /** Applied customization */
  customization: DesignCustomization;

  /** Rendered HTML preview */
  preview: string;

  /** Diff of what changed */
  changes: {
    color_scheme?: Partial<ColorScheme>;
    font_family?: Partial<FontFamily>;
    spacing_settings?: Partial<SpacingSettings>;
  };

  /** AI reasoning for changes */
  reasoning: string;
}

/**
 * Undo Response
 * API response for POST /design/{optimizationId}/undo
 */
export interface UndoResponse {
  /** Reverted customization */
  customization: DesignCustomization;

  /** Rendered HTML preview of reverted state */
  preview: string;
}

/**
 * Revert Response
 * API response for POST /design/{optimizationId}/revert
 */
export interface RevertResponse {
  /** Original template */
  template: DesignTemplate;

  /** Rendered HTML preview of original template */
  preview: string;
}

/**
 * Template Update Request
 * API request body for PUT /design/{optimizationId}
 */
export interface TemplateUpdateRequest {
  /** New template ID to apply */
  templateId: string;
}

/**
 * Recommendation Request
 * API request body for POST /design/recommend
 */
export interface RecommendationRequest {
  /** Optimization ID to analyze */
  optimizationId: string;
}

/**
 * Error Response
 * Standard API error response format
 */
export interface ErrorResponse {
  /** Error code */
  error: string;

  /** Human-readable error message */
  message: string;

  /** Additional error details (optional) */
  details?: Record<string, any>;

  /** Validation errors (optional) */
  validationErrors?: ATSValidationError[];

  /** Clarification needed (optional) */
  clarificationNeeded?: string;
}

/**
 * JSON Resume Format
 * Standard resume data format for template rendering
 */
export interface JSONResume {
  /** Personal information */
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    website?: string;
  };

  /** Professional summary */
  summary: string;

  /** Work experience entries */
  experience: Array<{
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    achievements: string[];
  }>;

  /** Education entries */
  education: Array<{
    degree: string;
    institution: string;
    location: string;
    graduationDate: string;
    gpa?: string;
    honors?: string[];
  }>;

  /** Skills */
  skills: {
    technical: string[];
    soft: string[];
  };

  /** Certifications (optional) */
  certifications?: string[];

  /** Projects (optional) */
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
    url?: string;
  }>;
}

/**
 * Type guard to check if an object is a DesignTemplate
 */
export function isDesignTemplate(obj: any): obj is DesignTemplate {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    typeof obj.category === 'string' &&
    typeof obj.file_path === 'string'
  );
}

/**
 * Type guard to check if an object is a DesignCustomization
 */
export function isDesignCustomization(obj: any): obj is DesignCustomization {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.template_id === 'string' &&
    typeof obj.is_ats_safe === 'boolean'
  );
}

/**
 * Type guard to check if an object is a ResumeDesignAssignment
 */
export function isResumeDesignAssignment(obj: any): obj is ResumeDesignAssignment {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.optimization_id === 'string' &&
    typeof obj.template_id === 'string'
  );
}

/**
 * Re-export from other modules for convenience
 */
export type { OptimizedResume } from '@/lib/ai-optimizer';
