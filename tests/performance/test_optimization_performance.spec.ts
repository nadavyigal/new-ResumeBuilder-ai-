/**
 * Performance Test: AI Optimization
 * Epic 3: FR-010 - Processing within 20-second timeout
 *
 * Validates that optimization completes within acceptable time limits
 */

import { describe, it, expect } from '@jest/globals';
import { optimizeResume } from '@/lib/ai-optimizer';

const PERFORMANCE_THRESHOLD = 20000; // 20 seconds in milliseconds

describe('AI Optimization Performance - FR-010', () => {
  const SAMPLE_RESUME = `
    John Smith
    Senior Software Engineer
    john.smith@email.com | (555) 123-4567 | linkedin.com/in/johnsmith

    PROFESSIONAL SUMMARY
    Results-driven Software Engineer with 8+ years of experience building scalable web applications.
    Expertise in React, Node.js, and cloud infrastructure. Proven track record of delivering high-quality
    software solutions and leading cross-functional teams.

    EXPERIENCE
    Senior Software Engineer | Tech Solutions Inc | San Francisco, CA | 2019-Present
    - Led development of microservices architecture serving 1M+ daily active users
    - Implemented CI/CD pipeline reducing deployment time by 60%
    - Mentored team of 5 junior developers and conducted code reviews
    - Technologies: React, TypeScript, Node.js, AWS, Docker, Kubernetes

    Software Engineer | StartupXYZ | San Jose, CA | 2016-2019
    - Built real-time collaboration features using WebSockets and Redis
    - Optimized database queries reducing API response time by 40%
    - Developed RESTful APIs consumed by mobile and web clients
    - Technologies: JavaScript, Express.js, MongoDB, Redis

    EDUCATION
    B.S. in Computer Science | Stanford University | 2016
    GPA: 3.8/4.0

    SKILLS
    Languages: JavaScript, TypeScript, Python, Go
    Frontend: React, Vue.js, HTML/CSS, Tailwind
    Backend: Node.js, Express, GraphQL, REST APIs
    Databases: PostgreSQL, MongoDB, Redis
    DevOps: AWS, Docker, Kubernetes, CI/CD, Terraform
    Tools: Git, Jest, Webpack, npm
  `;

  const SAMPLE_JOB = `
    Senior Full Stack Engineer
    TechCorp Innovation Labs

    About the Role:
    We're seeking an experienced Full Stack Engineer to join our growing team. You'll work on cutting-edge
    projects involving React, Node.js, and cloud technologies.

    Requirements:
    - 5+ years of professional software development experience
    - Strong proficiency in React and TypeScript
    - Experience with Node.js and Express
    - Knowledge of AWS cloud services
    - Experience with Docker and Kubernetes
    - Excellent problem-solving and communication skills
    - Bachelor's degree in Computer Science or related field

    Nice to Have:
    - GraphQL experience
    - CI/CD pipeline setup
    - Microservices architecture
    - Team leadership experience

    Tech Stack:
    React, TypeScript, Node.js, Express, GraphQL, PostgreSQL, Redis, AWS, Docker, Kubernetes
  `;

  it('should complete optimization in under 20 seconds', async () => {
    const startTime = performance.now();

    const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);

    console.log(`✓ Optimization completed in ${(duration / 1000).toFixed(2)} seconds`);
  }, 25000);

  it('should handle small resume efficiently (< 10 seconds)', async () => {
    const smallResume = `
      Developer with React and Node.js experience.
      Built web applications for 3 years.
      Skills: React, JavaScript, Node.js
    `;

    const startTime = performance.now();

    const result = await optimizeResume(smallResume, SAMPLE_JOB);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(10000);

    console.log(`✓ Small resume optimized in ${(duration / 1000).toFixed(2)} seconds`);
  }, 15000);

  it('should handle large resume within timeout', async () => {
    const largeResume = SAMPLE_RESUME + `

    ADDITIONAL EXPERIENCE
    Junior Developer | Previous Company | 2014-2016
    - Developed user interfaces using HTML, CSS, and JavaScript
    - Collaborated with designers to implement responsive designs
    - Fixed bugs and improved application performance

    Intern | Another Tech Co | Summer 2013
    - Assisted in development of internal tools
    - Learned software development best practices
    - Worked with senior developers on feature implementation

    CERTIFICATIONS
    - AWS Certified Solutions Architect
    - Certified Kubernetes Administrator
    - MongoDB Certified Developer

    PROJECTS
    - Open source contributor to React ecosystem
    - Built personal SaaS product with 1000+ users
    - Created technical blog with 50K+ monthly readers
    `;

    const startTime = performance.now();

    const result = await optimizeResume(largeResume, SAMPLE_JOB);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);

    console.log(`✓ Large resume optimized in ${(duration / 1000).toFixed(2)} seconds`);
  }, 25000);

  it('should maintain consistent performance across multiple runs', async () => {
    const durations: number[] = [];
    const iterations = 3;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB);
      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLD);
    expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLD);

    console.log(`✓ Average: ${(avgDuration / 1000).toFixed(2)}s, Max: ${(maxDuration / 1000).toFixed(2)}s`);
  }, 75000);

  it('should report performance metrics', async () => {
    const startTime = performance.now();

    const result = await optimizeResume(SAMPLE_RESUME, SAMPLE_JOB);

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeDefined();
    expect(result.tokensUsed).toBeGreaterThan(0);

    console.log(`
    Performance Metrics:
    - Duration: ${(duration / 1000).toFixed(2)} seconds
    - Tokens Used: ${result.tokensUsed}
    - Match Score: ${result.optimizedResume?.matchScore}%
    `);
  }, 25000);
});

describe('Performance Benchmarks', () => {
  it('should track performance degradation over time', async () => {
    const results: Array<{ duration: number; score: number }> = [];

    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();

      const result = await optimizeResume(
        `Resume content ${i}`,
        `Job description ${i}`
      );

      const endTime = performance.now();

      if (result.success) {
        results.push({
          duration: endTime - startTime,
          score: result.optimizedResume?.matchScore || 0,
        });
      }
    }

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLD);
    expect(results.every(r => r.duration < PERFORMANCE_THRESHOLD)).toBe(true);

    console.log('Performance benchmark results:', results);
  }, 120000);
});
