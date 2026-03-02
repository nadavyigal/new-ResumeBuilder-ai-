# Prompt for Claude Web App

## Context
I'm building a Next.js resume optimization app. I've successfully synced external resume templates from a template library, but they're not being used when users download PDFs. The PDFs are using a basic fallback renderer instead of the styled templates.

## Current Architecture

### Template System
- **Synced Templates**: minimal-ssr, card-ssr, sidebar-ssr, timeline-ssr
- **Location**: `src/lib/templates/external/`
- **Format**: React JSX components
- **Registry**: Dynamic imports in `src/lib/templates/external/index.ts`
- **Status**: ✅ Working correctly

### PDF Generation Flow
```typescript
// File: src/app/api/download/[id]/route.ts
export async function GET(req: NextRequest, { params }) {
  const { id } = await params;
  const pdfResult = await generatePdfWithDesign(resumeData, id);
  return new NextResponse(pdfResult.buffer, { headers });
}

// File: src/lib/export.ts
export async function generatePdfWithDesign(
  resumeData: OptimizedResume,
  optimizationId: string
): Promise<PdfWithDesignResult> {
  // 1. Check for design assignment
  const assignment = await getDesignAssignment(supabase, optimizationId, user.id);

  if (!assignment) {
    // ❌ NO ASSIGNMENT - Falls back to React-PDF
    const buffer = await generatePdfFromReact(cleanedData);
    return { buffer, renderer: "react-pdf", templateSlug: null, usedDesignAssignment: false };
  }

  // ✅ HAS ASSIGNMENT - Uses template
  const html = renderDesignPreviewHtml({ templateId, resumeData, customization });
  const buffer = await generatePdfFromHtml(html); // Puppeteer
  return { buffer, renderer: "html", templateSlug, usedDesignAssignment: true };
}
```

### Database Schema
```sql
-- Exists
CREATE TABLE design_templates (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'traditional', 'modern', 'corporate', 'creative'
  file_path TEXT, -- e.g., 'external/minimal-ssr'
  is_premium BOOLEAN DEFAULT FALSE,
  ats_compatibility_score INTEGER,
  preview_thumbnail_url TEXT,
  supported_customizations JSONB,
  default_config JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Exists
CREATE TABLE resume_designs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  optimization_id UUID NOT NULL REFERENCES optimizations(id),
  template_id UUID NOT NULL REFERENCES design_templates(id),
  customization_id UUID REFERENCES design_customizations(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(optimization_id) -- One design per optimization
);

-- Exists
CREATE TABLE design_customizations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  template_id UUID NOT NULL REFERENCES design_templates(id),
  color_scheme JSONB,
  font_family JSONB,
  spacing JSONB,
  custom_css TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## The Problem

**Symptoms:**
1. Templates are synced to filesystem ✅
2. Template browser shows templates in UI ✅
3. User downloads PDF ❌ → Gets basic React-PDF output
4. PDF should use selected template ❌ → Falls back because no design assignment exists

**Root Causes:**
1. ❌ `design_templates` table is empty (no rows for synced templates)
2. ❌ `resume_designs` table has no assignments (users haven't selected templates)
3. ❌ No workflow to create assignments when user selects a template
4. ❌ Template selection UI might not save selections to database

## What I Need Help With

### Task 1: Seed Database with Synced Templates
Create a migration or script to populate `design_templates` with entries for the synced templates:

**Requirements:**
- Insert rows for: minimal-ssr, card-ssr, sidebar-ssr, timeline-ssr
- Set appropriate metadata (name, description, category, ATS score)
- Match `file_path` to the filesystem location: `external/{template-slug}`
- Set sensible default configurations for each template

### Task 2: Fix Template Selection Workflow
Ensure that when users click "Apply" on a template in the Design Browser, it creates a record in `resume_designs`:

**Current UI Flow:**
```typescript
// File: src/components/design/TemplateCard.tsx
<button onClick={() => {
  onSelect(); // Probably just closes modal
  setShowPreview(false);
}}>
  Apply This Template
</button>

// Parent: DesignBrowser.tsx
const handleTemplateSelect = (templateId: string) => {
  onTemplateSelect(templateId); // What does this do?
};
```

**What Should Happen:**
1. User clicks "Apply This Template"
2. POST to `/api/v1/design/{optimizationId}` with `{ templateId }`
3. Backend creates/updates `resume_designs` record
4. UI shows confirmation "Template applied"
5. Next PDF download uses that template

### Task 3: Provide Fallback for Non-Selected Templates
If user hasn't selected a template yet, PDF should still use a nice default instead of plain React-PDF:

**Options:**
A. Always use `minimal-ssr` as default if no assignment
B. Create a default assignment on first optimization
C. Show template selector before allowing PDF download

### Task 4: Verify End-to-End Flow
Help me test that:
1. Template shows in browser ✅
2. User clicks "Apply" → Creates database record ✅
3. User clicks "Download" → PDF uses that template ✅
4. PDF looks like the template preview ✅

## Codebase Structure

```
src/
├── app/
│   └── api/
│       ├── download/[id]/route.ts        # PDF download endpoint
│       └── v1/design/
│           ├── [optimizationId]/route.ts # Template assignment API
│           └── templates/
│               ├── route.ts              # List templates
│               └── [id]/preview/route.ts # Template preview
├── components/
│   └── design/
│       ├── DesignBrowser.tsx             # Template selection modal
│       └── TemplateCard.tsx              # Individual template card
├── lib/
│   ├── export.ts                         # PDF generation logic
│   ├── design-manager/
│   │   ├── render-preview-html.ts        # Renders template to HTML
│   │   └── template-renderer.ts          # SSR template rendering
│   ├── templates/external/
│   │   ├── index.ts                      # Template registry
│   │   ├── minimal-ssr/Resume.jsx
│   │   ├── card-ssr/Resume.jsx
│   │   ├── sidebar-ssr/Resume.jsx
│   │   └── timeline-ssr/Resume.jsx
│   └── supabase/
│       ├── design-templates.ts           # Template DB queries
│       └── resume-designs.ts             # Assignment DB queries
└── supabase/migrations/
    └── 20251008_add_design_tables.sql    # Schema definition
```

## Specific Questions

1. **Database Seeding**: Should I create a migration or a seed script to populate `design_templates`?

2. **Template Assignment API**: Does `/api/v1/design/[optimizationId]/route.ts` exist and handle POST to create assignments?

3. **Default Template**: What's the best UX - force selection, auto-assign default, or fallback gracefully?

4. **Puppeteer in Production**: The HTML → PDF conversion uses Puppeteer. Is this working in Vercel/production, or should I use an alternative?

5. **Template Metadata**: What should the default configurations look like for each template?

## Expected Output

Please provide:

1. **SQL Migration** to seed `design_templates` table with the 4 synced templates
2. **API Route Code** to handle template assignment (POST /api/v1/design/{optimizationId})
3. **Updated UI Code** for TemplateCard to call the assignment API
4. **Testing Script** to verify the end-to-end flow works
5. **Recommendations** for improving the template selection UX

## Additional Context

- Using Next.js 15, Supabase for backend
- Templates are React components using JSON Resume format
- PDF generation has 3 fallbacks: Puppeteer → React-PDF → jsPDF
- User's current PDF shows the React-PDF fallback (basic but functional)
- Goal: Show styled, branded PDFs using the synced templates

---

Thank you! This is a critical feature for the resume builder app.
