# Deployment Tasks — Safety Complements

Overall Progress: `100%`

## Tasks:

- [x] 🟩 Step 1: Idempotent down migrations
  - [x] 🟩 Add `supabase/migrations/20251023000400_agent_sdk_down.sql` (idempotent order)

- [x] 🟩 Step 2: Runtime verification (Node)
  - [x] 🟩 Ensure `export const runtime = 'nodejs'` in PDF render routes

- [x] 🟩 Step 3: Artifacts ignore
  - [x] 🟩 Update `.gitignore` to include `/tmp/artifacts/**`

- [x] 🟩 Step 4: README documentation
  - [x] 🟩 Document environment variables and feature flags

- [x] 🟩 Step 5: CI steps
  - [x] 🟩 Add CI workflow to run tests, lint, and benchmarks

