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

export const CHAT_CONFIG = {
  minMessageLength: 1,
  maxMessageLength: 2000,
} as const;

export const TECHNICAL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'php', 'go', 'rust',
  'react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'spring', 'laravel',
  'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap',
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'jenkins', 'ci/cd',
  'git', 'github', 'gitlab', 'bitbucket',
  'api', 'rest', 'graphql', 'grpc', 'microservices',
  'machine learning', 'ml', 'ai', 'deep learning', 'neural network', 'tensorflow', 'pytorch',
  'agile', 'scrum', 'jira', 'confluence',
  'testing', 'jest', 'mocha', 'pytest', 'junit', 'selenium', 'cypress',
  'linux', 'unix', 'bash', 'shell', 'cli',
  'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator'
] as const;