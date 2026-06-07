# Resumely Plan 2: Web ATS Tool — Dedicated SEO Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone `/ats-checker` page (and `/he/ats-checker` for Hebrew) that targets "ATS resume checker free" search intent and drives App Store installs. The free checker already exists on the homepage — this plan surfaces it at a dedicated, SEO-optimised URL and adds App Store attribution CTAs.

**Architecture:** New page file at `src/app/[locale]/ats-checker/page.tsx` that renders the existing `FreeATSChecker` component. Adds targeted `<Metadata>` for SEO. Adds a visible App Store deep-link section. No new API routes. No changes to `FreeATSChecker` component or the `/api/public/ats-check` route.

Key insight: `src/locales.ts` already declares `['en', 'he']`. The `[locale]` route prefix handles `/he/ats-checker` automatically. Hebrew translations at `src/messages/he.json` already exist (1679 lines matching English).

**Tech Stack:** Next.js 14 App Router, next-intl (already installed), Tailwind CSS

**Status gate:** Build sprint post-App Store approval (Week 2–3).

---

## File Structure

| File | Action | Contents |
|---|---|---|
| `src/app/[locale]/ats-checker/page.tsx` | Create | Standalone ATS checker page with SEO metadata + App Store CTA |
| `src/messages/en.json` | Modify | Add `atsCheckerPage` namespace keys |
| `src/messages/he.json` | Modify | Add Hebrew translations for `atsCheckerPage` namespace |

No other files change.

---

### Task 1: Add Translation Keys

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/he.json`

- [ ] **Step 1: Identify where to insert in `en.json`**

Open `src/messages/en.json`. Find the last key in the file. Insert `atsCheckerPage` as a new top-level key.

- [ ] **Step 2: Add English translations**

In `src/messages/en.json`, add before the closing `}`:

```json
  "atsCheckerPage": {
    "meta": {
      "title": "Free ATS Resume Checker — See If Your Resume Passes",
      "description": "Paste your resume and job description. Get an instant ATS score and the top keyword gaps. Free, no sign-up required."
    },
    "appStoreCta": {
      "heading": "Fix your resume in the Resumely app",
      "subheading": "AI rewrites your resume to match the job description. Export a tailored PDF in 5 minutes.",
      "button": "Download Resumely — Free",
      "orText": "or"
    }
  }
```

- [ ] **Step 3: Add Hebrew translations**

In `src/messages/he.json`, add the same key with Hebrew values:

```json
  "atsCheckerPage": {
    "meta": {
      "title": "בדיקת קורות חיים ATS חינם — האם קורות החיים שלך עוברים סינון?",
      "description": "הדבק את קורות החיים ותיאור המשרה. קבל ציון ATS מיידי ואת פערי מילות המפתח. חינם, ללא הרשמה."
    },
    "appStoreCta": {
      "heading": "תקן את קורות החיים שלך באפליקציית Resumely",
      "subheading": "AI מעדכן את קורות החיים שלך להתאמה למשרה. ייצא PDF מותאם תוך 5 דקות.",
      "button": "הורד Resumely — חינם",
      "orText": "או"
    }
  }
```

- [ ] **Step 4: Verify JSON is valid**

```bash
cd "/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-"
node -e "JSON.parse(require('fs').readFileSync('src/messages/en.json','utf8')); console.log('en.json: valid')"
node -e "JSON.parse(require('fs').readFileSync('src/messages/he.json','utf8')); console.log('he.json: valid')"
```

Expected:
```
en.json: valid
he.json: valid
```

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json src/messages/he.json
git commit -m "feat: add atsCheckerPage translation keys (en + he)"
```

---

### Task 2: Create the Standalone ATS Checker Page

**Files:**
- Create: `src/app/[locale]/ats-checker/page.tsx`

- [ ] **Step 1: Write the page file**

```typescript
// src/app/[locale]/ats-checker/page.tsx
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FreeATSChecker } from '@/components/landing/FreeATSChecker';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

interface AtsCheckerPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AtsCheckerPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'atsCheckerPage.meta' });
  const baseUrl = 'https://resumelybuilderai.com';
  const pageUrl = locale === 'en'
    ? `${baseUrl}/ats-checker`
    : `${baseUrl}/${locale}/ats-checker`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: pageUrl,
      languages: {
        'en': `${baseUrl}/ats-checker`,
        'he': `${baseUrl}/he/ats-checker`,
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: pageUrl,
      type: 'website',
    },
  };
}

export default async function AtsCheckerPage({ params }: AtsCheckerPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'atsCheckerPage.appStoreCta' });

  const APP_STORE_URL =
    'https://apps.apple.com/app/resumely/id000000000?ct=web-ats&at=organic';
  // Replace id000000000 with actual App Store ID when live.

  return (
    <>
      <Header />
      <main>
        <FreeATSChecker />

        {/* App Store attribution CTA — shown below the checker */}
        <section className="py-12 bg-muted/30 border-t border-border">
          <div className="container px-4 mx-auto text-center max-w-xl">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t('heading')}
            </h2>
            <p className="text-foreground/70 mb-6">
              {t('subheading')}
            </p>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-mobile-cta text-white font-semibold text-base hover:bg-mobile-cta/90 transition-colors"
            >
              {t('button')}
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
```

**Note on APP_STORE_URL:** Replace `id000000000` with the real App Store numeric ID when the app is live. The `?ct=web-ats&at=organic` attribution parameters tell Apple's analytics this install came from the web ATS tool.

- [ ] **Step 2: Run TypeScript check**

```bash
cd "/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ats-checker/page.tsx`.

- [ ] **Step 3: Verify the page builds**

```bash
npx next build 2>&1 | grep -E "(Error|Warning|ats-checker)" | head -20
```

Expected: `ats-checker` appears in the route manifest, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/ats-checker/page.tsx
git commit -m "feat: add standalone /ats-checker SEO page with App Store CTA"
```

---

### Task 3: Verify Hebrew Route Works

The `[locale]` router already handles `/he/ats-checker` — this task confirms it.

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-"
npm run dev
```

- [ ] **Step 2: Check English route**

Open `http://localhost:3000/en/ats-checker` in browser.

Verify:
- Page loads without 404
- `FreeATSChecker` component renders (upload form visible)
- App Store CTA section visible below the checker
- Page title shows "Free ATS Resume Checker — See If Your Resume Passes"

- [ ] **Step 3: Check Hebrew route**

Open `http://localhost:3000/he/ats-checker` in browser.

Verify:
- Page loads without 404
- `FreeATSChecker` component renders
- App Store CTA section shows Hebrew text
- Page title shows "בדיקת קורות חיים ATS חינם — האם קורות החיים שלך עוברים סינון?"
- Page direction: the body should be RTL for Hebrew locale (if the app has `dir="rtl"` on the HTML element for `he`)

- [ ] **Step 4: Check canonical URL in page source**

```bash
curl -s "http://localhost:3000/en/ats-checker" | grep -i "canonical"
```

Expected output should include:
```html
<link rel="canonical" href="https://resumelybuilderai.com/ats-checker"/>
```

- [ ] **Step 5: Commit any fixes found during verification**

```bash
git add -p
git commit -m "fix: ats-checker page locale/canonical adjustments"
```

---

### Task 4: Update App Store URL When Live

This task is blocked until the App Store listing is live and you have the numeric App Store ID.

- [ ] **Step 1: Get the App Store ID**

The App Store ID is the number in the URL:
`https://apps.apple.com/app/resumely/id123456789`
The ID is `123456789`.

- [ ] **Step 2: Update the URL constant**

In `src/app/[locale]/ats-checker/page.tsx`, find:

```typescript
const APP_STORE_URL =
    'https://apps.apple.com/app/resumely/id000000000?ct=web-ats&at=organic';
```

Replace `id000000000` with the real ID, e.g.:

```typescript
const APP_STORE_URL =
    'https://apps.apple.com/app/resumely/id6447123456?ct=web-ats&at=organic';
```

- [ ] **Step 3: Commit and deploy**

```bash
git add src/app/[locale]/ats-checker/page.tsx
git commit -m "fix: update App Store URL with real app ID for web-ats attribution"
```

---

## Self-Review: Spec Coverage Check

Spec Section 4, Engine 2 requires:
- [x] URL `resumelybuilderai.com/ats-checker` — Task 2 creates the route
- [x] No sign-in required — FreeATSChecker already handles this (public API)
- [x] Resume paste + ATS score — FreeATSChecker component does this
- [x] "Fix it in Resumely" → App Store link (mobile-detect) — App Store CTA in Task 2
- [x] Attribution `?ct=web-ats&at=organic` — included in APP_STORE_URL
- [x] Hebrew version at `/he/ats-checker` — handled by `[locale]` routing + Hebrew translations in Task 1
- [ ] Auto-detect mobile for App Store link — the current CTA always shows. A nice-to-have: on mobile, deep-link directly to App Store; on desktop, show QR code. Not in this plan — scope gate.

Spec Section 7, Hebrew Phase 1:
- [x] `/he/ats-checker` Hebrew UI — Task 1 + Task 3

No placeholders in code steps. All TypeScript is complete. The `APP_STORE_URL` placeholder is intentional and documented.
