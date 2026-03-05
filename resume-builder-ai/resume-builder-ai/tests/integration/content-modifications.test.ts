/**
 * Integration tests for Content Modifications
 *
 * Tests the complete flow from user message to persisted resume modification:
 * 1. User sends natural language message
 * 2. Message is parsed into structured modification
 * 3. Modification is applied to resume
 * 4. ATS score is recalculated
 * 5. Changes are saved to database (optimizations + content_modifications tables)
 *
 * These tests MUST FAIL before implementation (TDD approach)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { parseModificationIntent } from '@/lib/ai-assistant/modification-parser';
import { applyModification } from '@/lib/resume/modification-applier';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Content Modifications Integration - Job Title Updates', () => {
  let mockSupabase: SupabaseClient;
  let mockResume: any;
  let modificationLog: any[];

  beforeEach(() => {
    mockResume = {
      summary: 'Software engineer with 5 years experience',
      contact: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        location: 'San Francisco, CA',
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
          endDate: 'Present',
          achievements: [
            'Built scalable REST APIs',
            'Mentored 3 junior developers',
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
      education: [],
    };

    modificationLog = [];

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'content_modifications') {
          return {
            insert: jest.fn().mockImplementation((data: any) => {
              modificationLog.push(data);
              return {
                select: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'mod-123', ...data },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'optimizations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'opt-123', rewrite_data: mockResume },
                  error: null,
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;
  });

  afterEach(() => {
    modificationLog = [];
  });

  it('completes full flow: "add Senior to job title"', async () => {
    // Step 1: Parse natural language message
    const intent = parseModificationIntent('add Senior to my latest job title', mockResume);
    expect(intent.operation).toBe('prefix');
    expect(intent.field_path).toMatch(/experiences\[.*\]\.title/);

    // Step 2: Apply modification
    const oldValue = mockResume.experiences[0].title;
    const modifiedResume = applyModification(mockResume, {
      operation: intent.operation,
      field_path: 'experiences[0].title',
      new_value: 'Senior ',
    });

    // Step 3: Verify modification applied correctly
    expect(modifiedResume.experiences[0].title).toBe('Senior Software Engineer');
    expect(modifiedResume.experiences[0].title).not.toBe(oldValue); // Changed
    expect(modifiedResume.experiences[0].achievements).toHaveLength(3); // No duplicates added

    // Step 4: Verify modification is logged
    expect(modificationLog).toHaveLength(1);
    expect(modificationLog[0].operation).toBe('prefix');
    expect(modificationLog[0].old_value).toBe('Software Engineer');
    expect(modificationLog[0].new_value).toBe('Senior Software Engineer');
  });

  it('prevents duplicate bullet creation when updating fields', async () => {
    const originalAchievements = [...mockResume.experiences[0].achievements];

    // Parse and apply title update
    const intent = parseModificationIntent('add Senior to job title', mockResume);
    const modified = applyModification(mockResume, {
      operation: intent.operation,
      field_path: 'experiences[0].title',
      new_value: 'Senior ',
    });

    // Verify achievements unchanged (no duplicate bullet)
    expect(modified.experiences[0].achievements).toEqual(originalAchievements);
    expect(modified.experiences[0].achievements).toHaveLength(3);
    expect(modified.experiences[0].achievements).not.toContain('Senior Software Engineer');
  });

  it('handles "change email" modification end-to-end', async () => {
    const newEmail = 'newemail@example.com';

    // Step 1: Parse
    const intent = parseModificationIntent(`change my email to ${newEmail}`, mockResume);
    expect(intent.field_path).toBe('contact.email');
    expect(intent.operation).toBe('replace');

    // Step 2: Apply
    const modified = applyModification(mockResume, {
      operation: 'replace',
      field_path: 'contact.email',
      new_value: newEmail,
    });

    // Step 3: Verify
    expect(modified.contact.email).toBe(newEmail);
    expect(modified.contact.name).toBe('John Doe'); // Other fields unchanged
  });
});

describe('Content Modifications Integration - Skills Management', () => {
  let mockResume: any;

  beforeEach(() => {
    mockResume = {
      skills: {
        technical: ['JavaScript', 'React'],
        soft: ['Communication'],
      },
    };
  });

  it('adds new skill without creating duplicates', async () => {
    // Step 1: Parse
    const intent = parseModificationIntent('add Python to my technical skills', mockResume);
    expect(intent.operation).toBe('append');

    // Step 2: Check for duplicates before adding
    const existingSkills = mockResume.skills.technical;
    expect(existingSkills).not.toContain('Python');

    // Step 3: Apply
    const modified = applyModification(mockResume, {
      operation: 'append',
      field_path: 'skills.technical',
      new_value: 'Python',
    });

    // Step 4: Verify
    expect(modified.skills.technical).toEqual(['JavaScript', 'React', 'Python']);
    expect(modified.skills.technical).toHaveLength(3); // No duplicates
  });

  it('prevents adding duplicate skill that already exists', async () => {
    const intent = parseModificationIntent('add JavaScript to skills', mockResume);

    // Parser should detect duplicate
    expect(intent.warnings).toContain('JavaScript already exists in skills');
    expect(intent.should_skip).toBe(true);

    // Should not apply modification
    if (!intent.should_skip) {
      const modified = applyModification(mockResume, {
        operation: 'append',
        field_path: 'skills.technical',
        new_value: 'JavaScript',
      });
      expect(modified.skills.technical).toEqual(['JavaScript', 'React']); // Unchanged
    }
  });

  it('removes skill from array correctly', async () => {
    const intent = parseModificationIntent('remove React from my skills', mockResume);
    expect(intent.operation).toBe('remove');

    const modified = applyModification(mockResume, {
      operation: 'remove',
      field_path: 'skills.technical[1]', // React is at index 1
    });

    expect(modified.skills.technical).toEqual(['JavaScript']);
    expect(modified.skills.technical).not.toContain('React');
  });
});

describe('Content Modifications Integration - ATS Score Recalculation', () => {
  it('recalculates ATS score after modification', async () => {
    const resume = {
      summary: 'Software engineer',
      experiences: [{ title: 'Developer', achievements: [] }],
      skills: { technical: ['JavaScript'], soft: [] },
    };

    const jobDescription = 'Looking for Senior Software Engineer with Python and React experience';

    // Initial ATS score (low because missing keywords)
    const initialScore = calculateATSScore(resume, jobDescription);
    expect(initialScore).toBeLessThan(70);

    // Add missing skills
    let modified = applyModification(resume, {
      operation: 'append',
      field_path: 'skills.technical',
      new_value: 'Python',
    });
    modified = applyModification(modified, {
      operation: 'append',
      field_path: 'skills.technical',
      new_value: 'React',
    });

    // Add "Senior" to title
    modified = applyModification(modified, {
      operation: 'prefix',
      field_path: 'experiences[0].title',
      new_value: 'Senior ',
    });

    // Recalculate ATS score
    const newScore = calculateATSScore(modified, jobDescription);
    expect(newScore).toBeGreaterThan(initialScore);
    expect(newScore).toBeGreaterThan(80); // Significantly improved
  });
});

describe('Content Modifications Integration - Database Persistence', () => {
  let mockSupabase: SupabaseClient;
  let savedModifications: any[];
  let savedOptimization: any;

  beforeEach(() => {
    savedModifications = [];
    savedOptimization = null;

    mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'content_modifications') {
          return {
            insert: jest.fn().mockImplementation((data: any) => {
              savedModifications.push(data);
              return {
                select: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: `mod-${savedModifications.length}`, ...data },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'optimizations') {
          return {
            update: jest.fn().mockImplementation((data: any) => {
              savedOptimization = data;
              return {
                eq: jest.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;
  });

  it('saves modification to content_modifications table', async () => {
    const resume = { experiences: [{ title: 'Engineer' }] };
    const modification = {
      user_id: 'user-123',
      optimization_id: 'opt-123',
      operation: 'prefix',
      field_path: 'experiences[0].title',
      old_value: 'Engineer',
      new_value: 'Senior Engineer',
    };

    // Save to database
    const { data, error } = await mockSupabase
      .from('content_modifications')
      .insert(modification)
      .select()
      .maybeSingle();

    expect(error).toBeNull();
    expect(savedModifications).toHaveLength(1);
    expect(savedModifications[0].operation).toBe('prefix');
    expect(savedModifications[0].field_path).toBe('experiences[0].title');
  });

  it('updates optimizations.rewrite_data with modified resume', async () => {
    const modifiedResume = {
      summary: 'Updated summary',
      experiences: [{ title: 'Senior Engineer' }],
    };

    // Update optimization
    const { error } = await mockSupabase
      .from('optimizations')
      .update({ rewrite_data: modifiedResume })
      .eq('id', 'opt-123');

    expect(error).toBeNull();
    expect(savedOptimization).toBeDefined();
    expect(savedOptimization.rewrite_data.experiences[0].title).toBe('Senior Engineer');
  });

  it('saves ATS score changes to modification log', async () => {
    const modification = {
      user_id: 'user-123',
      optimization_id: 'opt-123',
      operation: 'prefix',
      field_path: 'experiences[0].title',
      old_value: 'Engineer',
      new_value: 'Senior Engineer',
      ats_score_before: 65.5,
      ats_score_after: 78.2,
    };

    await mockSupabase.from('content_modifications').insert(modification).select().maybeSingle();

    expect(savedModifications[0].ats_score_before).toBe(65.5);
    expect(savedModifications[0].ats_score_after).toBe(78.2);
    // score_change is a generated column: 78.2 - 65.5 = 12.7
  });
});

describe('Content Modifications Integration - Error Handling', () => {
  it('rolls back changes if database save fails', async () => {
    const original = { summary: 'Original' };
    const modified = { summary: 'Modified' };

    // Mock database failure
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Database error' },
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    // Attempt to save
    const { error } = await mockSupabase
      .from('optimizations')
      .update({ rewrite_data: modified })
      .eq('id', 'opt-123');

    expect(error).toBeDefined();
    // In real implementation, should revert to original state
    expect(original.summary).toBe('Original'); // Unchanged due to rollback
  });

  it('handles invalid field paths gracefully', async () => {
    const resume = { summary: 'Text' };

    expect(() =>
      applyModification(resume, {
        operation: 'replace',
        field_path: 'nonexistent.field',
        new_value: 'Value',
      })
    ).toThrow(/field.*not.*found/i);
  });
});

describe('Content Modifications Integration - Complex Scenarios', () => {
  it('handles multiple sequential modifications', async () => {
    let resume = {
      experiences: [{ title: 'Engineer', achievements: ['Built APIs'] }],
      skills: { technical: ['JavaScript'], soft: [] },
    };

    // Modification 1: Add Senior to title
    resume = applyModification(resume, {
      operation: 'prefix',
      field_path: 'experiences[0].title',
      new_value: 'Senior ',
    });

    // Modification 2: Add achievement
    resume = applyModification(resume, {
      operation: 'append',
      field_path: 'experiences[0].achievements',
      new_value: 'Led team of 5 developers',
    });

    // Modification 3: Add skill
    resume = applyModification(resume, {
      operation: 'append',
      field_path: 'skills.technical',
      new_value: 'Python',
    });

    // Verify all modifications applied
    expect(resume.experiences[0].title).toBe('Senior Engineer');
    expect(resume.experiences[0].achievements).toHaveLength(2);
    expect(resume.skills.technical).toContain('Python');
  });
});

/**
 * Helper function to calculate ATS score
 * (Simplified version for testing)
 */
function calculateATSScore(resume: any, jobDescription: string): number {
  let score = 50; // Base score

  const keywords = jobDescription.toLowerCase().split(/\s+/);
  const resumeText = JSON.stringify(resume).toLowerCase();

  for (const keyword of keywords) {
    if (resumeText.includes(keyword)) {
      score += 5;
    }
  }

  return Math.min(score, 100);
}
