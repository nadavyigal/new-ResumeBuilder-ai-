/**
 * PDF Service Client
 *
 * HTTP client to communicate with the Docker-based PDF generation service.
 * Provides timeout handling, error recovery, and detailed logging.
 *
 * Phase 3: Next.js Integration
 */

import type { OptimizedResume } from "./ai-optimizer";
import type { ResumeData } from "./design-manager/template-renderer";
import type { DesignCustomizationLike } from "./design-manager/render-preview-html";

export interface PDFServiceResponse {
  success: boolean;
  pdfBase64?: string;
  metadata?: {
    templateSlug: string;
    renderTimeMs: number;
    pageCount: number;
    pdfSize: number;
  };
  error?: string;
}

export interface PDFServiceRequest {
  resumeData: ResumeData;
  templateSlug: string;
  customization?: DesignCustomizationLike | null;
}

function mapOptimizedResumeToServiceData(resumeData: OptimizedResume): ResumeData {
  const technical = resumeData.skills?.technical || [];
  const soft = resumeData.skills?.soft || [];
  const combinedSkills = [...technical, ...soft].filter(Boolean);

  return {
    personalInfo: {
      fullName: resumeData.contact?.name || '',
      email: resumeData.contact?.email || '',
      phone: resumeData.contact?.phone || '',
      location: resumeData.contact?.location || '',
      linkedin: resumeData.contact?.linkedin || '',
      website: resumeData.contact?.portfolio || '',
    },
    summary: resumeData.summary || '',
    experience: (resumeData.experience || []).map((exp) => ({
      company: exp.company || '',
      position: exp.title || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      description: '',
      achievements: exp.achievements || [],
    })),
    education: (resumeData.education || []).map((edu) => ({
      institution: edu.institution || '',
      degree: edu.degree || '',
      graduationDate: edu.graduationDate || '',
      gpa: edu.gpa || '',
    })),
    skills: combinedSkills,
    certifications: (resumeData.certifications || []).map((cert) => ({
      name: cert,
      issuer: '',
      date: '',
    })),
    projects: (resumeData.projects || []).map((project) => ({
      name: project.name || '',
      description: project.description || '',
      technologies: project.technologies || [],
    })),
  };
}

/**
 * Call the Docker PDF service to generate a PDF
 *
 * @param resumeData - Optimized resume data
 * @param templateSlug - Template to use (minimal-ssr, card-ssr, sidebar-ssr, timeline-ssr)
 * @param customization - Optional design customizations
 * @returns PDF service response with base64 PDF or error
 */
export async function callPDFService(
  resumeData: OptimizedResume,
  templateSlug: string,
  customization?: DesignCustomizationLike | null
): Promise<PDFServiceResponse> {
  const serviceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:3002';
  const serviceSecret = process.env.PDF_SERVICE_SECRET;

  if (!serviceSecret) {
    console.warn('[PDF-SERVICE] PDF_SERVICE_SECRET not configured, skipping Docker service');
    return {
      success: false,
      error: 'PDF_SERVICE_SECRET not configured'
    };
  }

  const endpoint = `${serviceUrl}/api/generate-pdf`;
  const timeoutMs = 45000; // 45 seconds

  console.log(`[PDF-SERVICE] Calling Docker service: ${endpoint}`);
  console.log(`[PDF-SERVICE] Template: ${templateSlug}`);
  console.log(`[PDF-SERVICE] Has customization: ${!!customization}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startTime = Date.now();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceSecret}`,
      },
      body: JSON.stringify({
        resumeData: mapOptimizedResumeToServiceData(resumeData),
        templateSlug,
        customization: customization || undefined,
      } as PDFServiceRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const elapsedMs = Date.now() - startTime;
    console.log(`[PDF-SERVICE] Response received in ${elapsedMs}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error(`[PDF-SERVICE] HTTP error ${response.status}:`, errorText);

      return {
        success: false,
        error: `PDF service returned ${response.status}: ${errorText}`
      };
    }

    const data = await response.json() as PDFServiceResponse;

    if (!data.success || !data.pdfBase64) {
      console.error('[PDF-SERVICE] Invalid response from service:', data.error || 'No PDF data');
      return {
        success: false,
        error: data.error || 'No PDF data returned'
      };
    }

    console.log('[PDF-SERVICE] PDF generated successfully');
    console.log(`[PDF-SERVICE] Metadata:`, data.metadata);

    return data;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`[PDF-SERVICE] Request timeout after ${timeoutMs}ms`);
        return {
          success: false,
          error: `PDF service timeout after ${timeoutMs}ms`
        };
      }

      console.error('[PDF-SERVICE] Request failed:', error.message);

      // Network errors (service down, connection refused, etc.)
      if (error.message.includes('fetch failed') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND')) {
        return {
          success: false,
          error: 'PDF service unavailable'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }

    console.error('[PDF-SERVICE] Unknown error:', error);
    return {
      success: false,
      error: 'Unknown error calling PDF service'
    };
  }
}

/**
 * Check if the PDF service is healthy
 *
 * @returns true if service is healthy, false otherwise
 */
export async function checkPDFServiceHealth(): Promise<boolean> {
  const serviceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:3002';
  const endpoint = `${serviceUrl}/health`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'healthy' && data.chromium === true;
  } catch (error) {
    console.error('[PDF-SERVICE] Health check failed:', error);
    return false;
  }
}
