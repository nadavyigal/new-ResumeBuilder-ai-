# Bug Report

## 1. OpenAI Assistant run polling failed
- **Location:** `src/lib/chat-manager/assistant-manager.ts`
- **Issue:** `runs.retrieve` and `runs.submitToolOutputs` were called with the run ID as the first parameter and the thread ID passed via an options object. The OpenAI SDK expects the thread ID as the first argument and the run ID as the second. The incorrect ordering caused every poll to throw, so the assistant never finished runs or executed tool calls, breaking conversational editing.
- **Fix:** Call `runs.retrieve(resolvedThreadId, run.id)` and `runs.submitToolOutputs(resolvedThreadId, run.id, { tool_outputs })` so the SDK can locate the correct thread/run pair.

## 2. Tip implementation crashed without resume data
- **Location:** `src/lib/agent/handlers/handleTipImplementation.ts`
- **Issue:** The handler assumed `optimizations.rewrite_data` always contained a parsed resume. When the user tried to apply ATS tips before generating a resume (or if the JSON field was stored as a string), `applySuggestions` received `null` and threw, preventing tips from being applied and leaving the ATS score unchanged.
- **Fix:** Added `ensureOptimizedResume` to validate/parse the stored data and return a helpful error when the resume is missing so the assistant can respond smartly instead of crashing.

## 3. ATS match score returned NaN
- **Location:** `src/lib/ai-optimizer/index.ts`
- **Issue:** `calculateMatchScore` divided by the number of unique job-description keywords without guarding for empty job descriptions. When the job description was blank or only contained short stop-words, the divisor became `0`, producing `NaN` scores that then propagated to the UI.
- **Fix:** Return `0` whenever no usable keywords exist, ignore empty descriptions, and clamp the computed percentage between 0 and 100. Added Jest tests in `src/lib/__tests__/ai-optimizer.test.ts` to lock in the behavior.
