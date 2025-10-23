# Agent SDK Testing Guide

**Application Status**: ✅ RUNNING
**URL**: http://localhost:3000
**Agent SDK**: ✅ ENABLED AND ACTIVE

---

## 🚀 Quick Start

### 1. Access the Application

Open your web browser and navigate to:
```
http://localhost:3000
```

You should see the Resume Builder AI landing page.

---

## 🧪 How to Test the Agent SDK

### Step 1: Create an Account / Sign In

1. Go to **http://localhost:3000/auth/signup** (or click "Sign Up")
2. Create a new account with:
   - Email: your-email@example.com
   - Password: (your password)
3. Or sign in if you already have an account: **http://localhost:3000/auth/signin**

### Step 2: Navigate to Resume Dashboard

1. After signing in, you'll be redirected to: **http://localhost:3000/dashboard**
2. Click on "**Resume**" or navigate to: **http://localhost:3000/dashboard/resume**

### Step 3: Upload a Resume (Triggers Agent SDK)

1. **Upload a resume file** (PDF or DOCX)
2. **Paste a job description** (or job URL from LinkedIn)
3. Click **"Optimize Resume"**

**What Happens Behind the Scenes**:
```
User clicks "Optimize"
    ↓
Frontend sends request to /api/agent/run (or /api/upload-resume)
    ↓
Agent SDK Runtime kicks in:
  1. Intent Detection → "optimize"
  2. Job Link Scraper → fetches job details (if URL provided)
  3. Resume Writer → analyzes and improves content
  4. ATS Scoring → calculates match percentage
  5. Design Ops → applies theme/styling
  6. Layout Engine → renders preview
  7. Versioning → saves resume version
  8. History Store → records optimization
    ↓
Response returns AgentResult:
  - intent: "optimize"
  - diffs: [list of changes made]
  - ats_report: {score: 85, missing_keywords: [...]}
  - artifacts: {resume_json, preview_pdf_path}
  - ui_prompts: [any warnings or suggestions]
    ↓
Frontend displays:
  - ATS match score
  - Optimized resume preview
  - Key improvements
  - Missing keywords
```

---

## 📊 What to Observe

### In the Browser

1. **ATS Score**
   - Should see a percentage match score (e.g., "85% Match")
   - This is calculated by the Agent SDK's ATS tool

2. **Resume Preview**
   - Optimized resume with applied design
   - Rendered by the Layout Engine tool

3. **Improvements Section**
   - List of key improvements made
   - Generated from the diffs array

4. **Missing Keywords**
   - Keywords from job description not in resume
   - Extracted by the ATS tool

### In the Server Logs

Open your terminal where the server is running and watch for:

```
Agent SDK Log Examples:

✅ {"t":"2025-10-23T...", "category":"agent_run", "message":"agent run completed", "meta":{"userId":"...", "intent":"optimize"}}

✅ {"t":"2025-10-23T...", "category":"tool_error", "message":"ATS score used a safe fallback...", ...}
   ^ This is normal! Fallbacks are working as designed

✅ {"t":"2025-10-23T...", "category":"storage_warn", "message":"LayoutEngine.render PDF/storage failed", ...}
   ^ Also normal if Supabase storage isn't fully configured
```

### In the Network Tab (Browser DevTools)

1. Open **Browser DevTools** (F12)
2. Go to **Network** tab
3. Click "Optimize" in the app
4. Look for the request:

```
POST /api/agent/run  (or /api/upload-resume)
Status: 200 OK
Response Preview:
{
  "intent": "optimize",
  "actions": [
    {"tool": "JobLinkScraper.getJob", "args": {...}, "rationale": "Fetch job details"},
    {"tool": "ResumeWriter.applyDiff", "args": {...}, "rationale": "Add extracted skills"},
    {"tool": "DesignOps.theme", "args": {...}, "rationale": "Apply requested theme"},
    {"tool": "ATS.score", "args": {...}, "rationale": "Compute ATS score"},
    {"tool": "LayoutEngine.render", "args": {...}, "rationale": "Render preview"},
    {"tool": "Versioning.commit", "args": {...}, "rationale": "Create version"},
    {"tool": "HistoryStore.save", "args": {...}, "rationale": "Record run"}
  ],
  "diffs": [
    {"scope": "paragraph", "before": "...", "after": "..."},
    {"scope": "style", "before": "", "after": "font=Arial; color=2563eb"}
  ],
  "artifacts": {
    "resume_json": { /* optimized resume data */ },
    "preview_pdf_path": "artifacts/...",
    "export_files": [{"type": "pdf", "path": "..."}]
  },
  "ats_report": {
    "score": 85,
    "missing_keywords": ["Python", "AWS", "Docker"],
    "recommendations": ["Consider adding keyword: Python", ...]
  },
  "history_record": {
    "resume_version_id": "...",
    "timestamp": "2025-10-23T...",
    "ats_score": 85
  },
  "ui_prompts": []
}
```

---

## 🔍 Advanced Testing Scenarios

### Scenario 1: Test Intent Detection

Try different commands in chat (if chat feature is available):

```
Commands to try:
- "optimize my resume for software engineering"
  → Intent: "optimize"

- "change the font to Helvetica"
  → Intent: "design", "layout"

- "add skills: Python, AWS, Docker"
  → Intent: "optimize"
  → Should see diffs with added skills

- "strengthen my summary"
  → Intent: "strengthen"
  → Should see paragraph diffs
```

### Scenario 2: Test Fallback Mechanisms

1. **Without Supabase Connection** (current state):
   - Agent SDK should still work
   - Will log warnings for Versioning and HistoryStore
   - Should return fallback IDs (e.g., `local_1234567890`)
   - UI should still function normally

2. **With Invalid Job URL**:
   - JobLinkScraper should fail gracefully
   - Should continue with empty job text
   - No crash, just logged warning

### Scenario 3: Test Design Tools

1. Upload resume
2. Try different design templates
3. Observe:
   - DesignOps.theme tool in actions array
   - Style diffs in response
   - Different font/color applied in preview

### Scenario 4: View History

1. Navigate to: **http://localhost:3000/dashboard/history**
2. Should see previous optimization runs
3. Each entry stored by HistoryStore tool

---

## 📝 Test Checklist

Use this checklist to verify Agent SDK is working:

### Basic Functionality
- [ ] Application loads at http://localhost:3000
- [ ] Can create account / sign in
- [ ] Can upload resume file
- [ ] Can paste job description
- [ ] Optimize button triggers API call

### Agent SDK Features
- [ ] Intent detection working (check response.intent)
- [ ] Actions array populated (7-10 tools executed)
- [ ] Diffs array shows changes made
- [ ] ATS score calculated and displayed
- [ ] Resume preview renders
- [ ] No critical errors in console

### Response Structure
- [ ] Response has `intent` field
- [ ] Response has `actions` array
- [ ] Response has `diffs` array
- [ ] Response has `artifacts` object
- [ ] Response has `ats_report` object
- [ ] Response has `history_record` object
- [ ] Response has `ui_prompts` array

### Fallback Behavior
- [ ] Works without Supabase (fallback IDs used)
- [ ] Handles missing job URL gracefully
- [ ] Handles PDF generation errors (fallback path)
- [ ] Logs warnings but continues execution

---

## 🐛 Troubleshooting

### Issue: "Agent SDK disabled" error
**Solution**: Check `.env.local`:
```env
AGENT_SDK_ENABLED=true   # Must be true
```

### Issue: Getting legacy response shape
**Solution**: Check `.env.local`:
```env
AGENT_SDK_SHADOW=false   # Must be false
```

### Issue: Authentication errors
**Solution**: Make sure you're signed in:
1. Go to /auth/signin
2. Use valid credentials
3. Check browser cookies

### Issue: Server not responding
**Solution**: Restart the server:
```bash
cd resume-builder-ai
npm run dev
```

### Issue: Can't see logs
**Solution**: Check the terminal where `npm run dev` is running

---

## 📊 Expected Behavior vs Old Behavior

### Old System (Legacy Optimizer)
```json
{
  "optimizationId": "abc-123",
  "optimizedResume": { /* data */ },
  "matchScore": 85
}
```

### New System (Agent SDK) ✅ ACTIVE NOW
```json
{
  "intent": "optimize",
  "actions": [7 tools executed],
  "diffs": [changes made],
  "artifacts": {resume, preview, exports},
  "ats_report": {score, keywords, recommendations},
  "history_record": {version_id, timestamp},
  "ui_prompts": [warnings/suggestions]
}
```

**Key Differences**:
- ✅ More detailed action log
- ✅ Explicit diffs showing changes
- ✅ Better ATS analysis
- ✅ History tracking
- ✅ Fallback mechanisms
- ✅ Intent detection

---

## 🎯 Success Indicators

You'll know the Agent SDK is working correctly when:

1. ✅ Response contains `intent` field (not just `optimizationId`)
2. ✅ Response contains `actions` array with 7+ tool executions
3. ✅ Response contains `diffs` array with actual changes
4. ✅ ATS score is calculated and returned
5. ✅ Server logs show `{"category":"agent_run", "message":"agent run completed"}`
6. ✅ No 501 "Agent SDK disabled" errors
7. ✅ No response shape `{shadow: true, legacy: {...}}`

---

## 📞 Need Help?

If you encounter issues:

1. **Check server logs** - Look for error messages
2. **Check browser console** - Look for JavaScript errors
3. **Check Network tab** - Verify API request/response
4. **Check .env.local** - Verify Agent SDK flags
5. **Restart server** - `npm run dev`

---

## 🎉 Enjoy Testing!

The Agent SDK is now live and ready to use. Have fun exploring the new architecture!

**Current Configuration**:
- ✅ Agent SDK: ENABLED
- ✅ Shadow Mode: DISABLED
- ✅ Model: gpt-4o-mini
- ✅ Server: http://localhost:3000

Happy testing! 🚀
