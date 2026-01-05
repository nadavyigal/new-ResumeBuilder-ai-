-- Migration: Seed design templates for external SSR templates
-- Date: 2025-12-25
-- Purpose: Populate design_templates with synced external templates (idempotent).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO design_templates (
  slug,
  name,
  description,
  category,
  file_path,
  is_premium,
  ats_compatibility_score,
  supported_customizations,
  default_config
)
VALUES
  (
    'minimal-ssr',
    'Minimal Serif',
    'A clean, classic serif layout optimized for ATS readability.',
    'traditional',
    'external/minimal-ssr',
    false,
    98,
    '{"colors": true, "fonts": true, "layout": true}'::jsonb,
    '{
      "color_scheme": {
        "primary": "#111827",
        "secondary": "#6b7280",
        "accent": "#2563eb",
        "background": "#ffffff",
        "text": "#0f172a"
      },
      "font_family": {
        "heading": "Georgia, serif",
        "body": "Georgia, serif"
      },
      "spacing_settings": {
        "compact": false,
        "lineHeight": 1.6
      }
    }'::jsonb
  ),
  (
    'card-ssr',
    'Card Modern',
    'A bold, card-based layout with strong visual hierarchy.',
    'modern',
    'external/card-ssr',
    false,
    92,
    '{"colors": true, "fonts": true, "layout": true}'::jsonb,
    '{
      "color_scheme": {
        "primary": "#2563eb",
        "secondary": "#64748b",
        "accent": "#0ea5e9",
        "background": "#ffffff",
        "text": "#0f172a"
      },
      "font_family": {
        "heading": "Inter, system-ui, sans-serif",
        "body": "Inter, system-ui, sans-serif"
      },
      "spacing_settings": {
        "compact": false,
        "lineHeight": 1.5
      }
    }'::jsonb
  ),
  (
    'sidebar-ssr',
    'Sidebar Executive',
    'A structured, two-column executive layout with a strong sidebar.',
    'corporate',
    'external/sidebar-ssr',
    false,
    94,
    '{"colors": true, "fonts": true, "layout": true}'::jsonb,
    '{
      "color_scheme": {
        "primary": "#0f172a",
        "secondary": "#334155",
        "accent": "#10b981",
        "background": "#ffffff",
        "text": "#0f172a"
      },
      "font_family": {
        "heading": "Roboto, system-ui, sans-serif",
        "body": "Roboto, system-ui, sans-serif"
      },
      "spacing_settings": {
        "compact": true,
        "lineHeight": 1.55
      }
    }'::jsonb
  ),
  (
    'timeline-ssr',
    'Timeline Flow',
    'A creative timeline layout for showcasing career progression.',
    'creative',
    'external/timeline-ssr',
    false,
    88,
    '{"colors": true, "fonts": true, "layout": true}'::jsonb,
    '{
      "color_scheme": {
        "primary": "#7c3aed",
        "secondary": "#6b7280",
        "accent": "#f59e0b",
        "background": "#ffffff",
        "text": "#0f172a"
      },
      "font_family": {
        "heading": "Poppins, system-ui, sans-serif",
        "body": "Poppins, system-ui, sans-serif"
      },
      "spacing_settings": {
        "compact": false,
        "lineHeight": 1.6
      }
    }'::jsonb
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  file_path = EXCLUDED.file_path,
  is_premium = EXCLUDED.is_premium,
  ats_compatibility_score = EXCLUDED.ats_compatibility_score,
  supported_customizations = EXCLUDED.supported_customizations,
  default_config = EXCLUDED.default_config,
  updated_at = NOW();
