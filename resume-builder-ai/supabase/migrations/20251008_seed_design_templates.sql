-- Seed Data: Initial Design Templates
-- Feature: 003-i-want-to (AI-Powered Resume Design Selection)
-- Date: 2025-10-08
-- Reference: specs/003-i-want-to/data-model.md (Seed Data section)

-- ============================================================================
-- Insert 4 Initial Templates from resume-style-bank
-- ============================================================================

INSERT INTO design_templates (
  name,
  slug,
  category,
  description,
  file_path,
  ats_compatibility_score,
  is_premium,
  supported_customizations,
  default_config
) VALUES
(
  'Minimal Modern',
  'minimal-ssr',
  'traditional',
  'Clean, text-focused layout. Best for conservative industries like finance, law, and government.',
  'minimal-ssr/Resume.jsx',
  100,
  false,
  '{
    "colors": true,
    "fonts": true,
    "layout": true
  }'::jsonb,
  '{
    "color_scheme": {
      "primary": "#111827",
      "secondary": "#6b7280",
      "accent": "#3b82f6"
    },
    "font_family": {
      "headings": "Arial",
      "body": "Arial"
    },
    "spacing_settings": {
      "compact": false,
      "lineHeight": 1.5
    }
  }'::jsonb
),
(
  'Card Layout',
  'card-ssr',
  'modern',
  'Modern card-based sections. Best for tech, creative, and visual-heavy roles.',
  'card-ssr/Resume.jsx',
  95,
  false,
  '{
    "colors": true,
    "fonts": true,
    "layout": true
  }'::jsonb,
  '{
    "color_scheme": {
      "primary": "#2563eb",
      "secondary": "#64748b",
      "accent": "#0ea5e9"
    },
    "font_family": {
      "headings": "Arial",
      "body": "Arial"
    },
    "spacing_settings": {
      "compact": false,
      "lineHeight": 1.5
    }
  }'::jsonb
),
(
  'Sidebar Professional',
  'sidebar-ssr',
  'corporate',
  'Sidebar for contact and skills. Best for experienced professionals with dense content.',
  'sidebar-ssr/Resume.jsx',
  90,
  false,
  '{
    "colors": true,
    "fonts": true,
    "layout": true
  }'::jsonb,
  '{
    "color_scheme": {
      "primary": "#1e40af",
      "secondary": "#475569",
      "accent": "#06b6d4"
    },
    "font_family": {
      "headings": "Arial",
      "body": "Arial"
    },
    "spacing_settings": {
      "compact": true,
      "lineHeight": 1.4
    }
  }'::jsonb
),
(
  'Timeline',
  'timeline-ssr',
  'creative',
  'Chronological timeline emphasis. Best for career progressors, educators, and consultants.',
  'timeline-ssr/Resume.jsx',
  85,
  false,
  '{
    "colors": true,
    "fonts": true,
    "layout": true
  }'::jsonb,
  '{
    "color_scheme": {
      "primary": "#7c3aed",
      "secondary": "#64748b",
      "accent": "#a78bfa"
    },
    "font_family": {
      "headings": "Arial",
      "body": "Arial"
    },
    "spacing_settings": {
      "compact": false,
      "lineHeight": 1.6
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  file_path = EXCLUDED.file_path,
  ats_compatibility_score = EXCLUDED.ats_compatibility_score,
  is_premium = EXCLUDED.is_premium,
  supported_customizations = EXCLUDED.supported_customizations,
  default_config = EXCLUDED.default_config,
  updated_at = NOW();

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify templates were inserted
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM design_templates;

  IF template_count < 4 THEN
    RAISE EXCEPTION 'Seed data failed: Expected 4 templates, found %', template_count;
  END IF;

  RAISE NOTICE 'Seed data complete: % design templates inserted', template_count;
END $$;
