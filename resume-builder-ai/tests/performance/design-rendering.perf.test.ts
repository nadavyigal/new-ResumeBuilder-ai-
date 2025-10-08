/**
 * Performance Tests for Design Rendering
 * Feature 003: AI-Powered Resume Design Selection
 * Task: T045
 *
 * Performance targets:
 * - Template preview rendering < 5 seconds (FR-007)
 * - Template switching < 2 seconds
 * - AI customization < 7 seconds (existing chat target)
 * - Measure with realistic data sizes
 */

import { renderTemplatePreview, renderTemplateSample } from '@/lib/design-manager/template-renderer';
import { interpretDesignRequest } from '@/lib/design-manager/customization-engine';
import { getDesignAssignment, renderWithDesign } from '@/lib/template-engine';

// Mock realistic resume data
const mockResumeData = {
  personalInfo: {
    fullName: 'John David Anderson',
    email: 'john.anderson@email.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/johnanderson',
    website: 'johnanderson.dev'
  },
  summary: 'Experienced Software Engineer with 8+ years of expertise in full-stack development, cloud architecture, and team leadership. Proven track record of delivering scalable solutions for high-traffic applications serving millions of users. Passionate about mentoring junior developers and driving technical excellence through best practices and innovative problem-solving.',
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Corp Inc.',
      location: 'San Francisco, CA',
      startDate: '2020-01',
      endDate: 'Present',
      achievements: [
        'Led migration of monolithic application to microservices architecture, reducing deployment time by 70% and improving system reliability',
        'Architected and implemented real-time data processing pipeline handling 50M+ events daily using Kafka and Apache Flink',
        'Mentored team of 5 junior engineers, establishing code review standards and conducting weekly knowledge-sharing sessions',
        'Optimized database queries reducing average response time from 3s to 300ms, improving user experience for 2M+ active users'
      ]
    },
    {
      title: 'Software Engineer',
      company: 'Innovation Labs',
      location: 'San Francisco, CA',
      startDate: '2018-03',
      endDate: '2019-12',
      achievements: [
        'Developed RESTful APIs serving 10K+ requests per second with 99.9% uptime using Node.js and Express',
        'Implemented CI/CD pipeline with Jenkins and Docker, reducing deployment failures by 85%',
        'Built responsive front-end components using React and TypeScript, improving page load times by 40%'
      ]
    },
    {
      title: 'Junior Software Developer',
      company: 'StartUp Ventures',
      location: 'Palo Alto, CA',
      startDate: '2016-06',
      endDate: '2018-02',
      achievements: [
        'Contributed to development of SaaS platform acquired by major enterprise company',
        'Implemented automated testing suite achieving 85% code coverage',
        'Collaborated with product team to define technical requirements and user stories'
      ]
    }
  ],
  education: [
    {
      degree: 'Bachelor of Science in Computer Science',
      institution: 'University of California, Berkeley',
      location: 'Berkeley, CA',
      graduationDate: '2016-05',
      gpa: '3.8/4.0',
      honors: ['Dean\'s List', 'Outstanding CS Student Award']
    }
  ],
  skills: {
    technical: [
      'JavaScript/TypeScript', 'React', 'Node.js', 'Python', 'Java',
      'AWS (EC2, S3, Lambda, RDS)', 'Docker', 'Kubernetes',
      'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST APIs',
      'Git', 'CI/CD', 'Microservices', 'System Design'
    ],
    soft: [
      'Team Leadership', 'Mentoring', 'Agile/Scrum',
      'Technical Writing', 'Problem Solving', 'Communication'
    ]
  },
  certifications: [
    'AWS Certified Solutions Architect - Professional',
    'Certified Kubernetes Administrator (CKA)',
    'Google Cloud Professional Developer'
  ],
  projects: [
    {
      name: 'Open Source Contribution - React Performance Tools',
      description: 'Core contributor to popular React performance monitoring library with 15K+ GitHub stars',
      technologies: ['React', 'TypeScript', 'Webpack', 'Jest'],
      url: 'github.com/react-perf-tools'
    },
    {
      name: 'Personal SaaS - DevOps Dashboard',
      description: 'Built and launched SaaS platform for infrastructure monitoring with 500+ active users',
      technologies: ['Next.js', 'Supabase', 'Vercel', 'Stripe'],
      url: 'devops-dash.io'
    }
  ]
};

// Mock customization config
const mockCustomization = {
  color_scheme: {
    primary: '#1e3a8a',
    secondary: '#3b82f6',
    accent: '#60a5fa',
    background: '#ffffff',
    text: '#000000'
  },
  font_family: {
    heading: 'Arial',
    body: 'Times New Roman'
  },
  spacing: {
    section_gap: '1.5rem',
    line_height: '1.6'
  },
  custom_css: ''
};

describe('Performance Tests - Design Rendering', () => {
  // Set longer timeout for performance tests
  jest.setTimeout(30000);

  describe('Template Preview Rendering (Target: < 5 seconds)', () => {
    const templates = ['minimal-ats', 'professional-card', 'modern-timeline', 'elegant-sidebar'];

    templates.forEach((templateSlug) => {
      it(`should render ${templateSlug} template within 5 seconds`, async () => {
        const startTime = Date.now();

        try {
          const html = await renderTemplatePreview(
            templateSlug,
            mockResumeData,
            mockCustomization
          );

          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(`[PERF] ${templateSlug} rendering took ${duration}ms`);

          expect(html).toBeDefined();
          expect(html.length).toBeGreaterThan(0);
          expect(duration).toBeLessThan(5000); // 5 seconds target
        } catch (error) {
          console.error(`Error rendering ${templateSlug}:`, error);
          throw error;
        }
      });
    });

    it('should render template without customization within 5 seconds', async () => {
      const startTime = Date.now();

      const html = await renderTemplatePreview(
        'minimal-ats',
        mockResumeData,
        null // No customization
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] Default template rendering took ${duration}ms`);

      expect(duration).toBeLessThan(5000);
    });

    it('should render sample preview within 5 seconds', async () => {
      const startTime = Date.now();

      const html = await renderTemplateSample('minimal-ats');

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] Sample rendering took ${duration}ms`);

      expect(duration).toBeLessThan(5000);
    });

    it('should handle large resume data within 5 seconds', async () => {
      // Create extra large resume with multiple experiences
      const largeResumeData = {
        ...mockResumeData,
        experience: [
          ...mockResumeData.experience,
          ...Array(5).fill(null).map((_, i) => ({
            title: `Previous Role ${i + 1}`,
            company: `Company ${i + 1}`,
            location: 'Various',
            startDate: `201${i}-01`,
            endDate: `201${i + 1}-12`,
            achievements: Array(6).fill('Accomplished significant project milestone and delivered value to stakeholders')
          }))
        ],
        projects: Array(10).fill(null).map((_, i) => ({
          name: `Project ${i + 1}`,
          description: 'Complex project with multiple phases and deliverables spanning multiple quarters',
          technologies: ['Tech1', 'Tech2', 'Tech3', 'Tech4'],
          url: `project${i}.com`
        }))
      };

      const startTime = Date.now();

      const html = await renderTemplatePreview(
        'minimal-ats',
        largeResumeData,
        mockCustomization
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] Large resume rendering took ${duration}ms`);

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Template Switching (Target: < 2 seconds)', () => {
    it('should switch between templates within 2 seconds', async () => {
      // First render
      await renderTemplatePreview('minimal-ats', mockResumeData, mockCustomization);

      // Now switch to different template
      const startTime = Date.now();

      const html = await renderTemplatePreview(
        'professional-card',
        mockResumeData,
        mockCustomization
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] Template switching took ${duration}ms`);

      expect(html).toBeDefined();
      expect(duration).toBeLessThan(2000); // 2 seconds target
    });

    it('should switch to template with new customization within 2 seconds', async () => {
      const newCustomization = {
        ...mockCustomization,
        color_scheme: {
          primary: '#dc2626',
          secondary: '#ef4444',
          accent: '#f87171',
          background: '#ffffff',
          text: '#000000'
        }
      };

      const startTime = Date.now();

      const html = await renderTemplatePreview(
        'modern-timeline',
        mockResumeData,
        newCustomization
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] Template + customization switch took ${duration}ms`);

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('AI Customization (Target: < 7 seconds)', () => {
    // Note: These tests use mocked AI responses to avoid actual API calls
    beforeEach(() => {
      // Mock OpenAI for performance testing
      jest.mock('openai', () => {
        return jest.fn().mockImplementation(() => ({
          chat: {
            completions: {
              create: jest.fn().mockResolvedValue({
                choices: [{
                  message: {
                    content: JSON.stringify({
                      understood: true,
                      customization: {
                        color_scheme: {
                          primary: '#1e3a8a',
                          secondary: '#3b82f6',
                          accent: '#60a5fa',
                          background: '#ffffff',
                          text: '#000000'
                        },
                        font_family: {
                          heading: 'Arial',
                          body: 'Arial'
                        },
                        spacing: {
                          section_gap: '1.5rem',
                          line_height: '1.6'
                        },
                        custom_css: ''
                      },
                      reasoning: 'Applied requested changes'
                    })
                  }
                }]
              })
            }
          }
        }));
      });
    });

    it('should interpret design request within 7 seconds', async () => {
      const startTime = Date.now();

      const result = await interpretDesignRequest(
        'make headers dark blue and use professional fonts',
        mockCustomization
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] AI interpretation took ${duration}ms`);

      expect(result.understood).toBe(true);
      expect(duration).toBeLessThan(7000); // 7 seconds target
    }, 10000);

    it('should handle complex customization request within 7 seconds', async () => {
      const startTime = Date.now();

      const result = await interpretDesignRequest(
        'change primary color to navy blue, make section spacing larger, and use serif fonts for headings',
        mockCustomization
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] Complex AI request took ${duration}ms`);

      expect(duration).toBeLessThan(7000);
    }, 10000);
  });

  describe('End-to-End Rendering Performance', () => {
    it('should complete full render with design within 5 seconds', async () => {
      // Simulate full optimization page load with design rendering
      const startTime = Date.now();

      // Convert resume data to OptimizedResume format
      const optimizedResume = {
        contact: {
          name: mockResumeData.personalInfo.fullName,
          email: mockResumeData.personalInfo.email,
          phone: mockResumeData.personalInfo.phone,
          location: mockResumeData.personalInfo.location,
          linkedin: mockResumeData.personalInfo.linkedin,
          portfolio: mockResumeData.personalInfo.website
        },
        summary: mockResumeData.summary,
        skills: mockResumeData.skills,
        experience: mockResumeData.experience.map(exp => ({
          ...exp,
          achievements: exp.achievements
        })),
        education: mockResumeData.education,
        certifications: mockResumeData.certifications,
        projects: mockResumeData.projects
      };

      // Note: This would normally query database, but we're testing render performance
      // In real scenario, getDesignAssignment would be mocked
      const html = await renderTemplatePreview(
        'minimal-ats',
        mockResumeData,
        mockCustomization
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] End-to-end rendering took ${duration}ms`);

      expect(html).toBeDefined();
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Concurrent Rendering Performance', () => {
    it('should handle multiple concurrent renders efficiently', async () => {
      const templates = ['minimal-ats', 'professional-card', 'modern-timeline'];

      const startTime = Date.now();

      const promises = templates.map(template =>
        renderTemplatePreview(template, mockResumeData, mockCustomization)
      );

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`[PERF] 3 concurrent renders took ${duration}ms total`);
      console.log(`[PERF] Average per template: ${duration / 3}ms`);

      expect(results).toHaveLength(3);
      results.forEach(html => expect(html).toBeDefined());

      // Should complete all 3 in less than 10 seconds total
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated renders', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Render same template 10 times
      for (let i = 0; i < 10; i++) {
        await renderTemplatePreview(
          'minimal-ats',
          mockResumeData,
          mockCustomization
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`[PERF] Memory increase after 10 renders: ${memoryIncreaseMB.toFixed(2)}MB`);

      // Should not increase memory by more than 50MB for 10 renders
      expect(memoryIncreaseMB).toBeLessThan(50);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should log performance metrics for baseline tracking', async () => {
      const metrics: { [key: string]: number } = {};

      // Measure each template
      const templates = ['minimal-ats', 'professional-card', 'modern-timeline', 'elegant-sidebar'];

      for (const template of templates) {
        const startTime = Date.now();
        await renderTemplatePreview(template, mockResumeData, mockCustomization);
        const duration = Date.now() - startTime;

        metrics[template] = duration;
      }

      console.log('[PERF] Performance baseline metrics:', JSON.stringify(metrics, null, 2));

      // All templates should be under target
      Object.entries(metrics).forEach(([template, duration]) => {
        expect(duration).toBeLessThan(5000);
      });
    });
  });
});

describe('Performance Summary', () => {
  it('should display performance test summary', () => {
    console.log('\n=== PERFORMANCE TEST SUMMARY ===');
    console.log('Target: Template rendering < 5s');
    console.log('Target: Template switching < 2s');
    console.log('Target: AI customization < 7s');
    console.log('See individual test logs for detailed metrics');
    console.log('================================\n');

    expect(true).toBe(true);
  });
});
