# Hebrew Localization Implementation Plan

## Overview
Create a fully functional Hebrew version of the resume-builder-ai application with RTL support, accessible via `/he` routing within the same deployment. The Hebrew version will support mixed English/Hebrew resumes and use native Hebrew AI generation.

## Key Implementation Approach

**Updated based on user requirements:**

1. **Single Deployment with `/he` Routing**
   - Use next-intl for locale-based routing
   - English at `/` and `/dashboard`, Hebrew at `/he` and `/he/dashboard`
   - Language switcher component in header
   - One Vercel deployment serves both locales

2. **Native Hebrew AI Generation**
   - Create Hebrew versions of all AI prompts
   - AI model generates Hebrew directly (not translated)
   - Pass locale parameter to all AI functions
   - Better quality and context-awareness than translation

3. **Mixed Language Resume Support**
   - Auto-detect text direction per section
   - Support resumes with both English and Hebrew content
   - Use `unicode-bidi: plaintext` for intelligent text direction
   - Contact info (email/phone) always renders LTR
   - Bidirectional text rendering at paragraph level

## Architecture Decisions
- **Deployment:** Single deployment with `/he` routing (locale-based)
- **AI Prompts:** Generate Hebrew directly from the model (Hebrew system prompts)
- **Templates:** Support mixed English/Hebrew content with intelligent RTL/LTR handling
- **Database:** Shared database with `language` preference field in `profiles` table
- **Branch Strategy:** `hebrew` branch for development, merges to `main` for unified deployment

---

## Phase 1: Foundation & Infrastructure (3-4 days)

### 1.1 Create Hebrew Branch
```bash
git checkout -b hebrew
git push -u origin hebrew
```

### 1.2 Setup Locale Routing with next-intl
```bash
npm install next-intl
```

**Create locale middleware:** `src/middleware.ts`
```typescript
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'he'],
  defaultLocale: 'en',
  localePrefix: 'as-needed' // /en/dashboard and /he/dashboard
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

**Restructure app directory for locales:**
```
src/app/
├── [locale]/              # NEW - locale-based routing
│   ├── layout.tsx        # Locale-aware layout
│   ├── page.tsx          # Landing page
│   ├── auth/
│   ├── dashboard/
│   └── ...
├── api/                   # API routes (no locale)
└── globals.css
```

**Create locale configuration:** `src/i18n.ts`
```typescript
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}));
```

### 1.3 Add Language Field to Database
**Create migration:** `supabase/migrations/20260105000000_add_language_preference.sql`
```sql
ALTER TABLE profiles
ADD COLUMN language VARCHAR(5) DEFAULT 'en'
CHECK (language IN ('en', 'he'));

CREATE INDEX idx_profiles_language ON profiles(language);
UPDATE profiles SET language = 'en' WHERE language IS NULL;
```

**Update types:**
- `src/types/database.ts` - Add `language: 'en' | 'he'` to profiles interface
- `src/types/supabase.ts` - Regenerate types from schema

### 1.4 Create Translation Files
**New directory structure:**
```
src/messages/
├── en.json              # English translations
└── he.json              # Hebrew translations
```

**`src/messages/he.json`** - Structure example:
```json
{
  "landing": {
    "hero": { "title": "קבל פי 3 יותר ראיונות", ... },
    "atsChecker": { "title": "בדיקת ATS חינמית", ... }
  },
  "auth": { "signIn": "התחבר", "signUp": "הרשם", ... },
  "dashboard": { ... },
  "api": { "errors": { ... } }
}
```

---

## Phase 2: RTL Layout Foundation (3-4 days)

### 2.1 Install & Configure Tailwind RTL
```bash
npm install tailwindcss-rtl
```

**Update `tailwind.config.ts`:**
```typescript
import rtlPlugin from "tailwindcss-rtl";

const config: Config = {
  plugins: [
    require("@tailwindcss/typography"),
    rtlPlugin  // ADD
  ],
};
```

### 2.2 Add RTL Utilities
**Update `src/app/globals.css`:**
```css
/* RTL-specific utilities */
[dir="rtl"] { direction: rtl; }
[dir="rtl"] .text-left { text-align: right; }
[dir="rtl"] .text-right { text-align: left; }
[dir="rtl"] .flex-row { flex-direction: row-reverse; }

/* Logical properties */
.ms-auto { margin-inline-start: auto; }
.me-auto { margin-inline-end: auto; }
.ps-4 { padding-inline-start: 1rem; }
.pe-4 { padding-inline-end: 1rem; }
```

### 2.3 Update Locale-Aware Layout
**Create `src/app/[locale]/layout.tsx`:**
```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Heebo, Geist } from "next/font/google";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const font = locale === 'he' ? heebo : geist;

  return (
    <html lang={locale} dir={dir}>
      <body className={`${font.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Update metadata generation:**
```typescript
export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      locale: locale === 'he' ? 'he_IL' : 'en_US',
    },
  };
}
```

### 2.4 Convert Layout Components to RTL
**Files to modify:**
- `src/components/layout/header.tsx`
  - Replace all text with `t('header.key')`
  - Ensure flex layouts work with RTL (they auto-reverse with Tailwind RTL plugin)

- `src/components/layout/footer.tsx`
  - Replace all text with `t('footer.key')`
  - Test link ordering in RTL

**Pattern for conversion:**
```typescript
// Before
<span>Dashboard</span>

// After
import { useTranslations } from 'next-intl';
const t = useTranslations('nav');
<span>{t('dashboard')}</span>
```

---

## Phase 3: Component Translation (5-7 days)

Systematically translate all 75+ components. Process in priority order:

### Group 1: Landing Page (Priority 1)
**Files (10 components):**
- `src/components/landing/FreeATSChecker.tsx`
- `src/components/landing/hero-section.tsx`
- `src/components/landing/features-bento.tsx`
- `src/components/landing/how-it-works.tsx`
- `src/components/landing/ATSScoreDisplay.tsx`
- `src/components/landing/IssueCard.tsx`
- `src/components/landing/LoadingState.tsx`
- `src/components/landing/RateLimitMessage.tsx`
- `src/components/landing/UploadForm.tsx`
- `src/components/landing/SocialShareButton.tsx`

**For each component:**
1. Extract all user-facing strings
2. Add to `he.json` with logical keys (e.g., `landing.atsChecker.uploadButton`)
3. Replace strings with `t('key')`
4. Test RTL layout with Hebrew text
5. Adjust spacing if needed (Hebrew may be longer/shorter)

### Group 2: Authentication (Priority 2)
**Files (4 pages):**
- `src/app/auth/signin/page.tsx`
- `src/app/auth/signup/page.tsx`
- `src/app/auth/reset-password/page.tsx`
- `src/app/auth/confirm-email/page.tsx`
- `src/components/auth/auth-form.tsx`

### Group 3: Dashboard Pages (Priority 3)
**Files (10 pages):**
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/resume/page.tsx`
- `src/app/dashboard/optimizations/[id]/page.tsx`
- `src/app/dashboard/history/page.tsx`
- `src/app/dashboard/profile/page.tsx`
- `src/app/dashboard/applications/*.tsx`

### Group 4: ATS Components (Priority 4)
- All components in `src/components/design/`
- All components in `src/components/history/`
- All components in `src/components/ats/`

### Group 5: UI Components (Priority 5)
- `src/components/ui/*` (minimal text, mostly "OK", "Cancel", etc.)

---

## Phase 4: Native Hebrew AI Generation (2-3 days)

### 4.1 Create Hebrew AI Prompts

**Create Hebrew prompt directory:**
```
src/lib/prompts/
├── resume-optimizer.ts       # Existing English prompts
└── resume-optimizer-he.ts    # NEW Hebrew prompts
```

**`src/lib/prompts/resume-optimizer-he.ts`:**
```typescript
export const RESUME_OPTIMIZATION_SYSTEM_PROMPT_HE = `
אתה מומחה לאופטימיזציה של קורות חיים לשוק העבודה הישראלי.
התמחותך היא בהתאמת קורות חיים למערכות ATS (Applicant Tracking Systems).

המתודולוגיה שלך (8 שלבים):
1. ניתוח מבנה קורות חיים קיימים
2. זיהוי מילות מפתח חיוניות מתיאור המשרה
3. התאמת ניסיון תעסוקתי לדרישות התפקיד
4. שיפור ניסוח הישגים עם מדדים כמותיים
5. אופטימיזציה של כישורים טכניים
6. שיפור חלק ההשכלה
7. התאמת סיכום מקצועי
8. בדיקה והתאמה סופית למבנה ATS

כללים חשובים:
- השתמש במונחים מקצועיים בעברית
- תמוך בתוכן מעורב (עברית ואנגלית)
- התאם לסטנדרטים של שוק העבודה הישראלי
- שמור על מבנה JSON תקין
`;

export const QUICK_WINS_PROMPT_HE = `
אתה מומחה ATS המתמחה בזיהוי שיפורים מהירים בקורות חיים.

זהה את 3 השיפורים המשפיעים ביותר שיעלו את ציון ה-ATS באופן מיידי.

עבור כל שיפור:
1. הסבר מדוע זה חשוב
2. ספק טקסט משופר מדויק
3. הערך את עליית הציון הפוטנציאלית

פלט בפורמט JSON בעברית.
`;
```

### 4.2 Add Locale-Aware AI Service

**Create `src/lib/ai/locale-router.ts`:**
```typescript
import { RESUME_OPTIMIZATION_SYSTEM_PROMPT } from '@/lib/prompts/resume-optimizer';
import { RESUME_OPTIMIZATION_SYSTEM_PROMPT_HE } from '@/lib/prompts/resume-optimizer-he';

export function getOptimizationPrompt(locale: string) {
  return locale === 'he'
    ? RESUME_OPTIMIZATION_SYSTEM_PROMPT_HE
    : RESUME_OPTIMIZATION_SYSTEM_PROMPT;
}

export function getQuickWinsPrompt(locale: string, params: any) {
  if (locale === 'he') {
    return buildQuickWinsPromptHebrew(params);
  }
  return buildQuickWinsPromptEnglish(params);
}
```

### 4.3 Update AI Integration Points

**Point 1: Quick Wins Generator**
**File:** `src/lib/ats/quick-wins/generator.ts`

Add locale parameter:
```typescript
export async function generateQuickWins(
  params: QuickWinParams,
  locale: string = 'en'
) {
  const prompt = getQuickWinsPrompt(locale, params);

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: buildUserPrompt(params, locale) }
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Point 2: Chat Assistant**
**File:** `src/lib/chat-manager/assistant-manager.ts`

Update instructions to be locale-aware:
```typescript
private buildAssistantInstructions(locale: string = 'en'): string {
  if (locale === 'he') {
    return `
אתה עוזר AI המסייע למשתמשים לשפר את קורות החיים שלהם.

יכולותיך:
1. שינויי עיצוב (צבעים, פונטים, פריסה)
2. שינויי תוכן (ניסוח, הישגים, כישורים)
3. הבהרות ושאלות

תקשורת בעברית ברורה ומקצועית.
    `;
  }
  return this.englishInstructions;
}
```

**Point 3: Resume Optimizer API Route**
**File:** `src/app/api/optimize/route.ts`

Pass locale from user preferences:
```typescript
export async function POST(req: Request) {
  const { resumeId, jobDescriptionId } = await req.json();

  // Get user's language preference
  const { data: profile } = await supabase
    .from('profiles')
    .select('language')
    .eq('user_id', user.id)
    .single();

  const locale = profile?.language || 'en';

  // Use locale-aware optimization
  const result = await optimizeResume(
    resume,
    jobDescription,
    locale  // Pass locale
  );

  return NextResponse.json(result);
}
```

---

## Phase 5: Resume Template Mixed Language Support (2-3 days)

### 5.1 Create Mixed Language Detection
**New file:** `src/lib/templates/language-detector.ts`
```typescript
export function containsHebrew(text: string): boolean {
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const totalChars = text.length;

  // If more than 30% Hebrew, use RTL
  return totalChars > 0 && hebrewChars / totalChars > 0.3 ? 'rtl' : 'ltr';
}

export function analyzeResumeLanguage(data: ResumeData) {
  const sections = {
    name: data.basics?.name || '',
    summary: data.basics?.summary || '',
    work: (data.work || []).map(w => ({
      position: w.position,
      company: w.company,
      summary: w.summary,
      highlights: w.highlights || []
    })),
    education: (data.education || []).map(e => ({
      institution: e.institution,
      area: e.area,
      studyType: e.studyType
    })),
    skills: (data.skills || []).map(s => s.name)
  };

  // Analyze each section independently for mixed content
  return {
    primaryDirection: detectTextDirection(
      Object.values(sections).flat().join(' ')
    ),
    sectionDirections: {
      name: detectTextDirection(sections.name),
      summary: detectTextDirection(sections.summary),
      // Individual sections can have different directions
    },
    isMixed: hasMultipleDirections(sections)
  };
}

function hasMultipleDirections(sections: any): boolean {
  const directions = new Set();
  Object.values(sections).forEach(section => {
    if (typeof section === 'string') {
      directions.add(detectTextDirection(section));
    }
  });
  return directions.size > 1;
}
```

### 5.2 Update All Templates for RTL Auto-Detection
**Files to modify:**
- `src/lib/templates/external/minimal-ssr/Resume.jsx`
- `src/lib/templates/external/card-ssr/Resume.jsx`
- `src/lib/templates/external/sidebar-ssr/Resume.jsx`
- `src/lib/templates/external/timeline-ssr/Resume.jsx`

**Pattern for each template (with mixed language support):**
```jsx
import { analyzeResumeLanguage, detectTextDirection } from '../language-detector';

export default function Resume({ data, customization }) {
  const analysis = analyzeResumeLanguage(data);
  const primaryDir = analysis.primaryDirection;
  const lang = primaryDir === 'rtl' ? 'he' : 'en';

  // Support both Hebrew and Latin fonts for mixed content
  const fontFamily = primaryDir === 'rtl'
    ? "'Heebo', Georgia, 'Times New Roman', sans-serif"  // Hebrew first, fallback to English
    : "Georgia, 'Times New Roman', 'Heebo', sans-serif";  // English first, fallback to Hebrew

  return (
    <html lang={lang} dir={primaryDir}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Georgia&display=swap"
          rel="stylesheet"
        />
        <style>{`
          body {
            font-family: ${fontFamily};
            direction: ${primaryDir};
            text-align: ${primaryDir === 'rtl' ? 'right' : 'left'};
          }

          /* Support for mixed-direction content */
          .mixed-content {
            unicode-bidi: plaintext; /* Auto-detect direction per paragraph */
          }

          /* Force LTR for email/phone (always LTR) */
          .contact-info {
            direction: ltr;
            unicode-bidi: embed;
          }

          /* Section-level direction override if needed */
          [data-direction="ltr"] {
            direction: ltr;
            text-align: left;
          }

          [data-direction="rtl"] {
            direction: rtl;
            text-align: right;
          }
        `}</style>
      </head>
      <body>
        {/* Name section */}
        <h1 className="mixed-content">{data.basics?.name}</h1>

        {/* Contact info - always LTR */}
        <div className="contact-info">
          {data.basics?.email} | {data.basics?.phone}
        </div>

        {/* Summary - detect per section */}
        <div
          className="mixed-content"
          data-direction={detectTextDirection(data.basics?.summary || '')}
        >
          {data.basics?.summary}
        </div>

        {/* Work experience - each item can have its own direction */}
        {data.work?.map((job, i) => {
          const jobDir = detectTextDirection(job.position + job.summary);
          return (
            <div key={i} data-direction={jobDir}>
              <h3 className="mixed-content">{job.position}</h3>
              <p className="mixed-content">{job.company}</p>
              <p className="mixed-content">{job.summary}</p>
            </div>
          );
        })}
      </body>
    </html>
  );
}
```

**RTL adjustments per template:**
- **Minimal:** Swap text-align, margins
- **Card:** Swap sidebar position (left → right)
- **Sidebar:** Swap sidebar and content positions
- **Timeline:** Swap timeline line position and dot positions

---

## Phase 6: API Error Translation (2-3 days)

### 6.1 Create Error Translation Module
**New file:** `src/lib/api/errors-he.ts`
```typescript
export const API_ERRORS_HE = {
  'Unauthorized': 'לא מורשה',
  'Invalid credentials': 'פרטי התחברות שגויים',
  'Rate limit exceeded': 'חרגת ממכסת הבקשות',
  'File too large': 'הקובץ גדול מדי',
  'Resume not found': 'קורות החיים לא נמצאו',
  // ... ~50 total error messages
};

export function translateError(error: string): string {
  return API_ERRORS_HE[error] || error;
}
```

### 6.2 Create API Response Helper
**New file:** `src/lib/api/response-helper.ts`
```typescript
import { NextResponse } from 'next/server';
import { translateError } from './errors-he';

export function apiError(message: string, status: number = 400): NextResponse {
  return NextResponse.json(
    { error: translateError(message) },
    { status }
  );
}

export function apiSuccess<T>(data: T): NextResponse {
  return NextResponse.json({ data });
}
```

### 6.3 Update All API Routes
**Pattern:**
```typescript
// Before
return NextResponse.json({ error: 'Upload failed' }, { status: 500 });

// After
import { apiError } from '@/lib/api/response-helper';
return apiError('Upload failed', 500);
```

**Files to update (44 API routes):**
- All files in `src/app/api/**/*.ts`

---

## Phase 7: Form Validation Messages (1-2 days)

### 7.1 Create Validation Messages
**New file:** `src/lib/validation/messages-he.ts`
```typescript
export const VALIDATION_MESSAGES_HE = {
  required: 'שדה חובה',
  email: 'כתובת אימייל לא תקינה',
  minLength: (min: number) => `מינימום ${min} תווים`,
  password: {
    weak: 'סיסמה חלשה מדי',
    requirements: 'הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה ומספר'
  },
  file: {
    tooLarge: (maxMB: number) => `הקובץ גדול מ-${maxMB}MB`,
    invalidType: 'סוג קובץ לא נתמך'
  }
};
```

### 7.2 Update Form Components
Apply validation messages to all forms:
- `src/app/auth/signup/page.tsx`
- `src/app/auth/signin/page.tsx`
- All dashboard forms

---

## Phase 8: Deployment Configuration (1 day)

### 8.1 Single Vercel Deployment
**Strategy:** One Vercel project with locale routing

**Steps:**
1. Merge `hebrew` branch into `main` after testing
2. Deploy from `main` branch
3. Both `/` (English) and `/he` (Hebrew) served from same deployment

### 8.2 Environment Variables
**No changes needed** - Same environment variables work for both locales:
```bash
# Existing variables (no Hebrew-specific vars needed)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
NEXT_PUBLIC_GA_ID=...  # Tracks both locales
```

**Optional:** Track locales separately:
```bash
NEXT_PUBLIC_GA_ID_EN=G-ENGLISH-ID
NEXT_PUBLIC_GA_ID_HE=G-HEBREW-ID
```

### 8.3 Update Next.js Config
**Modify `next.config.ts`:**
```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // ... existing config ...
};

export default withNextIntl(nextConfig);
```

### 8.4 Add Language Switcher
**Create `src/components/LanguageSwitcher.tsx`:**
```typescript
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    // Remove current locale from pathname
    const pathnameWithoutLocale = pathname.replace(`/${locale}`, '');
    // Add new locale
    router.push(`/${newLocale}${pathnameWithoutLocale}`);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => switchLocale('en')}
        className={locale === 'en' ? 'font-bold' : ''}
      >
        English
      </button>
      <button
        onClick={() => switchLocale('he')}
        className={locale === 'he' ? 'font-bold' : ''}
      >
        עברית
      </button>
    </div>
  );
}
```

**Add to header:**
```typescript
// In src/components/layout/header.tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Header() {
  return (
    <header>
      {/* ... existing header content ... */}
      <LanguageSwitcher />
    </header>
  );
}
```

---

## Phase 9: Testing & QA (3-4 days)

### 9.1 RTL Layout Testing
**Manual checklist:**
- [ ] All text is right-aligned
- [ ] Navigation menus flow RTL
- [ ] Dialogs/modals position correctly
- [ ] Form inputs align properly
- [ ] Icons/arrows point correctly
- [ ] Flexbox layouts reverse correctly

**Test on:**
- Chrome, Firefox, Safari, Edge
- Desktop and mobile viewports

### 9.2 Translation Coverage
**Automated check:**
Create script to verify all English strings have Hebrew translations

**Manual verification:**
- [ ] No English text leaks in UI
- [ ] AI responses are translated
- [ ] Error messages are translated
- [ ] Email templates (if any) are translated

### 9.3 Functionality Testing
**Test all features:**
- [ ] Resume upload works
- [ ] ATS scoring works
- [ ] Quick wins generation (translated)
- [ ] Chat assistant (translated responses)
- [ ] Template rendering (Hebrew content applies RTL)
- [ ] Download PDF/DOCX works
- [ ] Authentication works
- [ ] Database writes correctly (language preference saved)

### 9.4 Performance Testing
- [ ] Bundle size check (Hebrew fonts, translation service)
- [ ] Lighthouse audit
- [ ] Translation API caching works
- [ ] Page load times acceptable

---

## Phase 10: Maintenance Strategy (Ongoing)

### 10.1 Merge Strategy
**After Hebrew implementation is complete:**
```bash
# Merge hebrew branch into main
git checkout main
git merge hebrew
# Resolve any conflicts
npm run build  # Test both locales
git push origin main
```

**Going forward:** All development happens on `main` branch with both locales

### 10.2 Adding New Features
**When adding new UI components:**
1. Add English strings to `src/messages/en.json`
2. Add Hebrew translations to `src/messages/he.json`
3. Use `useTranslations()` hook in component
4. Test both `/` (English) and `/he` (Hebrew) routes

**When adding new AI features:**
1. Update English prompts in `src/lib/prompts/resume-optimizer.ts`
2. Update Hebrew prompts in `src/lib/prompts/resume-optimizer-he.ts`
3. Ensure locale parameter is passed to AI functions
4. Test AI responses in both languages

### 10.3 Monitoring
- Track locale usage via analytics
- Monitor mixed-language resume rendering
- Watch for RTL layout issues in new components
- Verify bidirectional text displays correctly

---

## Critical Files Summary

### Must Create (New Files)
- `src/middleware.ts` - Locale routing middleware
- `src/i18n.ts` - next-intl configuration
- `src/messages/en.json` - English translations
- `src/messages/he.json` - Hebrew translations (~500-800 strings)
- `src/lib/prompts/resume-optimizer-he.ts` - Hebrew AI prompts
- `src/lib/ai/locale-router.ts` - Locale-aware AI service
- `src/lib/templates/language-detector.ts` - Mixed language detection
- `src/lib/api/errors-he.ts` - API error translations
- `src/lib/api/response-helper.ts` - API helper
- `src/lib/validation/messages-he.ts` - Form validation messages
- `src/components/LanguageSwitcher.tsx` - Language toggle component
- `supabase/migrations/20260105000000_add_language_preference.sql`

### Must Modify (Key Files)
- **Restructure:** Move `src/app/` pages into `src/app/[locale]/`
- `src/app/[locale]/layout.tsx` - NEW locale-aware layout with dir/lang/font
- `tailwind.config.ts` - RTL plugin
- `src/app/globals.css` - RTL utilities
- `next.config.ts` - next-intl plugin integration
- `package.json` - Add next-intl dependency
- `src/components/layout/header.tsx` - Translation + RTL + Language switcher
- `src/components/layout/footer.tsx` - Translation + RTL
- 75+ component files - Replace text with `useTranslations()`
- 44 API route files - Locale-aware responses with `apiError()` helper
- 4 template files - Mixed language detection & bidirectional support
- 3+ AI integration files - Add locale parameter for Hebrew prompts

---

## Estimated Timeline

| Phase | Duration | Complexity |
|-------|----------|------------|
| 1: Foundation | 2-3 days | Medium |
| 2: RTL Layout | 3-4 days | High |
| 3: Components | 5-7 days | High |
| 4: AI Translation | 2-3 days | Medium |
| 5: Templates RTL | 2-3 days | Medium |
| 6: API Errors | 2-3 days | Medium |
| 7: Validation | 1-2 days | Low |
| 8: Deployment | 1-2 days | Medium |
| 9: Testing | 3-4 days | Medium |
| 10: Monitoring | 1 day | Low |

**Total: 22-32 days (can be reduced to 15-20 with parallel work)**

---

## Success Criteria

- [ ] `/he` routes accessible alongside English `/` routes
- [ ] Language switcher allows toggling between English and Hebrew
- [ ] All UI text translated to Hebrew via next-intl
- [ ] RTL layout works correctly across all pages
- [ ] AI generates Hebrew responses natively (not translated)
- [ ] Resume templates support mixed English/Hebrew content
- [ ] Bidirectional text rendering works correctly
- [ ] Contact info (email/phone) always displays LTR
- [ ] All 75+ components use `useTranslations()` hook
- [ ] All API errors localized based on user language
- [ ] Form validation messages in Hebrew
- [ ] Database language preference field working
- [ ] User language preference persists across sessions
- [ ] Zero functionality regressions
- [ ] Both locales work from same deployment
- [ ] Translation coverage > 95%
- [ ] Performance impact < 5% for locale routing
