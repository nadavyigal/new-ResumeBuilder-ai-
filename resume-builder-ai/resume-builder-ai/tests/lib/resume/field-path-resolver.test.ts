/**
 * Unit tests for Field Path Resolver
 *
 * Tests the utility that resolves JSON paths in resume data:
 * - Parse field paths (e.g., "experiences[0].title")
 * - Get field values from nested objects/arrays
 * - Set field values in nested objects/arrays
 * - Validate field paths against resume schema
 *
 * These tests MUST FAIL before implementation (TDD approach)
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseFieldPath,
  getFieldValue,
  setFieldValue,
  validateFieldPath,
} from '@/lib/resume/field-path-resolver';

describe('Field Path Resolver - parseFieldPath', () => {
  it('parses simple field path', () => {
    const result = parseFieldPath('summary');
    expect(result).toEqual([{ type: 'property', key: 'summary' }]);
  });

  it('parses nested object path', () => {
    const result = parseFieldPath('contact.email');
    expect(result).toEqual([
      { type: 'property', key: 'contact' },
      { type: 'property', key: 'email' },
    ]);
  });

  it('parses array index path', () => {
    const result = parseFieldPath('experiences[0]');
    expect(result).toEqual([
      { type: 'property', key: 'experiences' },
      { type: 'index', index: 0 },
    ]);
  });

  it('parses complex nested path with arrays', () => {
    const result = parseFieldPath('experiences[0].achievements[2]');
    expect(result).toEqual([
      { type: 'property', key: 'experiences' },
      { type: 'index', index: 0 },
      { type: 'property', key: 'achievements' },
      { type: 'index', index: 2 },
    ]);
  });

  it('parses path with "latest" keyword for array', () => {
    const result = parseFieldPath('experiences[latest].title');
    expect(result).toEqual([
      { type: 'property', key: 'experiences' },
      { type: 'latest', index: 0 }, // Latest resolves to 0 for most recent
      { type: 'property', key: 'title' },
    ]);
  });

  it('handles whitespace in path', () => {
    const result = parseFieldPath('  experiences[0].title  ');
    expect(result).toEqual([
      { type: 'property', key: 'experiences' },
      { type: 'index', index: 0 },
      { type: 'property', key: 'title' },
    ]);
  });

  it('throws error for invalid path syntax', () => {
    expect(() => parseFieldPath('experiences[')).toThrow(/invalid.*path/i);
    expect(() => parseFieldPath('experiences[]')).toThrow(/invalid.*path/i);
    expect(() => parseFieldPath('experiences[abc]')).toThrow(/invalid.*index/i);
  });

  it('throws error for empty path', () => {
    expect(() => parseFieldPath('')).toThrow(/empty.*path/i);
  });
});

describe('Field Path Resolver - getFieldValue', () => {
  const mockResume = {
    summary: 'Experienced software engineer',
    contact: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
    },
    skills: {
      technical: ['JavaScript', 'TypeScript', 'React'],
      soft: ['Leadership', 'Communication'],
    },
    experiences: [
      {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        startDate: '2020-01',
        endDate: '2023-12',
        achievements: [
          'Built scalable APIs',
          'Mentored junior developers',
          'Led migration to microservices',
        ],
      },
      {
        title: 'Junior Developer',
        company: 'Startup Inc',
        location: 'Austin, TX',
        startDate: '2018-06',
        endDate: '2019-12',
        achievements: ['Developed frontend features', 'Fixed critical bugs'],
      },
    ],
    education: [
      {
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        institution: 'State University',
        graduationDate: '2018-05',
      },
    ],
  };

  it('gets simple field value', () => {
    const value = getFieldValue(mockResume, 'summary');
    expect(value).toBe('Experienced software engineer');
  });

  it('gets nested object value', () => {
    const value = getFieldValue(mockResume, 'contact.email');
    expect(value).toBe('john@example.com');
  });

  it('gets array element by index', () => {
    const value = getFieldValue(mockResume, 'skills.technical[0]');
    expect(value).toBe('JavaScript');
  });

  it('gets nested array element', () => {
    const value = getFieldValue(mockResume, 'experiences[0].achievements[1]');
    expect(value).toBe('Mentored junior developers');
  });

  it('gets object from array', () => {
    const value = getFieldValue(mockResume, 'experiences[0]');
    expect(value).toEqual({
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      startDate: '2020-01',
      endDate: '2023-12',
      achievements: [
        'Built scalable APIs',
        'Mentored junior developers',
        'Led migration to microservices',
      ],
    });
  });

  it('gets latest array element using [latest]', () => {
    const value = getFieldValue(mockResume, 'experiences[latest].title');
    expect(value).toBe('Software Engineer'); // Most recent experience
  });

  it('returns undefined for non-existent path', () => {
    const value = getFieldValue(mockResume, 'nonexistent.field');
    expect(value).toBeUndefined();
  });

  it('returns undefined for out-of-bounds array index', () => {
    const value = getFieldValue(mockResume, 'experiences[999].title');
    expect(value).toBeUndefined();
  });

  it('handles null values in path gracefully', () => {
    const resumeWithNull = { ...mockResume, contact: null };
    const value = getFieldValue(resumeWithNull, 'contact.email');
    expect(value).toBeUndefined();
  });
});

describe('Field Path Resolver - setFieldValue', () => {
  it('sets simple field value', () => {
    const resume = { summary: 'Old summary' };
    const updated = setFieldValue(resume, 'summary', 'New summary');
    expect(updated.summary).toBe('New summary');
  });

  it('sets nested object value', () => {
    const resume = { contact: { name: 'John', email: 'old@example.com' } };
    const updated = setFieldValue(resume, 'contact.email', 'new@example.com');
    expect(updated.contact.email).toBe('new@example.com');
    expect(updated.contact.name).toBe('John'); // Other fields unchanged
  });

  it('sets array element by index', () => {
    const resume = { skills: { technical: ['JavaScript', 'Python'] } };
    const updated = setFieldValue(resume, 'skills.technical[0]', 'TypeScript');
    expect(updated.skills.technical[0]).toBe('TypeScript');
    expect(updated.skills.technical[1]).toBe('Python'); // Other elements unchanged
  });

  it('sets nested array element', () => {
    const resume = {
      experiences: [
        {
          title: 'Engineer',
          achievements: ['Built features', 'Fixed bugs'],
        },
      ],
    };
    const updated = setFieldValue(
      resume,
      'experiences[0].achievements[0]',
      'Built scalable APIs'
    );
    expect(updated.experiences[0].achievements[0]).toBe('Built scalable APIs');
  });

  it('sets latest array element using [latest]', () => {
    const resume = {
      experiences: [
        { title: 'Junior Dev' },
        { title: 'Senior Dev' },
      ],
    };
    const updated = setFieldValue(resume, 'experiences[latest].title', 'Staff Engineer');
    expect(updated.experiences[0].title).toBe('Staff Engineer'); // Most recent (index 0)
  });

  it('creates intermediate objects if they don\'t exist', () => {
    const resume = {} as any;
    const updated = setFieldValue(resume, 'contact.email', 'new@example.com');
    expect(updated.contact).toBeDefined();
    expect(updated.contact.email).toBe('new@example.com');
  });

  it('creates intermediate arrays if they don\'t exist', () => {
    const resume = {} as any;
    const updated = setFieldValue(resume, 'skills.technical[0]', 'JavaScript');
    expect(Array.isArray(updated.skills.technical)).toBe(true);
    expect(updated.skills.technical[0]).toBe('JavaScript');
  });

  it('does not mutate original object', () => {
    const original = { summary: 'Original' };
    const updated = setFieldValue(original, 'summary', 'Updated');
    expect(original.summary).toBe('Original'); // Original unchanged
    expect(updated.summary).toBe('Updated'); // Copy modified
  });

  it('throws error when setting invalid array index', () => {
    const resume = { skills: { technical: ['JavaScript'] } };
    expect(() => setFieldValue(resume, 'skills.technical[999]', 'Python')).toThrow(
      /out of bounds|invalid index/i
    );
  });

  it('throws error for invalid path syntax', () => {
    const resume = { summary: 'Test' };
    expect(() => setFieldValue(resume, '', 'value')).toThrow(/empty.*path/i);
  });
});

describe('Field Path Resolver - validateFieldPath', () => {
  const resumeSchema = {
    summary: 'string',
    contact: {
      name: 'string',
      email: 'string',
      phone: 'string',
      location: 'string',
    },
    skills: {
      technical: ['string'],
      soft: ['string'],
    },
    experiences: [
      {
        title: 'string',
        company: 'string',
        location: 'string',
        startDate: 'string',
        endDate: 'string',
        achievements: ['string'],
      },
    ],
    education: [
      {
        degree: 'string',
        field: 'string',
        institution: 'string',
        graduationDate: 'string',
      },
    ],
  };

  it('validates simple field path', () => {
    const result = validateFieldPath('summary', resumeSchema);
    expect(result.valid).toBe(true);
  });

  it('validates nested object path', () => {
    const result = validateFieldPath('contact.email', resumeSchema);
    expect(result.valid).toBe(true);
  });

  it('validates array path', () => {
    const result = validateFieldPath('experiences[0].title', resumeSchema);
    expect(result.valid).toBe(true);
  });

  it('validates nested array path', () => {
    const result = validateFieldPath('experiences[0].achievements[0]', resumeSchema);
    expect(result.valid).toBe(true);
  });

  it('validates path with [latest] keyword', () => {
    const result = validateFieldPath('experiences[latest].title', resumeSchema);
    expect(result.valid).toBe(true);
  });

  it('rejects non-existent field', () => {
    const result = validateFieldPath('nonexistent', resumeSchema);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/field.*not.*found/i);
  });

  it('rejects invalid nested path', () => {
    const result = validateFieldPath('contact.invalid', resumeSchema);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/field.*not.*found/i);
  });

  it('rejects array access on non-array field', () => {
    const result = validateFieldPath('summary[0]', resumeSchema);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not.*array/i);
  });

  it('rejects property access on array without index', () => {
    const result = validateFieldPath('experiences.title', resumeSchema);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/array.*requires.*index/i);
  });

  it('provides helpful error messages', () => {
    const result = validateFieldPath('contact.emial', resumeSchema); // Typo
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.suggestions).toContain('email'); // Suggest correct spelling
  });
});
