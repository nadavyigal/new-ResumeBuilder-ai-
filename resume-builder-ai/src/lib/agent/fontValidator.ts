/**
 * Font Validation and Mapping - Professional Resume Fonts
 * Phase 4, Task T027
 *
 * Validates and normalizes font family names for resume customization.
 * Ensures only professional, ATS-friendly fonts are used.
 */

export interface FontMapping {
  name: string;           // Display name
  aliases: string[];      // Alternative names/spellings
  category: 'serif' | 'sans-serif' | 'monospace';
  atsSafe: boolean;       // Whether font is ATS-friendly
  professional: boolean;  // Whether suitable for professional resumes
  fallbacks: string[];    // CSS fallback fonts
}

/**
 * Professional resume fonts with aliases and metadata
 */
const FONT_LIBRARY: Record<string, FontMapping> = {
  // Serif Fonts (Traditional/Formal)
  'times new roman': {
    name: 'Times New Roman',
    aliases: ['times', 'times new', 'tnr'],
    category: 'serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Georgia', 'serif'],
  },
  georgia: {
    name: 'Georgia',
    aliases: [],
    category: 'serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Times New Roman', 'serif'],
  },
  garamond: {
    name: 'Garamond',
    aliases: [],
    category: 'serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Georgia', 'serif'],
  },
  'eb garamond': {
    name: 'EB Garamond',
    aliases: ['eb-garamond'],
    category: 'serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Garamond', 'Georgia', 'serif'],
  },
  cambria: {
    name: 'Cambria',
    aliases: [],
    category: 'serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Georgia', 'serif'],
  },

  // Sans-Serif Fonts (Modern/Clean)
  arial: {
    name: 'Arial',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Helvetica', 'sans-serif'],
  },
  helvetica: {
    name: 'Helvetica',
    aliases: ['helvetica neue'],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  calibri: {
    name: 'Calibri',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  verdana: {
    name: 'Verdana',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  tahoma: {
    name: 'Tahoma',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Verdana', 'Arial', 'sans-serif'],
  },
  'trebuchet ms': {
    name: 'Trebuchet MS',
    aliases: ['trebuchet'],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  roboto: {
    name: 'Roboto',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  lato: {
    name: 'Lato',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  'open sans': {
    name: 'Open Sans',
    aliases: ['opensans'],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  montserrat: {
    name: 'Montserrat',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },
  poppins: {
    name: 'Poppins',
    aliases: [],
    category: 'sans-serif',
    atsSafe: true,
    professional: true,
    fallbacks: ['Arial', 'sans-serif'],
  },

  // Monospace Fonts (Technical/Developer Resumes)
  'courier new': {
    name: 'Courier New',
    aliases: ['courier'],
    category: 'monospace',
    atsSafe: true,
    professional: false, // Not recommended for most resumes
    fallbacks: ['monospace'],
  },
  consolas: {
    name: 'Consolas',
    aliases: [],
    category: 'monospace',
    atsSafe: true,
    professional: false,
    fallbacks: ['Courier New', 'monospace'],
  },
};

/**
 * Normalize and validate font family name
 *
 * @param fontName - User-provided font name (case-insensitive)
 * @returns FontMapping if valid, null if invalid
 */
export function validateFont(fontName: string): FontMapping | null {
  const normalized = fontName.trim().toLowerCase();

  // Direct lookup
  if (FONT_LIBRARY[normalized]) {
    return FONT_LIBRARY[normalized];
  }

  // Check aliases
  for (const [key, mapping] of Object.entries(FONT_LIBRARY)) {
    if (mapping.aliases.includes(normalized)) {
      return mapping;
    }
  }

  return null;
}

/**
 * Get normalized font name (properly capitalized)
 *
 * @param fontName - User-provided font name
 * @returns Normalized font name or null if invalid
 */
export function normalizeFont(fontName: string): string | null {
  const mapping = validateFont(fontName);
  return mapping ? mapping.name : null;
}

/**
 * Check if font is ATS-safe (parseable by Applicant Tracking Systems)
 *
 * @param fontName - Font name to check
 * @returns true if ATS-safe, false otherwise
 */
export function isATSSafe(fontName: string): boolean {
  const mapping = validateFont(fontName);
  return mapping?.atsSafe ?? false;
}

/**
 * Check if font is professional for resumes
 *
 * @param fontName - Font name to check
 * @returns true if professional, false otherwise
 */
export function isProfessional(fontName: string): boolean {
  const mapping = validateFont(fontName);
  return mapping?.professional ?? false;
}

/**
 * Get CSS font-family string with fallbacks
 *
 * @param fontName - Primary font name
 * @returns CSS font-family string with fallbacks
 */
export function getFontFamilyCSS(fontName: string): string {
  const mapping = validateFont(fontName);
  if (!mapping) {
    return 'Arial, sans-serif'; // Safe default
  }

  const fonts = [mapping.name, ...mapping.fallbacks];
  return fonts.map(f => (f.includes(' ') ? `"${f}"` : f)).join(', ');
}

/**
 * Get all available professional fonts
 *
 * @returns Array of professional font names
 */
export function getAvailableFonts(): string[] {
  return Object.values(FONT_LIBRARY)
    .filter(mapping => mapping.professional)
    .map(mapping => mapping.name)
    .sort();
}

/**
 * Get font category
 *
 * @param fontName - Font name
 * @returns Font category or null if invalid
 */
export function getFontCategory(fontName: string): 'serif' | 'sans-serif' | 'monospace' | null {
  const mapping = validateFont(fontName);
  return mapping?.category ?? null;
}
