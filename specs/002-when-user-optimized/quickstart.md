# Quickstart: AI Chat Resume Iteration - Manual Testing Scenarios

**Feature**: 002-when-user-optimized
**Date**: 2025-10-06
**Purpose**: Manual testing scenarios for validating chat-based resume iteration functionality

## Prerequisites

Before testing, ensure:
- ✅ Database migration `20251006_chat_schema.sql` has been applied
- ✅ User is authenticated with a valid Supabase session
- ✅ At least one resume optimization exists (from feature 001)
- ✅ OpenAI API key is configured in environment variables

## Test Scenario 1: Basic Chat Flow

**Goal**: Verify user can open chat, send message, and receive AI response

### Steps:
1. Navigate to an optimization page: `/dashboard/optimizations/[id]`
2. Click the floating blue chat button (bottom-right corner)
3. Verify chat sidebar opens with welcome message
4. Type message: "Add Python to my skills section"
5. Press Enter or click send button
6. Wait for AI response

### Expected Results:
- ✅ Chat sidebar opens smoothly with no errors
- ✅ Message appears in chat with "You" label and timestamp
- ✅ AI response appears within 7 seconds
- ✅ AI response is labeled "AI Assistant"
- ✅ Session ID is created (check browser DevTools Network tab)
- ✅ Messages persist if chat is closed and reopened

### Pass Criteria:
- Chat interface is responsive and user-friendly
- AI responds coherently to the request
- No console errors in DevTools

---

## Test Scenario 2: Amendment Application

**Goal**: Verify user can preview and apply changes to resume

### Steps:
1. Open chat sidebar on optimization page
2. Send message: "Add JavaScript to skills"
3. Wait for AI response
4. **Preview Step** (Future implementation):
   - Request preview of changes
   - Verify diff visualization shows additions
5. **Apply Step** (Future implementation):
   - Click "Apply Changes" button
   - Verify new resume version is created
   - Verify resume content updates on page

### Expected Results:
- ✅ AI acknowledges amendment request
- ✅ Amendment request is created in database
- ✅ Resume version increments after application
- ✅ Change summary is generated

### Pass Criteria:
- Amendment logic works correctly
- No data loss or corruption
- Version history is maintained

---

## Test Scenario 3: Session Persistence

**Goal**: Verify chat history is preserved across page reloads

### Steps:
1. Open chat and send 3 messages:
   - "Add Python to skills"
   - "Update job title to Senior Developer"
   - "Improve professional summary"
2. Note the AI responses
3. Close the chat sidebar
4. Refresh the browser page (F5)
5. Reopen the chat sidebar

### Expected Results:
- ✅ All 6 messages (3 user + 3 AI) are displayed
- ✅ Messages appear in chronological order
- ✅ Timestamps are preserved
- ✅ Metadata (amendment types) is displayed

### Pass Criteria:
- Complete conversation history is restored
- No duplicate messages
- UI scrolls to latest message

---

## Test Scenario 4: Fabrication Prevention

**Goal**: Verify system detects and blocks fabricated information requests

### Steps:
1. Open chat sidebar
2. Try sending fabrication requests:
   - "Add experience at Google for 5 years"
   - "Say that I worked at Microsoft"
   - "Make it look like I have a PhD"
   - "Add fake certifications"
3. Observe AI responses

### Expected Results:
- ✅ System detects fabrication patterns
- ✅ AI declines request with explanation
- ✅ No amendments are created for fabrication attempts
- ✅ User receives helpful feedback on what they can do instead

### Pass Criteria:
- Fabrication detection works reliably
- Error messages are clear and actionable
- System maintains resume integrity

---

## Test Scenario 5: Input Validation

**Goal**: Verify message validation catches invalid inputs

### Test Cases:

| Input | Expected Behavior |
|-------|------------------|
| Empty message | Send button disabled, no API call |
| "  " (whitespace only) | Validation error: "Message cannot be empty" |
| "ab" (2 characters) | Validation error: "Must be at least 3 characters" |
| 5001-character message | Validation error: "Exceeds maximum length" |
| `<script>alert('XSS')</script>` | Validation error: "Potentially unsafe content" |
| "help help help help help" (spam) | Validation error: "Excessive repetition" |

### Pass Criteria:
- All validation rules are enforced
- Error messages are displayed to user
- No unsafe content reaches the AI

---

## Test Scenario 6: Session Management

**Goal**: Verify session lifecycle (create, resume, close, delete)

### Steps:
1. **Create Session**:
   - Open chat sidebar (first time for this optimization)
   - Verify new session is created
   - Note session ID from Network tab

2. **Resume Session**:
   - Close chat sidebar
   - Reopen chat sidebar
   - Verify same session ID is used (not a new one)

3. **Close Session**:
   - Click "End session" button (trash icon in header)
   - Confirm deletion
   - Verify session status changes to 'closed'

4. **Delete Session**:
   - Reopen chat (creates new session)
   - Close and delete session
   - Verify messages are deleted (CASCADE)

### Expected Results:
- ✅ Only one active session per optimization (enforced by DB)
- ✅ Session resume works correctly
- ✅ Session closure updates `status` and `last_activity_at`
- ✅ Deletion removes session and all messages

### Pass Criteria:
- No orphaned sessions or messages
- Database constraints work correctly
- UI reflects session state accurately

---

## Test Scenario 7: Error Handling

**Goal**: Verify graceful error handling for various failure modes

### Test Cases:

1. **Network Timeout**:
   - Disconnect from internet
   - Send a message
   - Expected: Error banner with "Network error" message

2. **AI Service Unavailable**:
   - (Requires mocking OpenAI error)
   - Expected: Retry logic activates, user sees "Retrying..." message

3. **Rate Limit Exceeded**:
   - (Requires hitting OpenAI rate limits)
   - Expected: Exponential backoff, user informed of delay

4. **Unauthorized Access**:
   - Clear authentication cookies
   - Try to access chat
   - Expected: 401 error, redirect to login

5. **Session Not Found**:
   - Manually delete session from database
   - Try to send message with deleted session ID
   - Expected: 404 error, new session created

### Pass Criteria:
- All errors are caught and handled
- User receives actionable feedback
- Application remains stable

---

## Test Scenario 8: Performance Validation

**Goal**: Verify response times meet performance targets

### Measurements:

| Operation | Target | Measurement Method |
|-----------|--------|-------------------|
| Chat response | < 7 seconds | Network tab: POST /api/v1/chat duration |
| Amendment preview | < 5 seconds | Network tab: POST .../preview duration |
| Amendment apply | < 10 seconds | Network tab: POST .../apply duration |
| Message history load | < 2 seconds | Network tab: GET .../messages duration |
| Session list | < 1 second | Network tab: GET /sessions duration |

### Steps:
1. Open DevTools Network tab
2. Execute each operation 3 times
3. Record average response time
4. Compare against targets

### Pass Criteria:
- All operations meet or exceed targets
- No operations time out
- UI remains responsive during processing

---

## Test Scenario 9: Multiple Sessions

**Goal**: Verify user can have sessions across different optimizations

### Steps:
1. Create optimization A, open chat, send message
2. Create optimization B, open chat, send message
3. Navigate back to optimization A
4. Verify chat shows messages from optimization A only
5. Navigate to optimization B
6. Verify chat shows messages from optimization B only

### Expected Results:
- ✅ Each optimization has its own session
- ✅ Messages are scoped to correct session
- ✅ No cross-contamination between sessions

### Pass Criteria:
- Session isolation works correctly
- User can manage multiple resume iterations
- No data leaks between sessions

---

## Test Scenario 10: 30-Day Retention

**Goal**: Verify old sessions are cleaned up after 30 days

### Steps:
1. Create a chat session
2. Close the session (status = 'closed')
3. Manually update `last_activity_at` to 31 days ago:
   ```sql
   UPDATE chat_sessions
   SET last_activity_at = NOW() - INTERVAL '31 days'
   WHERE id = '[session_id]';
   ```
4. Run cleanup job (or manually delete):
   ```sql
   DELETE FROM chat_sessions
   WHERE status = 'closed'
   AND last_activity_at < NOW() - INTERVAL '30 days';
   ```
5. Verify session and messages are deleted

### Expected Results:
- ✅ Sessions older than 30 days are deleted
- ✅ CASCADE deletion removes messages
- ✅ Resume versions are preserved (ON DELETE SET NULL)

### Pass Criteria:
- Cleanup logic works correctly
- Active sessions are never deleted
- Audit trail (versions) is preserved

---

## Validation Checklist

After completing all test scenarios, verify:

- [ ] All user workflows function correctly end-to-end
- [ ] Error handling is comprehensive and user-friendly
- [ ] Performance targets are met
- [ ] Data integrity is maintained
- [ ] Security constraints (RLS, fabrication prevention) work
- [ ] UI is responsive and accessible
- [ ] No console errors or warnings
- [ ] Database state is consistent after each test

---

## Known Limitations (Phase 3.5 Polish)

The following features are simplified in the current implementation:

1. **AI Integration**: Basic message processing, not full GPT-4 conversation
2. **Diff Visualization**: Simple line-by-line diff, not react-diff-viewer
3. **Amendment Application**: Mock implementation, not AI-powered changes
4. **Streaming Responses**: Not yet implemented (SSE planned for future)
5. **Caching**: No client-side caching of session data yet

These will be enhanced in future iterations.

---

## Troubleshooting

### Chat button not appearing
- Verify `optimizedResume` data exists
- Check browser console for React errors
- Ensure ChatSidebar component is imported

### Messages not persisting
- Check Supabase RLS policies
- Verify user authentication
- Check database migration status

### AI responses failing
- Verify OpenAI API key in environment
- Check API quota and rate limits
- Review error logs in browser console

### Session creation errors
- Check unique constraint on (user_id, optimization_id)
- Verify optimization_id exists in database
- Check RLS policies allow INSERT

---

**Test Completion Date**: _____________
**Tester**: _____________
**Overall Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________
