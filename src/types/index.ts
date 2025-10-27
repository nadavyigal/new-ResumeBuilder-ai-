export interface ResumeData {
  id?: string;
  userId?: string;
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    website?: string;
  };
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  certifications?: Certification[];
  languages?: Language[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Experience {
  id?: string;
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
  achievements: string[];
}

export interface Education {
  id?: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
}

export interface Certification {
  id?: string;
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
}

export interface Language {
  name: string;
  proficiency: "Basic" | "Conversational" | "Fluent" | "Native";
}

export interface JobDescription {
  id?: string;
  userId?: string;
  title: string;
  company: string;
  location?: string;
  sourceUrl?: string;
  rawText: string;
  cleanText: string;
  requirements: string[];
  skills: string[];
  createdAt?: string;
}

export interface OptimizationResult {
  id?: string;
  userId?: string;
  resumeId: string;
  jobDescriptionId: string;
  matchScore: number;
  optimizedResume: ResumeData;
  gaps: {
    missingSkills: string[];
    weakAreas: string[];
    suggestions: string[];
  };
  templateKey: string;
  status: "processing" | "completed" | "failed";
  createdAt?: string;
}

export interface ResumeTemplate {
  key: string;
  name: string;
  family: "ats" | "modern";
  description: string;
  previewUrl?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role?: string;
  planType: "free" | "premium";
  optimizationsUsed: number;
  createdAt: string;
}

// Export all design-related types from design.ts (Feature 003)
export * from './design';