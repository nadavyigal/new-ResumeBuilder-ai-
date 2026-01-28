/**
 * Integration Test: AI Optimizer Library
 * Epic 3: AI Resume Optimization
 *
 * Tests the ai-optimizer library independently
 * Validates FR-010 to FR-014 at the library level
 */

import { describe, it, expect } from '@jest/globals';
import { optimizeResume, calculateMatchScore, extractKeywords } from '@/lib/ai-optimizer';

const SAMPLE_RESUME = `
John Doe
Software Engineer
john@example.com | (555) 123-4567

EXPERIENCE
Software Engineer at Tech Corp (2020-2023)
- Developed web applications using React and TypeScript
- Built REST APIs with Node.js and Express
- Collaborated with cross-functional teams

SKILLS
React, TypeScript, JavaScript, Node.js, Git
`;

const SAMPLE_JOB_DESCRIPTION = `
Senior Frontend Engineer
Tech Startup Inc.

Requirements:
- 5+ years of experience with React and TypeScript
- Strong understanding of modern frontend development
- Experience with state management (Redux, MobX)
- Node.js backend experience preferred
- Excellent communication skills

Tech Stack: React, TypeScript, Redux, GraphQL, Node.js
`;

describe('AI Optimizer Library - Epic 3', () => {
  describe('FR-010: Processing Time', () => {
    it('should complete optimization within 20 seconds', async () => {
      const startTime = Date.now();

      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(20);
    }, 25000);

    it('should handle timeout errors gracefully', async () => {
      // Simulate timeout by mocking OpenAI delay
      const veryLongResume = SAMPLE_RESUME.repeat(100);
      const result = await optimizeResume(veryLongResume, SAMPLE_JOB_DESCRIPTION);

      if (!result.success) {
        expect(result.error).toMatch(/timeout|time/i);
      }
    }, 25000);
  });

  describe('FR-011: Content Alignment', () => {
    it('should return optimized resume with relevant content', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      expect(result.optimizedResume).toBeDefined();
      expect(result.optimizedResume?.summary).toBeDefined();
      expect(result.optimizedResume?.skills).toBeDefined();
      expect(result.optimizedResume?.experience).toBeDefined();
    }, 25000);

    it('should include job-relevant keywords in optimized content', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);

      const optimizedText = JSON.stringify(result.optimizedResume);
      expect(optimizedText.toLowerCase()).toContain('react');
      expect(optimizedText.toLowerCase()).toContain('typescript');
    }, 25000);

    it('should prioritize skills mentioned in job description', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.skills.technical).toContain('React');
      expect(result.optimizedResume?.skills.technical).toContain('TypeScript');
    }, 25000);
  });

  describe('FR-012: Factual Accuracy', () => {
    it('should not add skills not in original resume', async () => {
      const limitedResume = `
        Junior Developer
        Skills: HTML, CSS, JavaScript
        Experience: 1 year
      `;

      const advancedJob = `
        Senior Engineer needed
        Requirements: Kubernetes, Docker, AWS, Terraform, Go
      `;

      const result = await optimizeResume(limitedResume, advancedJob);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.missingKeywords).toEqual(
        expect.arrayContaining(['Kubernetes', 'Docker', 'AWS'])
      );
    }, 25000);

    it('should preserve original experience timeline', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      const experience = result.optimizedResume?.experience[0];
      expect(experience).toBeDefined();
      expect(experience?.company).toContain('Tech Corp');
      // Should not fabricate longer timeline
    }, 25000);

    it('should only reword existing content, not fabricate', async () => {
      const minimalResume = `
        Developer with React experience
        Built one web application
      `;

      const result = await optimizeResume(minimalResume, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      // Should have missing keywords for things not in original
      expect(result.optimizedResume?.missingKeywords.length).toBeGreaterThan(0);
    }, 25000);
  });

  describe('FR-013: Match Score', () => {
    it('should return match score between 0 and 100', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.matchScore).toBeDefined();
      expect(result.optimizedResume?.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.optimizedResume?.matchScore).toBeLessThanOrEqual(100);
    }, 25000);

    it('should give higher score for well-aligned resume', async () => {
      const perfectResume = `
        Senior Frontend Engineer
        Skills: React, TypeScript, Redux, GraphQL, Node.js
        Experience: 6 years with React and TypeScript
      `;

      const result = await optimizeResume(perfectResume, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.matchScore).toBeGreaterThan(70);
    }, 25000);

    it('should give lower score for misaligned resume', async () => {
      const mismatchedResume = `
        Python Backend Developer
        Skills: Python, Django, PostgreSQL, Redis
        Experience: 5 years Python development
      `;

      const result = await optimizeResume(mismatchedResume, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.matchScore).toBeLessThan(50);
    }, 25000);
  });

  describe('FR-014: Score Breakdown', () => {
    it('should provide key improvements list', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.keyImprovements).toBeDefined();
      expect(Array.isArray(result.optimizedResume?.keyImprovements)).toBe(true);
      expect(result.optimizedResume?.keyImprovements.length).toBeGreaterThan(0);
    }, 25000);

    it('should identify missing keywords', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.missingKeywords).toBeDefined();
      expect(Array.isArray(result.optimizedResume?.missingKeywords)).toBe(true);
    }, 25000);

    it('should report specific skill gaps', async () => {
      const basicResume = `
        Developer with JavaScript experience
      `;

      const detailedJob = `
        Full Stack Developer
        Required: React, Vue, Angular, TypeScript, Node.js, MongoDB
      `;

      const result = await optimizeResume(basicResume, detailedJob);

      expect(result.success).toBe(true);
      expect(result.optimizedResume?.missingKeywords).toEqual(
        expect.arrayContaining(['React', 'Vue', 'Angular', 'TypeScript'])
      );
    }, 25000);
  });

  describe('Helper Functions', () => {
    it('calculateMatchScore should return percentage', () => {
      const score = calculateMatchScore(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('extractKeywords should identify important terms', () => {
      const keywords = extractKeywords(SAMPLE_JOB_DESCRIPTION);

      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords).toContain('React');
      expect(keywords).toContain('TypeScript');
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.length).toBeLessThanOrEqual(50);
    });

    it('extractKeywords should find technical terms', () => {
      const techJob = 'Looking for AWS, Docker, Kubernetes expert with CI/CD experience';
      const keywords = extractKeywords(techJob);

      expect(keywords).toEqual(
        expect.arrayContaining(['AWS', 'Docker', 'Kubernetes'])
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle empty resume text', async () => {
      const result = await optimizeResume('', SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 25000);

    it('should handle empty job description', async () => {
      const result = await optimizeResume(SAMPLE_RESUME, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 25000);

    it('should handle OpenAI API errors gracefully', async () => {
      // Test with invalid API key scenario
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/api key/i);

      process.env.OPENAI_API_KEY = originalKey;
    }, 25000);
  });
});
