# Hebrew Localization Implementation Plan (Revised)

## Goals and Non-Regression Constraints
- Add Hebrew locale at `/he` while preserving current English routes and behavior.
- Avoid breaking auth, dashboards, templates, or AI features.
- Support mixed Hebrew/English resume content and correct bidi rendering.

## Key Corrections and Challenges
- **Middleware conflict:** existing auth middleware lives in `middleware.ts.disabled`; next-intl middleware must be merged with it, not replaced.
- **Tailwind RTL plugin risk:** the repo uses Tailwind v4; avoid `tailwindcss-rtl` until compatibility is proven. Use logical CSS and selective `dir`-based overrides instead.
- **Existing i18n already present:** `src/lib/i18n/section-headers.ts` contains Hebrew (currently mojibake). Fix and reuse those translations instead of duplicating.
- **API error localization:** translate errors in the UI using error codes; only translate server-side when locale is reliable.
- **Templates + preview HTML:** `src/lib/design-manager/render-preview-html.ts` already detects Hebrew; extend it with `lang`/`dir` and bidi-safe CSS.

---

## Implementation Plan

### Phase 0: Decisions and Inventory (No Code Changes)
- Confirm routing approach: `[locale]` with `localePrefix: 'as-needed'` to keep English at `/` and Hebrew at `/he`.
- Inventory all user-facing strings and identify shared layout components.
- Decide how locale is stored: URL-only, profile field, or both (URL as source of truth).

### Phase 1: i18n Infrastructure (No UX Change)
- Install `next-intl`.
- Add `src/i18n.ts` with message loading by locale.
- Add `src/messages/en.json` and `src/messages/he.json`.
- Add `src/locales.ts` and `src/navigation.ts` using next-intl helpers.
- Update `next.config.ts` to enable the next-intl plugin.

### Phase 2: Routing and Layout (Preserve English)
- Move routes into `src/app/[locale]/` (pages, layouts, error/not-found).
- Create `src/app/[locale]/layout.tsx` with locale-aware `lang` and `dir`.
- Update metadata generation and `src/app/sitemap.ts` to include `/he` URLs and alternates.
- Replace `middleware.ts.disabled` with a merged `src/middleware.ts` that includes:
  - next-intl locale routing
  - existing Supabase auth redirect logic

### Phase 3: UI Translation and RTL Adjustments
- Start with `src/components/layout/header.tsx` and `src/components/layout/footer.tsx`.
- Replace static strings with `useTranslations` keys.
- Add a `LanguageSwitcher` using next-intl navigation helpers (keeps query + locale).
- Bidi handling:
  - `dir="auto"` on user input fields
  - `unicode-bidi: plaintext` on resume text
  - `dir="ltr"` for email/phone URLs
- Use logical CSS properties in `src/app/globals.css` and component styles. Avoid global `.text-left` flips.

### Phase 4: Templates and Mixed Language
- Fix Hebrew strings in `src/lib/i18n/section-headers.ts` (valid UTF-8).
- Update `src/lib/design-manager/render-preview-html.ts`:
  - set `<html lang>` and `dir` from content detection
  - add bidi-safe CSS for paragraphs and lists
- Review `src/lib/templates/external/*` and apply the same direction strategy.

### Phase 5: AI and Data
- Add `locale` parameter to AI entry points (optimizer, quick wins, chat).
- Create Hebrew prompt files with native Hebrew (not translated output).
- Optional: add `profiles.language` migration + types; default to URL locale if unset.

### Phase 6: QA and Rollout
- Add a translation coverage check (missing keys script).
- Manual RTL checklist for all key flows.
- Smoke test `/`, `/he`, `/dashboard`, `/he/dashboard`.

---

## Key Files (Revised)
- `src/middleware.ts` (merged auth + next-intl)
- `src/app/[locale]/layout.tsx`
- `src/i18n.ts`
- `src/locales.ts`
- `src/navigation.ts`
- `src/messages/en.json`
- `src/messages/he.json`
- `src/app/sitemap.ts`
- `src/lib/i18n/section-headers.ts`
- `src/lib/design-manager/render-preview-html.ts`
- `src/components/layout/header.tsx`
- `src/components/layout/footer.tsx`
- `src/components/LanguageSwitcher.tsx`

---

## Success Criteria
- English routes unchanged; Hebrew at `/he` works.
- No auth regressions (middleware merged correctly).
- RTL and mixed language rendering correct in templates and previews.
- AI responses are native Hebrew when locale is `he`.
- Translation coverage >= 95% for user-facing strings.
