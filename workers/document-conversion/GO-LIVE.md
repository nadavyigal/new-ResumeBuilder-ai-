# MarkItDown Service — Go-Live Prompt

Paste this prompt into Codex, Claude Code, or Cursor to deploy the MarkItDown
document-conversion microservice and activate DOCX + structured PDF uploads in
ResumeBuilder.

---

## Prompt (copy everything below this line)

---

**Goal:** Deploy the MarkItDown Python microservice and activate it in the
ResumeBuilder Vercel app so users can upload PDF and DOCX resumes with
structured Markdown extraction instead of flat text.

**Repo:** `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`

**Service source:** `workers/document-conversion/` (already merged to `main`)

---

### Step 1 — Local smoke test (run before deploying)

```bash
cd "workers/document-conversion"
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start the service locally
uvicorn main:app --host 0.0.0.0 --port 8000

# In a second terminal — test with a real resume
curl -s -F "file=@/path/to/sample-resume.pdf" http://localhost:8000/convert | python3 -m json.tool
curl -s -F "file=@/path/to/sample-resume.docx" http://localhost:8000/convert | python3 -m json.tool

# Health check
curl http://localhost:8000/health
```

**Pass criteria:**
- `/health` returns `{"status":"ok","max_file_mb":10}`
- `/convert` returns JSON with `markdown`, `format`, `char_count` fields
- The `markdown` field contains recognizable resume sections (Experience,
  Education, Skills as headings or bold labels), not a wall of flat text
- `char_count` > 200 for a non-trivial resume

If either curl fails, stop here and fix before deploying.

---

### Step 2 — Deploy the microservice to Railway

1. Go to [railway.app](https://railway.app) and create a new project.
2. Choose **Deploy from GitHub repo** → select the ResumeBuilder repo →
   set the **Root Directory** to `workers/document-conversion`.
3. Railway auto-detects the `Dockerfile` and builds it.
4. In Railway's project settings, add these environment variables:

   | Variable | Value |
   |----------|-------|
   | `INTERNAL_TOKEN` | Generate: `openssl rand -hex 32` |
   | `ALLOWED_ORIGINS` | Your Vercel production URL, e.g. `https://your-app.vercel.app` |
   | `MAX_FILE_SIZE_MB` | `10` |

5. After the deploy completes, copy the Railway service URL
   (e.g. `https://your-service.up.railway.app`).
6. Verify: `curl https://your-service.up.railway.app/health` returns `{"status":"ok","max_file_mb":10}`.

**Alternative: Render**

If you prefer Render, create a new Web Service from the same repo,
set root directory to `workers/document-conversion`, select Docker runtime,
and add the same three environment variables.

---

### Step 3 — Set Vercel environment variables

In the Vercel dashboard for the ResumeBuilder project, go to
**Settings → Environment Variables** and add:

| Variable | Value | Environments |
|----------|-------|--------------|
| `MARKITDOWN_SERVICE_URL` | `https://your-service.up.railway.app` | Production, Preview |
| `MARKITDOWN_INTERNAL_TOKEN` | Same value as Railway's `INTERNAL_TOKEN` | Production, Preview |

For local dev, add to `.env.local`:
```
MARKITDOWN_SERVICE_URL=http://localhost:8000
MARKITDOWN_INTERNAL_TOKEN=    # leave blank for local dev (token check disabled when unset)
```

---

### Step 4 — Trigger a Vercel redeploy

After setting the env vars, redeploy from the Vercel dashboard or push an
empty commit:

```bash
git commit --allow-empty -m "chore: trigger redeploy for MARKITDOWN_SERVICE_URL"
git push
```

---

### Step 5 — End-to-end validation

1. Open the ResumeBuilder app (staging or production).
2. Upload a DOCX resume through the normal upload flow.
3. Complete the optimization (enter a job description, click submit).
4. Verify the optimization result appears — it should succeed, not show an
   error about "PDF only".
5. In Supabase, check the `resumes` table: open the row just created and
   verify `raw_text` contains Markdown with section headers, not flat text.
6. Repeat with a PDF resume to confirm existing behavior is preserved.

**Pass criteria:**
- DOCX upload succeeds end-to-end (no 400/422 error)
- PDF upload continues to work
- `raw_text` in Supabase contains structured Markdown (sections visible)
- No `MARKITDOWN_SERVICE_URL is not configured` error in Vercel logs

---

### Step 6 — Monitor for 24 hours

Watch Vercel function logs and Railway logs for:
- `MarkItDown service unreachable` — means Railway/Render service is down
- `MarkItDown conversion failed (4xx/5xx)` — means service rejected the file
- `Conversion produced empty output` — means the file was valid but MarkItDown
  returned no text (unusual; flag it)

Target: <5% conversion error rate on resume uploads.

---

### Rollback plan

If conversion errors exceed 5% or the service is unreliable:

1. In Vercel, delete (or blank out) `MARKITDOWN_SERVICE_URL`.
2. Redeploy.
3. The `upload-resume` route will return HTTP 422 with the message
   "Could not read your file" for all uploads — this is the safe failure mode.
4. The old PDF-only path is gone (the PR removed `pdfjs-dist`), so if you need
   to restore the old behavior, revert to the commit before PR #63.

---

### Files involved (all merged to main as of 2026-06-07)

| File | What it does |
|------|-------------|
| `workers/document-conversion/main.py` | FastAPI entry point, auth, file validation |
| `workers/document-conversion/converter.py` | MarkItDown wrapper, temp file handling |
| `workers/document-conversion/Dockerfile` | Python 3.12-slim image |
| `workers/document-conversion/requirements.txt` | fastapi, uvicorn, markitdown[pdf,docx] |
| `workers/document-conversion/.env.example` | Template for service env vars |
| `src/lib/markitdown-client.ts` | Next.js HTTP client calling the service |
| `src/lib/utils/file-validation.ts` | PDF + DOCX magic-byte validation |
| `src/app/api/upload-resume/route.ts` | Upload route wired to MarkItDown |

---

**Constraints:**
- Do not modify any of the files above during deployment — they are correct.
- Do not run Supabase migrations — no schema changes are needed for Phase 1.
- Do not push to App Store or any production billing/auth config.
- The only actions needed are: deploy Docker image, set two Vercel env vars,
  redeploy, validate end-to-end.
