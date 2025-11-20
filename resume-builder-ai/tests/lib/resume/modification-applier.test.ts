/**
 * Unit tests for Modification Applier
 *
 * Tests all resume modification operations:
 * - replace: Replace entire field value
 * - prefix: Add text to beginning of field
 * - suffix: Add text to end of field
 * - append: Add new item to array
 * - insert: Insert item at specific array position
 * - remove: Remove field or array item
 *
 * These tests MUST FAIL before implementation (TDD approach)
 */

import { describe, it, expect } from '@jest/globals';
import { applyModification, ModificationOperation } from '@/lib/resume/modification-applier';

describe('Modification Applier - replace operation', () => {
  it('replaces simple string field', () => {
    const resume = { summary: 'Old summary text' };
    const modification: ModificationOperation = {
      operation: 'replace',
      field_path: 'summary',
      new_value: 'New improved summary',
    };

    const result = applyModification(resume, modification);
    expect(result.summary).toBe('New improved summary');
  });

  it('replaces nested object field', () => {
    const resume = { contact: { email: 'old@example.com' } };
    const modification: ModificationOperation = {
      operation: 'replace',
      field_path: 'contact.email',
      new_value: 'new@example.com',
    };

    const result = applyModification(resume, modification);
    expect(result.contact.email).toBe('new@example.com');
  });

  it('replaces array element', () => {
    const resume = {
      experiences: [
        { title: 'Junior Developer', company: 'Tech Corp' },
        { title: 'Developer', company: 'Other Corp' },
      ],
    };
    const modification: ModificationOperation = {
      operation: 'replace',
      field_path: 'experiences[0].title',
      new_value: 'Senior Software Engineer',
    };

    const result = applyModification(resume, modification);
    expect(result.experiences[0].title).toBe('Senior Software Engineer');
    expect(result.experiences[1].title).toBe('Developer'); // Other unchanged
  });

  it('replaces entire object in array', () => {
    const resume = {
      experiences: [{ title: 'Old Title', company: 'Old Company' }],
    };
    const modification: ModificationOperation = {
      operation: 'replace',
      field_path: 'experiences[0]',
      new_value: { title: 'New Title', company: 'New Company', location: 'New City' },
    };

    const result = applyModification(resume, modification);
    expect(result.experiences[0]).toEqual({
      title: 'New Title',
      company: 'New Company',
      location: 'New City',
    });
  });

  it('does not mutate original resume', () => {
    const original = { summary: 'Original' };
    const modification: ModificationOperation = {
      operation: 'replace',
      field_path: 'summary',
      new_value: 'Modified',
    };

    applyModification(original, modification);
    expect(original.summary).toBe('Original'); // Original unchanged
  });
});

describe('Modification Applier - prefix operation', () => {
  it('adds prefix to string field', () => {
    const resume = { experiences: [{ title: 'Software Engineer' }] };
    const modification: ModificationOperation = {
      operation: 'prefix',
      field_path: 'experiences[0].title',
      new_value: 'Senior ',
    };

    const result = applyModification(resume, modification);
    expect(result.experiences[0].title).toBe('Senior Software Engineer');
  });

  it('adds prefix with proper spacing', () => {
    const resume = { summary: 'Experienced developer' };
    const modification: ModificationOperation = {
      operation: 'prefix',
      field_path: 'summary',
      new_value: 'Highly motivated. ',
    };

    const result = applyModification(resume, modification);
    expect(result.summary).toBe('Highly motivated. Experienced developer');
  });

  it('handles prefix on empty string', () => {
    const resume = { summary: '' };
    const modification: ModificationOperation = {
      operation: 'prefix',
      field_path: 'summary',
      new_value: 'New content',
    };

    const result = applyModification(resume, modification);
    expect(result.summary).toBe('New content');
  });

  it('throws error when prefixing non-string field', () => {
    const resume = { skills: { technical: ['JavaScript'] } };
    const modification: ModificationOperation = {
      operation: 'prefix',
      field_path: 'skills.technical',
      new_value: 'Prefix',
    };

    expect(() => applyModification(resume, modification)).toThrow(/cannot prefix.*array/i);
  });
});

describe('Modification Applier - suffix operation', () => {
  it('adds suffix to string field', () => {
    const resume = { experiences: [{ title: 'Software Engineer' }] };
    const modification: ModificationOperation = {
      operation: 'suffix',
      field_path: 'experiences[0].title',
      new_value: ' III',
    };

    const result = applyModification(resume, modification);
    expect(result.experiences[0].title).toBe('Software Engineer III');
  });

  it('adds suffix with proper spacing', () => {
    const resume = { summary: 'Experienced developer' };
    const modification: ModificationOperation = {
      operation: 'suffix',
      field_path: 'summary',
      new_value: ' with 10+ years in the industry',
    };

    const result = applyModification(resume, modification);
    expect(result.summary).toBe('Experienced developer with 10+ years in the industry');
  });

  it('handles suffix on empty string', () => {
    const resume = { summary: '' };
    const modification: ModificationOperation = {
      operation: 'suffix',
      field_path: 'summary',
      new_value: 'Content added',
    };

    const result = applyModification(resume, modification);
    expect(result.summary).toBe('Content added');
  });

  it('throws error when suffixing non-string field', () => {
    const resume = { skills: { technical: ['JavaScript'] } };
    const modification: ModificationOperation = {
      operation: 'suffix',
      field_path: 'skills.technical',
      new_value: 'Suffix',
    };

    expect(() => applyModification(resume, modification)).toThrow(/cannot suffix.*array/i);
  });
});

describe('Modification Applier - append operation', () => {
  it('appends item to array', () => {
    const resume = {
      skills: { technical: ['JavaScript', 'TypeScript'] },
    };
    const modification: ModificationOperation = {
      operation: 'append',
      field_path: 'skills.technical',
      new_value: 'React',
    };

    const result = applyModification(resume, modification);
    expect(result.skills.technical).toEqual(['JavaScript', 'TypeScript', 'React']);
  });

  it('appends object to array', () => {
    const resume = {
      experiences: [{ title: 'Engineer', company: 'Corp A' }],
    };
    const modification: ModificationOperation = {
      operation: 'append',
      field_path: 'experiences',
      new_value: { title: 'Developer', company: 'Corp B' },
    };

    const result = applyModification(resume, modification);
    expect(result.experiences).toHaveLength(2);
    expect(result.experiences[1]).toEqual({ title: 'Developer', company: 'Corp B' });
  });

  it('appends to nested array', () => {
    const resume = {
      experiences: [{ achievements: ['Built API', 'Led team'] }],
    };
    const modification: ModificationOperation = {
      operation: 'append',
      field_path: 'experiences[0].achievements',
      new_value: 'Mentored developers',
    };

    const result = applyModification(resume, modification);
    expect(result.experiences[0].achievements).toEqual([
      'Built API',
      'Led team',
      'Mentored developers',
    ]);
  });

  it('creates array if field does not exist', () => {
    const resume = {} as any;
    const modification: ModificationOperation = {
      operation: 'append',
      field_path: 'skills.technical',
      new_value: 'JavaScript',
    };

    const result = applyModification(resume, modification);
    expect(Array.isArray(result.skills.technical)).toBe(true);
    expect(result.skills.technical).toEqual(['JavaScript']);
  });

  it('throws error when appending to non-array field', () => {
    const resume = { summary: 'Text' };
    const modification: ModificationOperation = {
      operation: 'append',
      field_path: 'summary',
      new_value: 'More text',
    };

    expect(() => applyModification(resume, modification)).toThrow(/cannot append.*string/i);
  });
});

describe('Modification Applier - insert operation', () => {
  it('inserts item at beginning of array', () => {
    const resume = {
      skills: { technical: ['JavaScript', 'TypeScript'] },
    };
    const modification: ModificationOperation = {
      operation: 'insert',
      field_path: 'skills.technical[0]',
      new_value: 'Python',
    };

    const result = applyModification(resume, modification);
    expect(result.skills.technical).toEqual(['Python', 'JavaScript', 'TypeScript']);
  });

  it('inserts item in middle of array', () => {
    const resume = {
      skills: { technical: ['JavaScript', 'React'] },
    };
    const modification: ModificationOperation = {
      operation: 'insert',
      field_path: 'skills.technical[1]',
      new_value: 'TypeScript',
    };

    const result = applyModification(resume, modification);
    expect(result.skills.technical).toEqual(['JavaScript', 'TypeScript', 'React']);
  });

  it('inserts object into array', () => {
    const resume = {
      experiences: [
        { title: 'Junior Dev', company: 'A' },
        { title: 'Staff Dev', company: 'C' },
      ],
    };
    const modification: ModificationOperation = {
      operation: 'insert',
      field_path: 'experiences[1]',
      new_value: { title: 'Senior Dev', company: 'B' },
    };

    const result = applyModification(resume, modification);
    expect(result.experiences).toHaveLength(3);
    expect(result.experiences[1].title).toBe('Senior Dev');
  });

  it('throws error when inserting at invalid index', () => {
    const resume = { skills: { technical: ['JavaScript'] } };
    const modification: ModificationOperation = {
      operation: 'insert',
      field_path: 'skills.technical[999]',
      new_value: 'Python',
    };

    expect(() => applyModification(resume, modification)).toThrow(/invalid.*index/i);
  });

  it('throws error when inserting to non-array field', () => {
    const resume = { summary: 'Text' };
    const modification: ModificationOperation = {
      operation: 'insert',
      field_path: 'summary[0]',
      new_value: 'Value',
    };

    expect(() => applyModification(resume, modification)).toThrow(/cannot insert.*string/i);
  });
});

describe('Modification Applier - remove operation', () => {
  it('removes simple field', () => {
    const resume = { summary: 'Text', contact: { email: 'test@example.com' } };
    const modification: ModificationOperation = {
      operation: 'remove',
      field_path: 'summary',
    };

    const result = applyModification(resume, modification);
    expect(result.summary).toBeUndefined();
    expect(result.contact).toBeDefined(); // Other fields unchanged
  });

  it('removes nested field', () => {
    const resume = { contact: { name: 'John', email: 'john@example.com', phone: '555-1234' } };
    const modification: ModificationOperation = {
      operation: 'remove',
      field_path: 'contact.phone',
    };

    const result = applyModification(resume, modification);
    expect(result.contact.phone).toBeUndefined();
    expect(result.contact.name).toBe('John'); // Other fields unchanged
  });

  it('removes array element by index', () => {
    const resume = {
      skills: { technical: ['JavaScript', 'TypeScript', 'Python'] },
    };
    const modification: ModificationOperation = {
      operation: 'remove',
      field_path: 'skills.technical[1]',
    };

    const result = applyModification(resume, modification);
    expect(result.skills.technical).toEqual(['JavaScript', 'Python']); // TypeScript removed
  });

  it('removes object from array', () => {
    const resume = {
      experiences: [
        { title: 'Engineer', company: 'A' },
        { title: 'Developer', company: 'B' },
      ],
    };
    const modification: ModificationOperation = {
      operation: 'remove',
      field_path: 'experiences[0]',
    };

    const result = applyModification(resume, modification);
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0].company).toBe('B');
  });

  it('handles removing non-existent field gracefully', () => {
    const resume = { summary: 'Text' };
    const modification: ModificationOperation = {
      operation: 'remove',
      field_path: 'nonexistent',
    };

    const result = applyModification(resume, modification);
    expect(result).toEqual(resume); // No change
  });
});

describe('Modification Applier - edge cases and validation', () => {
  it('throws error for invalid operation type', () => {
    const resume = { summary: 'Text' };
    const modification: any = {
      operation: 'invalid_operation',
      field_path: 'summary',
      new_value: 'Value',
    };

    expect(() => applyModification(resume, modification)).toThrow(/invalid.*operation/i);
  });

  it('throws error for missing field_path', () => {
    const resume = { summary: 'Text' };
    const modification: any = {
      operation: 'replace',
      new_value: 'Value',
    };

    expect(() => applyModification(resume, modification)).toThrow(/field_path.*required/i);
  });

  it('throws error for missing new_value in replace operation', () => {
    const resume = { summary: 'Text' };
    const modification: any = {
      operation: 'replace',
      field_path: 'summary',
    };

    expect(() => applyModification(resume, modification)).toThrow(/new_value.*required/i);
  });

  it('handles complex nested modifications', () => {
    const resume = {
      experiences: [
        {
          title: 'Engineer',
          achievements: ['Built API', 'Led team'],
        },
      ],
    };
    const modification: ModificationOperation = {
      operation: 'prefix',
      field_path: 'experiences[0].achievements[0]',
      new_value: 'Successfully ',
    };

    const result = applyModification(resume, modification);
    expect(result.experiences[0].achievements[0]).toBe('Successfully Built API');
  });

  it('preserves data types when modifying', () => {
    const resume = {
      contact: {
        name: 'John',
        isActive: true,
        age: 30,
      },
    };
    const modification: ModificationOperation = {
      operation: 'replace',
      field_path: 'contact.age',
      new_value: 31,
    };

    const result = applyModification(resume, modification);
    expect(typeof result.contact.age).toBe('number');
    expect(result.contact.age).toBe(31);
  });
});
