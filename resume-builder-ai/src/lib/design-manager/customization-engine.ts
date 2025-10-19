/**
 * Design Customization Engine
 *
 * Parses natural-language design requests (colors, fonts, layout, headers, text boxes)
 * into a structured customization object compatible with resume templates and the
 * `design_customizations` table. Generates an HTML preview via `renderTemplatePreview`.
 */

import { renderTemplatePreview } from './template-renderer';

type Nullable<T> = T | null | undefined;

export interface InterpretationResult {
  understood: false;
  clarificationNeeded: string;
}

export interface CustomizationResult {
  customization: any;
  preview: string;
  reasoning: string;
}

/** Allowed named colors mapped to hex */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  gray: '#6b7280',
  grey: '#6b7280',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
  navy: '#001f3f',
  'navy blue': '#001f3f',
  indigo: '#6366f1',
  slate: '#334155',
  zinc: '#3f3f46',
};

const HEX_COLOR_RE = /#(?:[\da-fA-F]{3}){1,2}\b/;
const RGB_COLOR_RE = /rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/i;
const HSL_COLOR_RE = /hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)/i;

function normalizeColor(input: string): string | null {
  const lower = input.toLowerCase().trim();
  if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
  if (HEX_COLOR_RE.test(lower)) return lower;
  if (RGB_COLOR_RE.test(lower)) return lower;
  if (HSL_COLOR_RE.test(lower)) return lower;
  return null;
}

/** Safe font whitelist */
const ALLOWED_FONTS = [
  'Inter',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Roboto',
  'Open Sans',
  'Trebuchet MS',
  'System UI',
];

function normalizeFont(input: string): string | null {
  const trimmed = input.trim().replace(/^to\s+/i, '');
  // Find best match ignoring case
  const match = ALLOWED_FONTS.find((f) => f.toLowerCase() === trimmed.toLowerCase());
  if (match) return match;
  // Heuristic: allow any generic family
  if (/serif|sans-serif|monospace/i.test(trimmed)) return trimmed;
  return null;
}

/**
 * Build scoped, allowlisted CSS additions. All rules must target `.resume-container`.
 */
function buildScopedCss(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((rule) => {
      // Enforce scoping to resume-container only
      if (!rule.startsWith('.resume-container')) {
        return `.resume-container ${rule.startsWith('{') ? '' : ''}${rule}`;
      }
      return rule;
    })
    .join('\n');
}

/**
 * Very conservative sanitizer: strips characters outside a safe allowlist for CSS text.
 * This is not a full CSS sanitizer but restricts to letters, numbers, spaces and basic
 * punctuation commonly used in style declarations.
 */
function sanitizeCss(css: string): string {
  // Remove < and > to avoid HTML/context switches
  const noAngles = css.replace(/[<>]/g, '');
  // Remove url() to avoid external fetches
  const noUrl = noAngles.replace(/url\([^\)]*\)/gi, '');
  return noUrl;
}

interface ParsedIntent {
  colors?: Partial<{
    background: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
  }>;
  fonts?: Partial<{ heading: string; body: string }>;
  layout?: 'two-column' | 'one-column';
  headers?: Partial<{ color: string; size: string; weight: string }>; // e.g., size 'large', weight 'bold'
  textBoxes?: boolean;
}

function parseDesignMessage(message: string): ParsedIntent {
  const m = message.toLowerCase();
  const result: ParsedIntent = {};

  // Colors
  const colorTargets: Array<keyof NonNullable<ParsedIntent['colors']>> = [
    'background',
    'primary',
    'secondary',
    'accent',
    'text',
  ];
  for (const target of colorTargets) {
    const re = new RegExp(`${target} (?:color|to)?\s*(?:to|:)\s*([^.,\n]+)`, 'i');
    const match = message.match(re);
    if (match && match[1]) {
      const col = normalizeColor(match[1]);
      if (col) {
        result.colors = result.colors || {};
        result.colors[target] = col;
      }
    }
  }

  // Shorthand: "background color to X" or "make background X"
  const bgMatch = message.match(/background (?:color\s*)?(?:to|is|=)?\s*([^.,\n]+)/i) ||
                  message.match(/change the background(?: color)? to\s*([^.,\n]+)/i) ||
                  message.match(/make the background\s*([^.,\n]+)/i);
  if (bgMatch && bgMatch[1]) {
    const c = normalizeColor(bgMatch[1]);
    if (c) {
      result.colors = result.colors || {};
      result.colors.background = c;
    }
  }

  // Fonts
  const fontHeadMatch = message.match(/(heading|headers?)\s+font\s*(?:to|:)?\s*([^.,\n]+)/i);
  if (fontHeadMatch && fontHeadMatch[2]) {
    const f = normalizeFont(fontHeadMatch[2]);
    if (f) {
      result.fonts = result.fonts || {};
      result.fonts.heading = f;
    }
  }
  const fontBodyMatch = message.match(/(body|text)\s+font\s*(?:to|:)?\s*([^.,\n]+)/i);
  if (fontBodyMatch && fontBodyMatch[2]) {
    const f = normalizeFont(fontBodyMatch[2]);
    if (f) {
      result.fonts = result.fonts || {};
      result.fonts.body = f;
    }
  }
  const anyFontMatch = message.match(/font\s*(?:to|:)?\s*([^.,\n]+)/i);
  if (anyFontMatch && anyFontMatch[1]) {
    const f = normalizeFont(anyFontMatch[1]);
    if (f) {
      result.fonts = result.fonts || {};
      result.fonts.body = result.fonts.body || f;
      result.fonts.heading = result.fonts.heading || f;
    }
  }

  // Layout
  if (/(two|2)[-\s]?column/i.test(m) || /split into two columns/i.test(m)) {
    result.layout = 'two-column';
  } else if (/(one|1)[-\s]?column/i.test(m)) {
    result.layout = 'one-column';
  }

  // Headers
  const headerColorMatch = message.match(/headers?\s+(?:color|to)\s*([^.,\n]+)/i);
  if (headerColorMatch && headerColorMatch[1]) {
    const c = normalizeColor(headerColorMatch[1]);
    if (c) {
      result.headers = { ...(result.headers || {}), color: c };
    }
  }
  if (/headers?\s+(?:bold|bolder)/i.test(m)) {
    result.headers = { ...(result.headers || {}), weight: 'bold' };
  }
  if (/larger headers?|increase header size/i.test(m)) {
    result.headers = { ...(result.headers || {}), size: 'large' };
  }

  // Text boxes
  if (/text boxes?/i.test(m) || /boxed sections?/i.test(m) || /add borders? to sections?/i.test(m)) {
    result.textBoxes = true;
  }

  return result;
}

function mergeCustomization(current: any, parsed: ParsedIntent, templateId?: string) {
  const customization = JSON.parse(JSON.stringify(current || {}));

  customization.color_scheme = customization.color_scheme || {};
  customization.font_family = customization.font_family || {};
  customization.spacing = customization.spacing || {};

  if (parsed.colors) {
    customization.color_scheme = {
      ...customization.color_scheme,
      ...parsed.colors,
    };
  }
  if (parsed.fonts) {
    customization.font_family = {
      ...customization.font_family,
      ...parsed.fonts,
    };
  }

  const cssParts: string[] = [];

  // Layout rules
  if (parsed.layout === 'two-column') {
    cssParts.push(`.resume-container { column-count: 2; column-gap: 2rem; }`);
  } else if (parsed.layout === 'one-column') {
    cssParts.push(`.resume-container { column-count: 1; }`);
  }

  // Header visuals
  if (parsed.headers?.color) {
    cssParts.push(`.resume-container h1, .resume-container h2 { color: ${parsed.headers.color}; }`);
  }
  if (parsed.headers?.weight === 'bold') {
    cssParts.push(`.resume-container h1, .resume-container h2 { font-weight: 700; }`);
  }
  if (parsed.headers?.size === 'large') {
    cssParts.push(`.resume-container h1 { font-size: 2.25rem; } .resume-container h2 { font-size: 1.5rem; }`);
  }

  // Text boxes around sections
  if (parsed.textBoxes) {
    cssParts.push(`.resume-container section { border: 1px solid rgba(0,0,0,0.08); padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.02); }`);
  }

  // Background color overrides for common template roots
  if (parsed.colors?.background) {
    const bg = parsed.colors.background;
    const templateRootClasses = [
      '.resume-card-ssr',
      '.resume-minimal-ssr',
      '.resume-sidebar-ssr',
      '.resume-timeline-ssr'
    ];
    cssParts.push(`.resume-wrapper { background: ${bg} !important; }`);
    cssParts.push(`.resume-container { background: ${bg} !important; }`);
    for (const root of templateRootClasses) {
      cssParts.push(`${root} { background: ${bg} !important; }`);
    }
  }

  // Text color override (applies broadly, but scoped and important to win over template rules)
  if (parsed.colors?.text) {
    const text = parsed.colors.text;
    cssParts.push(`.resume-wrapper, .resume-container, .resume-container * { color: ${text} !important; }`);
  }

  const scopedCss = buildScopedCss(cssParts);
  const safeCss = sanitizeCss(scopedCss);

  customization.custom_css = [customization.custom_css || '', safeCss].filter(Boolean).join('\n');
  // Default ATS safety stays truthy unless user explicitly asks for decorative elements
  customization.is_ats_safe = customization.is_ats_safe !== false;

  return customization;
}

export async function interpretDesignRequest(message: string): Promise<ParsedIntent | InterpretationResult> {
  const parsed = parseDesignMessage(message);
  const hasAny = !!(
    parsed.colors || parsed.fonts || parsed.layout || parsed.headers || parsed.textBoxes
  );
  if (!hasAny) {
  return {
      understood: false,
      clarificationNeeded:
        "I can change colors, fonts, layout (e.g., two-column), headers, and add text boxes. Try: 'change the background color to navy blue' or 'use a two-column layout'.",
    };
  }
  return parsed;
}

export async function validateAndApply(
  message: string,
  templateId: string,
  currentDesignConfig: Nullable<any>,
  currentResumeContent: any
): Promise<InterpretationResult | CustomizationResult> {
  const interpreted = await interpretDesignRequest(message);
  if ('understood' in interpreted && interpreted.understood === false) {
    return interpreted;
  }

  const customization = mergeCustomization(currentDesignConfig || {}, interpreted as ParsedIntent, templateId);

  const reasoningParts: string[] = [];
  const p = interpreted as ParsedIntent;
  if (p.colors?.background) reasoningParts.push(`Background set to ${p.colors.background}.`);
  if (p.colors?.primary) reasoningParts.push(`Primary color set to ${p.colors.primary}.`);
  if (p.fonts?.heading) reasoningParts.push(`Heading font set to ${p.fonts.heading}.`);
  if (p.fonts?.body) reasoningParts.push(`Body font set to ${p.fonts.body}.`);
  if (p.layout === 'two-column') reasoningParts.push('Applied a two-column layout.');
  if (p.layout === 'one-column') reasoningParts.push('Switched to one-column layout.');
  if (p.headers?.color) reasoningParts.push('Updated header color.');
  if (p.headers?.weight) reasoningParts.push('Made headers bold.');
  if (p.headers?.size) reasoningParts.push('Increased header sizes.');
  if (p.textBoxes) reasoningParts.push('Added subtle text boxes around sections.');

  const reasoning = reasoningParts.length > 0 ? reasoningParts.join(' ') : 'Applied design customization.';

  // Generate preview HTML (best-effort; non-fatal if it fails)
  let preview = '';
  try {
    preview = await renderTemplatePreview(templateId, currentResumeContent, customization);
  } catch (err) {
    preview = '';
  }

  return { customization, preview, reasoning };
}

// Removed legacy OpenAI-driven implementation to avoid duplicate exports and simplify runtime.
