import { createHash } from 'crypto';

export function hashContent(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}
