/**
 * Parse color change requests from natural language
 */

const NAMED_COLORS: Record<string, string> = {
  // Blues
  blue: '#3b82f6',
  'light blue': '#bfdbfe',
  'dark blue': '#1e40af',
  navy: '#1e3a8a',
  sky: '#0ea5e9',
  
  // Greens
  green: '#10b981',
  'light green': '#86efac',
  'dark green': '#065f46',
  emerald: '#10b981',
  lime: '#84cc16',
  
  // Reds
  red: '#ef4444',
  'light red': '#fca5a5',
  'dark red': '#991b1b',
  rose: '#f43f5e',
  
  // Grays
  gray: '#6b7280',
  'light gray': '#d1d5db',
  'dark gray': '#374151',
  slate: '#64748b',
  black: '#000000',
  white: '#ffffff',
  
  // Others
  yellow: '#fbbf24',
  purple: '#a855f7',
  pink: '#ec4899',
  orange: '#f97316',
  teal: '#14b8a6',
  indigo: '#6366f1',
  brown: '#92400e',
};

export interface ColorRequest {
  target: 'background' | 'header' | 'text' | 'accent' | 'primary' | 'font';
  color?: string;  // Normalized hex value (for colors)
  font?: string;   // Font family name (for fonts)
  originalColor?: string; // Original color name/value from user
  originalFont?: string;  // Original font name from user
}

/**
 * Parse color change requests from message
 */
export function parseColorRequest(message: string): ColorRequest[] {
  const requests: ColorRequest[] = [];
  const lower = message.toLowerCase();
  
  // Background color
  const bgMatch = lower.match(/(?:change|make|set|update)\s+(?:the\s+)?background\s+(?:color\s+)?(?:to\s+)?([a-z\s]+|#[0-9a-f]{3,6})/i);
  if (bgMatch) {
    const colorStr = bgMatch[1].trim();
    const normalized = normalizeColor(colorStr);
    if (normalized) {
      requests.push({
        target: 'background',
        color: normalized,
        originalColor: colorStr,
      });
    }
  }
  
  // Header/heading color
  const headerMatch = lower.match(/(?:change|make|set|update)\s+(?:the\s+)?(?:header[s]?|heading[s]?)\s+(?:color\s+)?(?:to\s+)?([a-z\s]+|#[0-9a-f]{3,6})/i);
  if (headerMatch) {
    const colorStr = headerMatch[1].trim();
    const normalized = normalizeColor(colorStr);
    if (normalized) {
      requests.push({
        target: 'header',
        color: normalized,
        originalColor: colorStr,
      });
    }
  }
  
  // Text color
  const textMatch = lower.match(/(?:change|make|set|update)\s+(?:the\s+)?(?:text|font)\s+color\s+(?:to\s+)?([a-z\s]+|#[0-9a-f]{3,6})/i);
  if (textMatch) {
    const colorStr = textMatch[1].trim();
    const normalized = normalizeColor(colorStr);
    if (normalized) {
      requests.push({
        target: 'text',
        color: normalized,
        originalColor: colorStr,
      });
    }
  }
  
  // Primary/accent color
  const primaryMatch = lower.match(/(?:change|make|set|update)\s+(?:the\s+)?(?:primary|accent)\s+color\s+(?:to\s+)?([a-z\s]+|#[0-9a-f]{3,6})/i);
  if (primaryMatch) {
    const colorStr = primaryMatch[1].trim();
    const normalized = normalizeColor(colorStr);
    if (normalized) {
      requests.push({
        target: 'primary',
        color: normalized,
        originalColor: colorStr,
      });
    }
  }

  // Font family (e.g., "change fonts to arial", "change font to roboto")
  const fontMatch = lower.match(/(?:change|make|set|update)\s+(?:the\s+)?fonts?\s+(?:to\s+)?([a-z\s]+)/i);
  if (fontMatch) {
    const fontStr = fontMatch[1].trim();
    // Normalize font name (capitalize first letter of each word)
    const normalizedFont = fontStr
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    requests.push({
      target: 'font',
      font: normalizedFont,
      originalFont: fontStr,
    });
  }

  return requests;
}

/**
 * Normalize color name or hex to standard hex format
 */
export function normalizeColor(color: string): string | null {
  const trimmed = color.trim().toLowerCase();
  
  // If it's already a valid hex code, return it
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toLowerCase();
  }
  
  // Handle 3-digit hex codes
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  
  // Look up named color
  if (NAMED_COLORS[trimmed]) {
    return NAMED_COLORS[trimmed];
  }
  
  // Check for multi-word color names
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    if (trimmed.includes(name) || name.includes(trimmed)) {
      return hex;
    }
  }
  
  // If we can't parse it, return null
  console.warn(`Could not parse color: ${color}`);
  return null;
}

/**
 * Validate hex color format
 */
export function validateColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
}

/**
 * Get color name from hex (for user-friendly messages)
 */
export function getColorName(hex: string): string {
  for (const [name, value] of Object.entries(NAMED_COLORS)) {
    if (value.toLowerCase() === hex.toLowerCase()) {
      return name;
    }
  }
  return hex;
}









