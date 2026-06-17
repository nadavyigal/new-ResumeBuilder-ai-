# Lessons Learned — ResumeBuilder

> Read this before any triage session. Add a new lesson whenever a recurring bug is fixed.

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
