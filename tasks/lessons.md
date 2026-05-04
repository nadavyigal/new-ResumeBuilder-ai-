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
