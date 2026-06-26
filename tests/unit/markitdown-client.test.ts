import { describe, expect, it } from '@jest/globals';
import { sanitizeExtractedText } from '@/lib/markitdown-client';

const NUL = String.fromCharCode(0);

describe('sanitizeExtractedText', () => {
  it('strips embedded NUL bytes', () => {
    const input = `Jane Doe ${NUL}\nSenior Engineer${NUL}${NUL}`;
    expect(sanitizeExtractedText(input).includes(NUL)).toBe(false);
    expect(sanitizeExtractedText(input)).toBe('Jane Doe \nSenior Engineer');
  });

  it('leaves clean text untouched', () => {
    const input = 'Jane Doe\nSenior Engineer';
    expect(sanitizeExtractedText(input)).toBe(input);
  });
});
