/**
 * Parse tip numbers from user message
 *
 * Examples:
 *   "implement tip 1" → [1]
 *   "implement tip number 2" → [2]
 *   "apply tip #3" → [3]
 *   "apply tips 1, 2 and 4" → [1, 2, 4]
 *   "do tip 2 and 3" → [2, 3]
 */
export function parseTipNumbers(message: string): number[] {
  // Match patterns like "tip 1", "tip number 2", "tip #3", "tips 1, 2 and 3"
  const match = message.match(/tip[s]?\s+(?:number\s+|#\s*)?(\d+(?:(?:,|\s+and)\s*\d+)*)/i);
  
  if (!match) {
    return [];
  }
  
  const numbersStr = match[1];
  
  // Split by comma or "and"
  const numbers = numbersStr
    .split(/,|\s+and\s+/)
    .map(s => s.trim())
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n) && n > 0);
  
  // Remove duplicates
  return [...new Set(numbers)];
}

/**
 * Validate tip numbers against available suggestions
 */
export function validateTipNumbers(
  tipNumbers: number[],
  totalTips: number
): { valid: boolean; invalid: number[] } {
  const invalid = tipNumbers.filter(n => n > totalTips);
  return {
    valid: invalid.length === 0,
    invalid,
  };
}




