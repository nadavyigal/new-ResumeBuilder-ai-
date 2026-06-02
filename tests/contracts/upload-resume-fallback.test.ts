import { describe, expect, it, jest } from '@jest/globals';
import {
  normalizeResumeTextFallback,
  resolvePdfDataWithResumeTextFallback,
} from '@/lib/resume/resume-text-fallback';

describe('upload resume text fallback', () => {
  it('normalizes iOS supplied resumeText form field', () => {
    expect(normalizeResumeTextFallback('  Jane Resume\r\nExperience  \n')).toBe('Jane Resume\nExperience');
    expect(normalizeResumeTextFallback('   \n  ')).toBeNull();
    expect(normalizeResumeTextFallback(new File(['pdf'], 'resume.pdf'))).toBeNull();
  });

  it('uses parser text when backend parsing succeeds', async () => {
    const parsePdf = jest.fn(async () => ({
      text: 'Backend parser text',
      numpages: 1,
      info: { source: 'parser' },
    }));

    const result = await resolvePdfDataWithResumeTextFallback({
      fileBuffer: Buffer.from('%PDF parser success'),
      fileName: 'resume.pdf',
      resumeTextFallback: 'Client fallback text',
      parsePdf,
    });

    expect(result.text).toBe('Backend parser text');
    expect(result.info).toEqual({ source: 'parser' });
  });

  it('uses resumeText when backend parsing fails', async () => {
    const warn = jest.fn();
    const result = await resolvePdfDataWithResumeTextFallback({
      fileBuffer: Buffer.from('%PDF parser failure'),
      fileName: 'ios-resume.pdf',
      resumeTextFallback: 'Readable text extracted on iOS',
      parsePdf: async () => {
        throw new Error('xref parse failed');
      },
      warn,
    });

    expect(result.text).toBe('Readable text extracted on iOS');
    expect(result.info).toEqual({ source: 'client_resume_text_fallback' });
    expect(warn).toHaveBeenCalledWith(
      'PDF parse failed; using client fallback text',
      { fileName: 'ios-resume.pdf', error: 'xref parse failed' }
    );
  });

  it('rejects unreadable uploads when parser fails and no resumeText is supplied', async () => {
    await expect(resolvePdfDataWithResumeTextFallback({
      fileBuffer: Buffer.from('%PDF scanned image'),
      fileName: 'scanned.pdf',
      resumeTextFallback: null,
      parsePdf: async () => {
        throw new Error('no text');
      },
    })).rejects.toThrow('no text');
  });
});
