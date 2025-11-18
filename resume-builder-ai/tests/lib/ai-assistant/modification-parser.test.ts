/**
 * Unit tests for Modification Parser
 *
 * Tests natural language parsing to structured modification operations:
 * - Parse user messages into modification intents
 * - Identify target fields automatically
 * - Determine operation type (replace, prefix, suffix, append, etc.)
 * - Extract modification values
 *
 * Examples:
 * - "add Senior to my job title" → prefix operation on experiences[latest].title
 * - "change my email to john@example.com" → replace operation on contact.email
 * - "remove Python from my skills" → remove operation on skills.technical array
 *
 * These tests MUST FAIL before implementation (TDD approach)
 */

import { describe, it, expect } from '@jest/globals';
import { parseModificationIntent } from '@/lib/ai-assistant/modification-parser';
import type { ModificationIntent } from '@/lib/ai-assistant/modification-parser';

describe('Modification Parser - Job Title Modifications', () => {
  it('parses "add Senior to job title" as prefix operation', () => {
    const result = parseModificationIntent('add Senior to my latest job title');

    expect(result.operation).toBe('prefix');
    expect(result.field_path).toMatch(/experiences\[.*\]\.title/);
    expect(result.new_value).toMatch(/senior/i);
  });

  it('parses "make me a Senior Engineer" as replace operation', () => {
    const result = parseModificationIntent('make me a Senior Engineer');

    expect(result.operation).toBe('replace');
    expect(result.field_path).toMatch(/experiences\[.*\]\.title/);
    expect(result.new_value).toMatch(/senior.*engineer/i);
  });

  it('parses "change my title to Staff Engineer" as replace operation', () => {
    const result = parseModificationIntent('change my title to Staff Engineer');

    expect(result.operation).toBe('replace');
    expect(result.field_path).toMatch(/experiences\[.*\]\.title/);
    expect(result.new_value).toBe('Staff Engineer');
  });

  it('parses "add III to my title" as suffix operation', () => {
    const result = parseModificationIntent('add III to my title');

    expect(result.operation).toBe('suffix');
    expect(result.field_path).toMatch(/experiences\[.*\]\.title/);
    expect(result.new_value).toMatch(/III/);
  });

  it('defaults to latest experience when not specified', () => {
    const result = parseModificationIntent('add Senior to my job title');

    expect(result.field_path).toMatch(/experiences\[latest\]\.title/);
  });
});

describe('Modification Parser - Email/Contact Modifications', () => {
  it('parses "change my email to new@example.com" as replace operation', () => {
    const result = parseModificationIntent('change my email to new@example.com');

    expect(result.operation).toBe('replace');
    expect(result.field_path).toBe('contact.email');
    expect(result.new_value).toBe('new@example.com');
  });

  it('parses "update my phone number to 555-1234" as replace operation', () => {
    const result = parseModificationIntent('update my phone number to 555-1234');

    expect(result.operation).toBe('replace');
    expect(result.field_path).toBe('contact.phone');
    expect(result.new_value).toBe('555-1234');
  });

  it('parses "change location to San Francisco" as replace operation', () => {
    const result = parseModificationIntent('change my location to San Francisco');

    expect(result.operation).toBe('replace');
    expect(result.field_path).toBe('contact.location');
    expect(result.new_value).toBe('San Francisco');
  });
});

describe('Modification Parser - Skills Modifications', () => {
  it('parses "add Python to skills" as append operation', () => {
    const result = parseModificationIntent('add Python to my skills');

    expect(result.operation).toBe('append');
    expect(result.field_path).toMatch(/skills\.(technical|soft)/);
    expect(result.new_value).toBe('Python');
  });

  it('parses "add React, TypeScript to technical skills" as multiple appends', () => {
    const result = parseModificationIntent('add React and TypeScript to my technical skills');

    expect(result.operation).toBe('append');
    expect(result.field_path).toBe('skills.technical');
    expect(result.values).toEqual(['React', 'TypeScript']); // Multiple values
  });

  it('parses "remove JavaScript from skills" as remove operation', () => {
    const result = parseModificationIntent('remove JavaScript from my skills');

    expect(result.operation).toBe('remove');
    expect(result.field_path).toMatch(/skills\.(technical|soft)/);
    expect(result.target_value).toBe('JavaScript'); // Value to find and remove
  });

  it('classifies technical vs soft skills correctly', () => {
    const technical = parseModificationIntent('add Python to skills');
    expect(technical.field_path).toBe('skills.technical');

    const soft = parseModificationIntent('add Leadership to skills');
    expect(soft.field_path).toBe('skills.soft');
  });
});

describe('Modification Parser - Summary Modifications', () => {
  it('parses "change my summary to..." as replace operation', () => {
    const result = parseModificationIntent(
      'change my summary to Experienced software engineer with 10+ years in web development'
    );

    expect(result.operation).toBe('replace');
    expect(result.field_path).toBe('summary');
    expect(result.new_value).toMatch(/Experienced software engineer/);
  });

  it('parses "add to my summary" as suffix operation', () => {
    const result = parseModificationIntent('add to my summary: Passionate about clean code');

    expect(result.operation).toBe('suffix');
    expect(result.field_path).toBe('summary');
    expect(result.new_value).toMatch(/Passionate about clean code/);
  });
});

describe('Modification Parser - Achievement Modifications', () => {
  it('parses "add achievement to latest job" as append operation', () => {
    const result = parseModificationIntent(
      'add achievement to my latest job: Led migration to microservices'
    );

    expect(result.operation).toBe('append');
    expect(result.field_path).toBe('experiences[latest].achievements');
    expect(result.new_value).toMatch(/Led migration to microservices/);
  });

  it('parses "remove second achievement" as remove operation', () => {
    const result = parseModificationIntent('remove second achievement from my latest job');

    expect(result.operation).toBe('remove');
    expect(result.field_path).toBe('experiences[latest].achievements[1]'); // 0-indexed
  });

  it('parses "change first achievement" as replace operation', () => {
    const result = parseModificationIntent(
      'change first achievement to: Built scalable REST APIs'
    );

    expect(result.operation).toBe('replace');
    expect(result.field_path).toBe('experiences[latest].achievements[0]');
    expect(result.new_value).toMatch(/Built scalable REST APIs/);
  });
});

describe('Modification Parser - Intent Confidence and Ambiguity', () => {
  it('returns high confidence for clear modifications', () => {
    const result = parseModificationIntent('change my email to john@example.com');

    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('returns lower confidence for ambiguous modifications', () => {
    const result = parseModificationIntent('update my stuff');

    expect(result.confidence).toBeLessThan(0.5);
    expect(result.requires_clarification).toBe(true);
  });

  it('provides clarification questions for ambiguous requests', () => {
    const result = parseModificationIntent('add Senior');

    expect(result.requires_clarification).toBe(true);
    expect(result.clarification_question).toMatch(/what.*add.*senior/i);
    expect(result.suggested_fields).toContain('experiences[latest].title');
  });

  it('handles typos and variations gracefully', () => {
    const result1 = parseModificationIntent('ad Python to skills'); // "ad" instead of "add"
    const result2 = parseModificationIntent('add Python to skillz'); // "skillz" instead of "skills"

    expect(result1.operation).toBe('append');
    expect(result2.operation).toBe('append');
  });
});

describe('Modification Parser - Context Awareness', () => {
  const resumeContext = {
    experiences: [
      { title: 'Software Engineer', company: 'Tech Corp' },
      { title: 'Junior Developer', company: 'Startup' },
    ],
    skills: {
      technical: ['JavaScript', 'React'],
      soft: ['Leadership'],
    },
  };

  it('resolves "my latest job" to first experience (most recent)', () => {
    const result = parseModificationIntent('add Senior to my latest job title', resumeContext);

    expect(result.field_path).toBe('experiences[0].title');
    expect(result.context_used).toBe(true);
  });

  it('resolves "my previous job" to second experience', () => {
    const result = parseModificationIntent('add Senior to my previous job title', resumeContext);

    expect(result.field_path).toBe('experiences[1].title');
  });

  it('detects if skill already exists', () => {
    const result = parseModificationIntent('add JavaScript to skills', resumeContext);

    expect(result.warnings).toContain('JavaScript already exists in skills');
    expect(result.should_skip).toBe(true);
  });

  it('suggests similar fields when field not found', () => {
    const result = parseModificationIntent('change my emial to test@example.com', resumeContext);

    expect(result.suggested_fields).toContain('contact.email');
    expect(result.confidence).toBeLessThan(0.7);
  });
});

describe('Modification Parser - Complex Modifications', () => {
  it('parses modification with multiple steps', () => {
    const result = parseModificationIntent(
      'change my job title to Senior Engineer and add 10+ years experience to summary'
    );

    expect(result.modifications).toHaveLength(2);
    expect(result.modifications[0].field_path).toMatch(/title/);
    expect(result.modifications[1].field_path).toBe('summary');
  });

  it('handles quoted values correctly', () => {
    const result = parseModificationIntent('change my title to "Lead Software Engineer"');

    expect(result.new_value).toBe('Lead Software Engineer'); // No quotes in value
  });

  it('preserves casing in values', () => {
    const result = parseModificationIntent('add JavaScript to skills');

    expect(result.new_value).toBe('JavaScript'); // Not 'javascript'
  });
});

describe('Modification Parser - Error Handling', () => {
  it('throws error for empty message', () => {
    expect(() => parseModificationIntent('')).toThrow(/empty.*message/i);
  });

  it('throws error for non-modification messages', () => {
    const result = parseModificationIntent('What is the weather today?');

    expect(result.is_modification).toBe(false);
    expect(result.error).toMatch(/not.*modification/i);
  });

  it('handles malformed input gracefully', () => {
    const result = parseModificationIntent('add to to to skills');

    expect(result.requires_clarification).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe('Modification Parser - Ordinal Numbers', () => {
  it('parses ordinal numbers correctly', () => {
    const first = parseModificationIntent('change first achievement');
    const second = parseModificationIntent('remove second skill');
    const third = parseModificationIntent('update third experience');

    expect(first.field_path).toMatch(/\[0\]/);
    expect(second.field_path).toMatch(/\[1\]/);
    expect(third.field_path).toMatch(/\[2\]/);
  });

  it('parses "latest" as [latest] keyword', () => {
    const result = parseModificationIntent('update my latest job');

    expect(result.field_path).toMatch(/\[latest\]/);
  });

  it('parses "most recent" as [latest] keyword', () => {
    const result = parseModificationIntent('update my most recent experience');

    expect(result.field_path).toMatch(/\[latest\]/);
  });
});
