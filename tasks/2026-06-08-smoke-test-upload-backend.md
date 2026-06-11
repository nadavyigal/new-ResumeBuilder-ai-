# Task: Resumely Backend Smoke-Test — pdf-parse + mammoth
Date: 2026-06-08
Status: TODO
Priority: BLOCKER — run before Apple approves

## Why This Exists

The Python MarkItDown microservice was removed and replaced with a local `pdf-parse + mammoth`
implementation (commits `5fcfdb2`, `4c083cb`). The refactored code lives in:

```
src/lib/markitdown-client.ts
```

The function `convertResumeBuffer` now:
- PDF: calls `pdfParse(fileBuffer)` → returns `data.text.trim()`
- DOCX: calls `mammoth.extractRawText({ buffer: fileBuffer })` → returns `result.value.trim()`

If either returns an empty string, the route returns a 422 with "Could not read your file."
The optimize step runs after a successful parse, so a silent empty-parse means a bad AI result,
not a 422 — that's the more dangerous failure mode.

The response contract to verify:
```json
{
  "success": true,
  "resumeId": "<uuid>",
  "jobDescriptionId": "<uuid>",
  "reviewId": "<uuid>",
  "nextStep": "review",
  "matchScore": <number 0–100>,
  "keyImprovements": [...],
  "missingKeywords": [...]
}
```

---

## Test 1 — Web: PDF Upload

**Setup:** Dev server running at http://localhost:3000. Have a real multi-page PDF resume ready.

**Steps:**
1. Start dev server: `npm run dev` (from `resume-builder-ai/`)
2. Open the app, sign in with a test account
3. Open DevTools → Network tab, filter to `upload-resume`
4. Upload a text-based PDF resume with a job description pasted in
5. Submit

**Pass criteria:**
- [ ] Network call to `/api/upload-resume` returns HTTP 200
- [ ] Response body has `success: true`
- [ ] `resumeId` is a valid UUID (non-null, non-empty)
- [ ] `reviewId` is a valid UUID (non-null, non-empty)
- [ ] `matchScore` is a number between 0 and 100 (not 0 unless the resume is truly irrelevant)
- [ ] `keyImprovements` is a non-empty array
- [ ] App transitions to the review/results screen without error

**Fail signals:**
- HTTP 422 → parse returned empty. Check the server log for "Conversion produced empty output"
- HTTP 500 → optimization failed after parse. Check server log for AI optimizer error
- `matchScore` is 0 and `keyImprovements` is empty → parse succeeded but returned garbage text
- App shows a generic error toast and no review screen

---

## Test 2 — Web: DOCX Upload

**Steps:**
1. Same dev server and test account
2. Upload a `.docx` resume file (must be a real Word doc, not a renamed PDF)
3. Use the same job description as Test 1 so results are comparable

**Pass criteria:**
- [ ] HTTP 200, `success: true`
- [ ] `resumeId` and `reviewId` are non-null UUIDs
- [ ] `matchScore` is a plausible number (not 0, not null)
- [ ] App reaches the review screen

**Fail signals:**
- HTTP 400 "Only PDF and DOCX files are supported" → file validation is rejecting the file before mammoth runs. Check `src/lib/utils/file-validation.ts`
- HTTP 422 → mammoth returned empty. Likely a malformed DOCX or a DOCX that is actually a `.doc` (old format, not supported by mammoth)

---

## Test 3 — Web: API Contract Check

Open the Network response for `/api/upload-resume` and confirm ALL fields are present and
match the expected shape. Use this checklist:

- [ ] `success` — boolean, true
- [ ] `resumeId` — string UUID
- [ ] `jobDescriptionId` — string UUID
- [ ] `reviewId` — string UUID (not null — if null, optimization was deferred and something is wrong with this non-deferred call)
- [ ] `nextStep` — string, value is `"review"` (not `"optimize"`)
- [ ] `matchScore` — number, 0–100
- [ ] `keyImprovements` — array (can be empty but should not be if parse succeeded)
- [ ] `missingKeywords` — array

If any field is missing or the shape changed, the iOS app may be silently broken because
it maps these fields by name.

---

## Test 4 — iOS: PDF Upload

**Setup:** ResumeBuilder iOS app built and running on simulator or device against production
or staging backend (not localhost — iOS simulator can hit localhost via `http://localhost:3000`
if needed, but confirm which backend env the iOS app points to).

**Steps:**
1. Open the iOS app, sign in
2. Navigate to the upload screen
3. Select a PDF from Files
4. Enter a job description
5. Submit

**Pass criteria:**
- [ ] No error shown to the user
- [ ] App transitions to the results/review screen
- [ ] Results contain a score and improvement suggestions

**Fail signals:**
- "Could not read your file" shown in iOS UI → 422 from backend, parse is broken
- Generic network error or spinner that never resolves → check the backend URL the iOS app is targeting
- Results screen loads but score is 0 and suggestions are empty → parse returned garbage

---

## What To Do If a Test Fails

### 422 on PDF
Check `src/lib/markitdown-client.ts`. The `pdf-parse` library sometimes returns empty text on
image-based PDFs (scanned docs). Test with a text-based PDF first. If it fails on text-based,
the `pdf-parse` package may not be installed: run `npm ls pdf-parse` to verify.

### 422 on DOCX
Check that the file is a true `.docx` (Office Open XML). Old `.doc` files are not supported by
mammoth and will throw. Run `npm ls mammoth` to verify installation.

### matchScore is 0, keyImprovements is empty (parse succeeded)
The parse returned text but it was too short or garbled for the AI to produce results. Log the
`raw_text` field stored in Supabase for the test resume to inspect what `pdf-parse` actually
extracted. If it looks like garbage characters, the PDF may be using unusual encoding.

### iOS can't reach backend
Confirm the API base URL used in the iOS app. Check if it points to production vs staging.
If iOS uses a hardcoded prod URL and prod has the new backend deployed, the test is valid.

---

## Done Criteria

All 4 tests pass with no failures. Update this task's Status to DONE and add a line to
`tasks/MEMORY.md` confirming the refactor is verified.

If any test fails: fix before this task is closed. Do not ship to a live user base with a
broken upload flow.
