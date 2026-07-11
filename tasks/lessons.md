# Lessons Learned — ResumeBuilder

> Read this before any triage session. Add a new lesson whenever a recurring bug is fixed.

---

## Jest 30 async mocks can infer `never` in contract tests

**Symptom:** `npx tsc --noEmit` reports `TS2345` because values passed to `mockResolvedValue` or `mockRejectedValue` are not assignable to `never`, even though Jest executes the test successfully.
**Root cause:** An untyped `jest.fn()` does not provide enough return-type context for Jest 30's resolved/rejected value helpers under this repo's TypeScript configuration.
**Fix:** Define the async implementation directly, for example `jest.fn(async () => value)` or `jest.fn(async () => { throw error; })`, so TypeScript infers the promise result from the function body. When matcher typing also needs argument types, use a typed rest tuple and `void args`; underscore-prefixed unused parameters still trigger this repo's ESLint rule.

---

## `status` is a read-only parameter in zsh

**Symptom:** A verification wrapper exits immediately with `zsh: read-only variable: status` before it can inspect the command result.
**Root cause:** zsh reserves `status` for the previous command's exit code.
**Fix:** Store exit codes in a neutral variable such as `exit_code` rather than assigning to `status`.

---

## ATS keyword extractor matched tech terms as substrings (fabricated skills → low scores)

**Symptom:** Non-technical roles (Business Development, Partnership Manager) scored ~34 even with a fully-scraped 6KB JD. `must_have` for a Fresha BD role came out as `["rust","express","api","Fresha\nAbout","Trusted"]`.
**Root cause:** `extractKeywords` in `src/lib/ats/utils/text-utils.ts` matched each technical term with `new RegExp(term, 'gi')` — no word boundaries. So `rust` matched inside "t**rust**ed", `api` inside "r**api**dly", `express` inside "**express**ing", `go` inside "Google". These fabricated skills never appear in the resume, collapsing `keyword_exact` (22%) and `keyword_phrase` (12%).
**Fix:** Wrap each term in alphanumeric lookarounds `(?<![A-Za-z0-9])(?:term)(?![A-Za-z0-9])` (not `\b` — several terms contain symbols like `c++`, `.net`, `ci/cd`, `rest api`). Also changed the capitalized-phrase pattern from `\s+` to `[ \t]+` so phrases don't span line breaks ("Fresha\nAbout").
**Note:** This was one of several compounding causes of low scores — see progress.md 2026-06-21. It is necessary but not sufficient on its own (lifts ~2 pts); the JD structured-requirement extraction and AI-optimizer metric quality are the larger remaining levers.

---

## LinkedIn JD section headings vary endlessly — classify by keyword, don't enumerate phrases

**Symptom:** A Fresha Business Development Manager posting (the same job behind the 34/100 score investigated above) had `parsed_data.requirements/qualifications/responsibilities` ALL null despite a full 6KB scrape with genuinely well-structured `<strong>heading</strong><ul><li>...` content.
**Root cause:** `extractFromLinkedIn` in `src/lib/scraper/jobExtractor.ts` matched section headings against a fixed list of literal phrases ("Responsibilities", "What you'll do", "Requirements", "Must have", "Qualifications"...). This posting used "What You Will Be Doing", "What We Are Looking For", and "Added bonus" — none of which matched, so every structured field silently came back null even though the content was present. Re-checking the existing `guest-fragment.html` fixture (Base44 job) showed the *same* gap was already latent there: its first `<ul>` (under heading "Job Description") was responsibilities content the old regex never caught either — only `qualifications` matched ("Qualifications" heading), which is why that test still passed (it only asserted `listCount > 0`, not which bucket).
**Fix:** Added a generic fallback (`extractClassifiedHeadingSections` + `classifyHeading`) that scans every `<strong>heading</strong><ul>...</ul>` block in the description and buckets it by keyword family (responsibilities / requirements / qualifications / nice_to_have / benefits) via regex on the heading text, rather than requiring an exact phrase. Only fills buckets the literal-phrase matching above left empty, so a recognized phrase still wins first. Also wired up `nice_to_have` (previously always hardcoded `null`).
**Verified:** Live-fetched the real Fresha LinkedIn guest fragment (job 4425913724) and confirmed responsibilities/requirements/nice_to_have populate correctly post-fix. Regression test added: `tests/unit/linkedin-job-extractor.test.ts` with new fixture `tests/fixtures/linkedin/guest-fragment-varied-headings.html`.
**Note:** This closes the dominant remaining lever from the 2026-06-21 multi-causal diagnosis — JD structured-requirement extraction. The scorer no longer needs to fall back to the noisy `extractKeywords` prose-keyword proxy for postings with well-formed but non-standard heading phrasing.

---

## Supabase 406: `.single()` on missing or multiple rows

**Mistake:** Using `.single()` on a query that can return zero or multiple rows.
**Fix:** Use `.maybeSingle()` when zero rows is valid. Only use `.single()` for primary key lookups with a guaranteed match.

---

## Stripe webhook: secret mismatch

**Mistake:** `STRIPE_WEBHOOK_SECRET` set to the Stripe API key instead of the webhook endpoint signing secret.
**Why it fails:** Stripe signs webhook payloads with the endpoint-specific secret, not the API key. A mismatch causes all webhook events to fail verification silently.
**Fix:** In Stripe Dashboard → Developers → Webhooks → click your endpoint → reveal the "Signing secret". That value (starts with `whsec_`) goes in `STRIPE_WEBHOOK_SECRET`.

---

## OpenAI timeout on long resumes

**Mistake:** AI route handler times out on long resumes because the default Vercel function timeout is too short.
**Fix:** Add `export const maxDuration = 60` to any route file that calls OpenAI. For streaming responses, use `streamText` from Vercel AI SDK.

---

## Wrong Supabase project in env

**Mistake:** `NEXT_PUBLIC_SUPABASE_URL` points at the wrong project (dev vs. prod).
**Fix:** Check the URL subdomain against Supabase Settings > API. They must match.

---

## Raw pdfjs-dist is a trap on Vercel serverless — use unpdf instead

**Symptom:** Server-side PDF parsing (e.g. `/api/public/ats-check`) returned a 500 with an empty body in production while working locally. Caught by the route's try/catch it became a 400 "We could not read your resume."

**Final fix: do NOT call `pdfjs-dist` directly. Use `unpdf`** (a serverless-first wrapper that bundles a pdfjs build with the DOM polyfills baked in). It's a normal ESM dependency webpack bundles — no externals, no worker config, no tracing hacks, no DOM globals:
```ts
import { extractText, getDocumentProxy } from 'unpdf';
const pdf = await getDocumentProxy(new Uint8Array(buffer));
const { totalPages, text } = await extractText(pdf, { mergePages: true });
```
Always wrap the call in try/catch returning a JSON 400 so a bad PDF can never surface as a blank 500. Refs: PR #72 + #73 (incomplete pdfjs fixes), PR #74 (unpdf — the real fix).

**The four layers we peeled before giving up on raw pdfjs — each a browser/Node env difference that was a false green locally:**
1. `require()` of `pdf.mjs` (ESM) → `ERR_REQUIRE_ESM` on Vercel's Node. Changing to `import()` wasn't enough because `config.externals` makes **webpack compile `import()` back into a `require()`**.
2. `webpackIgnore` native import fixed #1, but `require.resolve('…pdf.worker.mjs')` compiles to a numeric webpack module id → pdfjs "Invalid workerSrc type". Fix: don't set `workerSrc` (Node uses a main-thread fake worker).
3. A webpackIgnore'd import isn't auto-traced, so `pdf.mjs`/`pdf.worker.mjs` are missing from the function bundle unless force-included via `outputFileTracingIncludes`.
4. Once pdfjs finally loaded, it threw `ReferenceError: DOMMatrix is not defined` — Vercel's runtime takes a pdfjs code path needing the DOM global. **Not reproducible locally** (local pdfjs extracts text fine without DOMMatrix), so no local fix could be verified. This is why we switched to unpdf.

**Two reproduction techniques (a plain `next start` is NOT enough — local Node hides these):**
- ESM/require trap: `NODE_OPTIONS='--no-experimental-require-module' npm run start` makes local Node reject `require()` of ESM like Vercel's does.
- DOM-globals trap: in a node script, `delete globalThis.DOMMatrix; delete globalThis.Path2D; delete globalThis.ImageData;` before parsing, to simulate Vercel's environment. unpdf passes this; raw pdfjs's failing path does not.

---

## LinkedIn serves a degraded authwall to datacenter IPs — scrape the guest API, never /jobs/view

**Symptom:** URL-submitted LinkedIn jobs scored very low (~21/100) in production but looked fine when tested locally. The stored `job_descriptions` row had `clean_text`/`raw_text` of exactly ~222 chars and every `parsed_data` field null.

**Root cause:** `extractJob` fetched `https://www.linkedin.com/jobs/view/{id}`. From Vercel's serverless egress IP, LinkedIn returns a degraded authwall/`session_redirect` page that contains only the `og:description` meta tag (~222 chars) and NO `show-more-less-html` job body. `extractFromLinkedIn` parsed the meta snippet into `about_this_job` and returned a valid object **without throwing**, so the catch-fallbacks never fired and the thin data flowed straight to scoring. A residential IP (local dev / curl) gets the full page, so this is invisible locally — same class of false-green as the unpdf/DOMMatrix trap above.

**Fix:** Use LinkedIn's public guest endpoint `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{id}` — it returns the full posting body, works from datacenter IPs, and needs no User-Agent. The guest fragment differs from the full page: no `og:title`/`<title>` (title/company come from `topcard__title` / `topcard__org-name-link`), no `<p>` tags in the body (recover the whole `show-more-less-html__markup` as the body), and `<strong>Qualifications<br><br></strong>` headings (the `<br>` breaks any regex requiring the keyword immediately before `</strong>` — match `<strong[^>]*>\s*(Keyword)` instead). Ref: PR fix/linkedin-guest-scrape.

**Never let a scrape silently produce a score.** Added `isThinExtraction` + `ThinJobExtractionError` thrown centrally in `extractJob`; `/api/upload-resume` now prefers pasted text and otherwise returns `422 JOB_URL_UNREADABLE`. Optimizing against an empty JD is worse than telling the user to paste it.

**Reproduction caveat:** a real authwall only reproduces from a datacenter IP. Local curl/dev gets full content. Verify on a Vercel preview via the `?token=`-gated `/api/debug/scrape-check` route, not locally.
