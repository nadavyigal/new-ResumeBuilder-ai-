import { describe, expect, it } from '@jest/globals';
import {
  OptimizedResumeSchema,
  ResumeDataSchema,
  JobDescriptionSchema,
  parseAndValidate,
  safeParseJson,
} from '../schemas';

describe('OptimizedResumeSchema', () => {
  it('should validate a complete optimized resume', () => {
    const validResume = {
      summary: 'Experienced software engineer with 10 years of experience',
      contact: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        linkedin: 'https://linkedin.com/in/johndoe',
        github: 'https://github.com/johndoe',
      },
      experience: [
        {
          company: 'Tech Corp',
          position: 'Senior Engineer',
          startDate: '2020-01',
          endDate: '2023-12',
          description: 'Led team of 5 developers',
          highlights: ['Increased performance by 50%'],
        },
      ],
      education: [
        {
          institution: 'University of Example',
          degree: 'B.S. Computer Science',
          startDate: '2010-09',
          endDate: '2014-05',
          gpa: '3.8',
        },
      ],
      skills: {
        technical: ['JavaScript', 'TypeScript', 'React'],
        soft: ['Leadership', 'Communication'],
        certifications: ['AWS Certified'],
      },
      projects: [
        {
          name: 'Open Source Project',
          description: 'Built a popular library',
          technologies: ['TypeScript', 'Node.js'],
          url: 'https://github.com/project',
        },
      ],
      matchScore: 85,
      improvements: ['Added quantifiable achievements', 'Highlighted relevant skills'],
      keywords: ['TypeScript', 'React', 'Leadership'],
    };

    const result = OptimizedResumeSchema.safeParse(validResume);
    expect(result.success).toBe(true);
  });

  it('should reject resume with invalid email', () => {
    const invalidResume = {
      summary: 'Experienced engineer',
      contact: {
        name: 'John Doe',
        email: 'not-an-email', // Invalid email
        phone: '+1234567890',
        location: 'SF',
      },
      experience: [],
      education: [],
      skills: {
        technical: ['JS'],
        soft: [],
      },
      matchScore: 85,
      improvements: [],
      keywords: [],
    };

    const result = OptimizedResumeSchema.safeParse(invalidResume);
    expect(result.success).toBe(false);
  });

  it('should reject resume with invalid match score', () => {
    const invalidResume = {
      summary: 'Experienced engineer',
      contact: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        location: 'SF',
      },
      experience: [],
      education: [],
      skills: {
        technical: ['JS'],
        soft: [],
      },
      matchScore: 150, // Invalid - must be 0-100
      improvements: [],
      keywords: [],
    };

    const result = OptimizedResumeSchema.safeParse(invalidResume);
    expect(result.success).toBe(false);
  });

  it('should accept optional fields', () => {
    const minimalResume = {
      summary: 'Software engineer',
      contact: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        location: 'NYC',
        // Optional fields omitted
      },
      experience: [],
      education: [],
      skills: {
        technical: ['Python'],
        soft: [],
      },
      matchScore: 75,
      improvements: [],
      keywords: [],
    };

    const result = OptimizedResumeSchema.safeParse(minimalResume);
    expect(result.success).toBe(true);
  });
});

describe('ResumeDataSchema', () => {
  it('should validate complete resume data', () => {
    const validResumeData = {
      summary: 'Experienced developer',
      contact: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        location: 'SF',
      },
      experience: [
        {
          company: 'Tech Inc',
          position: 'Developer',
          startDate: '2020-01',
          description: 'Built features',
        },
      ],
      education: [
        {
          institution: 'University',
          degree: 'BS CS',
          startDate: '2015-09',
          endDate: '2019-05',
        },
      ],
      skills: {
        technical: ['JavaScript'],
        soft: ['Teamwork'],
      },
    };

    const result = ResumeDataSchema.safeParse(validResumeData);
    expect(result.success).toBe(true);
  });
});

describe('JobDescriptionSchema', () => {
  it('should validate complete job description', () => {
    const validJobDesc = {
      title: 'Senior Software Engineer',
      company: 'Tech Company',
      location: 'Remote',
      description: 'We are looking for an experienced engineer...',
      requirements: [
        '5+ years of experience',
        'Strong JavaScript skills',
      ],
      niceToHave: ['Open source contributions'],
      salary: {
        min: 120000,
        max: 180000,
        currency: 'USD',
      },
    };

    const result = JobDescriptionSchema.safeParse(validJobDesc);
    expect(result.success).toBe(true);
  });

  it('should accept minimal job description', () => {
    const minimalJobDesc = {
      title: 'Developer',
      description: 'Looking for a developer',
    };

    const result = JobDescriptionSchema.safeParse(minimalJobDesc);
    expect(result.success).toBe(true);
  });

  it('should reject job description with too short title', () => {
    const invalidJobDesc = {
      title: 'Dev', // Too short - minimum 3 characters
      description: 'Looking for a developer',
    };

    const result = JobDescriptionSchema.safeParse(invalidJobDesc);
    expect(result.success).toBe(false);
  });
});

describe('parseAndValidate', () => {
  it('should parse and validate valid JSON', () => {
    const jsonString = JSON.stringify({
      title: 'Software Engineer',
      description: 'We need a great engineer',
    });

    const result = parseAndValidate(jsonString, JobDescriptionSchema);

    expect(result.title).toBe('Software Engineer');
    expect(result.description).toBe('We need a great engineer');
  });

  it('should throw on invalid JSON syntax', () => {
    const invalidJson = '{ invalid json }';

    expect(() => {
      parseAndValidate(invalidJson, JobDescriptionSchema);
    }).toThrow();
  });

  it('should throw on validation failure', () => {
    const jsonString = JSON.stringify({
      title: 'Hi', // Too short
      description: 'Test',
    });

    expect(() => {
      parseAndValidate(jsonString, JobDescriptionSchema);
    }).toThrow();
  });

  it('should include context in error message', () => {
    const invalidJson = '{ invalid }';

    expect(() => {
      parseAndValidate(invalidJson, JobDescriptionSchema, 'Test Context');
    }).toThrow(/Test Context/);
  });
});

describe('safeParseJson', () => {
  it('should parse valid JSON', () => {
    const jsonString = '{"name": "John", "age": 30}';
    const result = safeParseJson(jsonString);

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('should return null on invalid JSON', () => {
    const invalidJson = '{ invalid json }';
    const result = safeParseJson(invalidJson);

    expect(result).toBeNull();
  });

  it('should handle empty string', () => {
    const result = safeParseJson('');
    expect(result).toBeNull();
  });

  it('should handle valid JSON arrays', () => {
    const jsonString = '[1, 2, 3]';
    const result = safeParseJson(jsonString);

    expect(result).toEqual([1, 2, 3]);
  });
});
