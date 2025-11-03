export const APP_CONFIG = {
  name: "AI Resume Optimizer",
  description: "Optimize your resume for any job with AI",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFileTypes: [".pdf", ".doc", ".docx"],
  processingTimeout: 20000, // 20 seconds
  freeOptimizations: 1,
} as const;

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  auth: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
    resetPassword: "/auth/reset-password",
  },
  upload: "/dashboard/resume",
  optimizations: "/dashboard/optimizations",
  templates: "/templates",
  pricing: "/pricing",
};

export const API_ROUTES = {
  uploadResume: "/api/upload-resume",
  ingestJobDescription: "/api/ingest-jd",
  optimize: "/api/optimize",
  score: "/api/score",
  download: "/api/download",
  templates: "/api/templates",
} as const;

export const RESUME_TEMPLATES = [
  {
    key: "ats-safe",
    name: "ATS-Safe Professional",
    family: "ats" as const,
    description: "Clean, professional template optimized for ATS systems",
  },
  {
    key: "modern-creative",
    name: "Modern Creative",
    family: "modern" as const,
    description: "Contemporary design with visual elements",
  },
] as const;

/**
 * Chat Configuration
 */
export const CHAT_CONFIG = {
  /** Maximum message length in characters */
  maxMessageLength: 5000,
  /** Minimum message length in characters */
  minMessageLength: 1,
  /** Default session status */
  defaultSessionStatus: 'active' as const,
} as const;

/**
 * Technical keywords for skill categorization
 * Used to determine if a skill should be categorized as "technical" vs "soft"
 */
export const TECHNICAL_KEYWORDS = [
  'python',
  'javascript',
  'java',
  'react',
  'node',
  'sql',
  'aws',
  'docker',
  'git',
  'api',
  'css',
  'html',
  'typescript',
  'ai',
  'automation',
  'kubernetes',
  'terraform',
  'ansible',
  'jenkins',
  'ci/cd',
  'rest',
  'graphql',
  'mongodb',
  'postgresql',
  'redis',
  'kafka',
  'microservices',
  'azure',
  'gcp',
  'linux',
  'bash',
  'powershell',
  'c++',
  'c#',
  'go',
  'rust',
  'swift',
  'kotlin',
  '.net',
  'angular',
  'vue',
  'django',
  'flask',
  'spring',
  'express',
] as const;

/**
 * Design-related keywords for intent detection
 */
export const DESIGN_KEYWORDS = [
  'color',
  'font',
  'design',
  'style',
  'layout',
  'spacing',
  'header',
  'template',
  'theme',
  'background',
  'text color',
  'font size',
  'bold',
  'italic',
  'underline',
  'margin',
  'padding',
  'make it look',
  'change the look',
  'visual',
  'appearance',
] as const;

/**
 * Content-related keywords for intent detection
 */
export const CONTENT_KEYWORDS = [
  'add',
  'remove',
  'delete',
  'modify',
  'change',
  'update',
  'experience',
  'skill',
  'education',
  'summary',
  'achievement',
  'work history',
  'job',
  'company',
  'certification',
  'project',
] as const;