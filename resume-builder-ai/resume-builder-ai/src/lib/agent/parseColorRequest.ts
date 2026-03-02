/**
 * Parse color change requests from natural language
 */

const NAMED_COLORS: Record<string, string> = {
  // Blues (Professional & Resume-Friendly)
  blue: '#3b82f6',
  'light blue': '#bfdbfe',
  'dark blue': '#1e40af',
  navy: '#1e3a8a',
  'navy blue': '#1e3a8a',
  sky: '#0ea5e9',
  'sky blue': '#0ea5e9',
  azure: '#0080ff',
  cobalt: '#0047ab',
  royal: '#4169e1',
  'royal blue': '#4169e1',
  midnight: '#191970',
  'midnight blue': '#191970',
  steel: '#4682b4',
  'steel blue': '#4682b4',

  // Greens (Professional)
  green: '#10b981',
  'light green': '#86efac',
  'dark green': '#065f46',
  emerald: '#10b981',
  lime: '#84cc16',
  forest: '#228b22',
  'forest green': '#228b22',
  olive: '#6b8e23',
  sage: '#9dc183',
  mint: '#98ff98',
  seafoam: '#93e9be',

  // Reds (Professional - Use Sparingly)
  red: '#ef4444',
  'light red': '#fca5a5',
  'dark red': '#991b1b',
  rose: '#f43f5e',
  crimson: '#dc143c',
  burgundy: '#800020',
  maroon: '#800000',

  // Grays (Most Professional for Resumes)
  gray: '#6b7280',
  grey: '#6b7280', // Alternative spelling
  'light gray': '#d1d5db',
  'light grey': '#d1d5db',
  'dark gray': '#374151',
  'dark grey': '#374151',
  slate: '#64748b',
  charcoal: '#36454f',
  silver: '#c0c0c0',
  black: '#000000',
  white: '#ffffff',
  'off white': '#f8f9fa',
  cream: '#fffdd0',
  ivory: '#fffff0',

  // Purples (Creative Fields)
  purple: '#a855f7',
  'light purple': '#e9d5ff',
  'dark purple': '#6b21a8',
  violet: '#8b00ff',
  lavender: '#e6e6fa',
  plum: '#dda0dd',

  // Yellows & Oranges (Accent Colors)
  yellow: '#fbbf24',
  'light yellow': '#fef3c7',
  gold: '#ffd700',
  amber: '#ffbf00',
  orange: '#f97316',
  'light orange': '#fed7aa',
  'dark orange': '#c2410c',
  coral: '#ff7f50',
  peach: '#ffe5b4',

  // Pinks (Creative/Modern)
  pink: '#ec4899',
  'light pink': '#fbcfe8',
  'dark pink': '#be185d',
  'hot pink': '#ff69b4',

  // Teals & Cyans (Modern Professional)
  teal: '#14b8a6',
  'light teal': '#99f6e4',
  'dark teal': '#115e59',
  cyan: '#06b6d4',
  turquoise: '#40e0d0',
  aqua: '#00ffff',

  // Browns (Warm Professional)
  brown: '#92400e',
  'light brown': '#d2691e',
  'dark brown': '#654321',
  tan: '#d2b48c',
  beige: '#f5f5dc',
  coffee: '#6f4e37',
  chocolate: '#7b3f00',

  // Indigos (Deep Professional)
  indigo: '#6366f1',
  'light indigo': '#c7d2fe',
  'dark indigo': '#3730a3',
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














