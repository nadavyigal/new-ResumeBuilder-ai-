/**
 * Styled PDF Templates Registry
 *
 * Maps template slugs to @react-pdf/renderer components that visually match
 * the browser HTML templates. Used as the serverless-compatible PDF renderer
 * when the Docker PDF service is unavailable.
 */

import React from 'react';
import { Font } from '@react-pdf/renderer';
import type { OptimizedResume } from '../ai-optimizer';
import type { DesignCustomizationLike } from '../design-manager/render-preview-html';

// ---------------------------------------------------------------------------
// Font Registration
// ---------------------------------------------------------------------------

// We intentionally register only a minimal set of system-safe fonts.
// @react-pdf/renderer ships with Helvetica built-in so we don't *need*
// external Google Font fetches which can fail in CI or slow cold-starts.
// If you want richer typography later you can uncomment the Google Font block.

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica', fontWeight: 'normal' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
});

// ---------------------------------------------------------------------------
// Palette System  (mirrors selectPalette / applyCustomization from
// render-preview-html.ts)
// ---------------------------------------------------------------------------

export interface TemplatePalette {
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  bg: string;
  text: string;
}

export function selectPalette(templateSlug: string): TemplatePalette {
  if (templateSlug.includes('sidebar')) {
    return { primary: '#0f172a', secondary: '#475569', accent: '#10b981', muted: '#e2e8f0', bg: '#ffffff', text: '#0f172a' };
  }
  if (templateSlug.includes('card') || templateSlug.includes('modern')) {
    return { primary: '#1d4ed8', secondary: '#475569', accent: '#22c55e', muted: '#eef2ff', bg: '#ffffff', text: '#0f172a' };
  }
  if (templateSlug.includes('timeline') || templateSlug.includes('creative')) {
    return { primary: '#7c3aed', secondary: '#475569', accent: '#f59e0b', muted: '#f3e8ff', bg: '#ffffff', text: '#0f172a' };
  }
  // minimal / default
  return { primary: '#0f172a', secondary: '#475569', accent: '#2563eb', muted: '#e5e7eb', bg: '#ffffff', text: '#0f172a' };
}

export function applyCustomization(
  base: TemplatePalette,
  customization?: DesignCustomizationLike | null,
): TemplatePalette {
  if (!customization?.color_scheme) return base;
  const c = customization.color_scheme;
  return {
    ...base,
    primary: c.primary || base.primary,
    secondary: c.secondary || base.secondary,
    accent: c.accent || base.accent,
    bg: c.background || base.bg,
    text: c.text || base.text,
  };
}

// ---------------------------------------------------------------------------
// Hebrew / RTL detection (mirrors render-preview-html.ts)
// ---------------------------------------------------------------------------

function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

export function detectRTL(resume: OptimizedResume): boolean {
  const fields = [
    resume.contact?.name || '',
    resume.summary || '',
    resume.skills?.technical?.join(' ') || '',
    resume.experience?.[0]?.title || '',
    resume.experience?.[0]?.company || '',
  ];
  return fields.some(containsHebrew);
}

// ---------------------------------------------------------------------------
// Shared Props for all PDF templates
// ---------------------------------------------------------------------------

export interface PdfTemplateProps {
  resume: OptimizedResume;
  palette: TemplatePalette;
  isRTL?: boolean;
}

// ---------------------------------------------------------------------------
// Template Registry
// ---------------------------------------------------------------------------

// Lazy imports to keep the bundle small when a particular template isn't used.
import { MinimalPdfTemplate } from './minimal-pdf';
import { CardPdfTemplate } from './card-pdf';
import { SidebarPdfTemplate } from './sidebar-pdf';
import { TimelinePdfTemplate } from './timeline-pdf';

const templateRegistry: Record<string, React.FC<PdfTemplateProps>> = {
  'minimal-ssr': MinimalPdfTemplate,
  'card-ssr': CardPdfTemplate,
  'sidebar-ssr': SidebarPdfTemplate,
  'timeline-ssr': TimelinePdfTemplate,
};

/**
 * Look up a styled React-PDF template component by slug.
 * Returns `null` when no styled template exists (caller should fall back to
 * the plain ResumePDF component).
 */
export function getPdfTemplate(slug: string): React.FC<PdfTemplateProps> | null {
  return templateRegistry[slug] ?? null;
}
