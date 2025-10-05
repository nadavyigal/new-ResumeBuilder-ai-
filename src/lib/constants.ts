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