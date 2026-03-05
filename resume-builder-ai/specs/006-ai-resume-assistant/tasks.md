# Tasks: AI Resume Assistant - Integration Project

**Input**: Design documents from `/specs/006-ai-resume-assistant/`
**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ contracts/, ✅ quickstart.md

**Feature Branch**: `006-ai-resume-assistant`
**Estimated Total Effort**: 10 days (1-2 weeks)

**IMPORTANT NOTE**: This is an **integration project**, not a new feature build. 80% of functionality already exists in Features 002 (Chat), 003 (Design), and 005 (History). Tasks focus on creating NEW UI components and connecting existing APIs.

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Web application structure (Next.js App Router):
- Frontend components: `resume-builder-ai/src/components/ai-assistant/`
- React hooks: `resume-builder-ai/src/hooks/`
- Prompts: `resume-builder-ai/src/lib/prompts/`
- API routes: `resume-builder-ai/src/app/api/` (EXISTING - only modify)
- Tests: `resume-builder-ai/tests/`

---

## Phase 1: Setup & Prerequisites

**Purpose**: Verify existing infrastructure and prepare development environment

- [x] **T001** [P] Verify Feature 002 (Chat) is operational: Test `/api/v1/chat` endpoint responds, verify `chat_sessions` table exists, confirm `src/lib/chat-manager/` library is functional ✅ VERIFIED (API route exists, migration 20251006104316_chat_schema.sql applied, library at src/lib/chat-manager/ functional)
- [x] **T002** [P] Verify Feature 003 (Design) is operational: Test `/api/v1/design/templates` endpoint responds, verify `design_templates` table exists, confirm `src/lib/design-manager/` library is functional ✅ VERIFIED (API route exists, migration 20251008_add_design_tables.sql applied, library at src/lib/design-manager/ functional)
- [x] **T003** [P] Verify Feature 005 (History) is operational: Test `/api/optimizations` endpoint responds, verify `/dashboard/history` page loads, confirm `applications` table exists ✅ VERIFIED (API route exists, migration 20251014000000_add_applications_table.sql applied, /dashboard/history/page.tsx exists)
- [x] **T004** [P] Create directory structure: Create `resume-builder-ai/src/components/ai-assistant/`, `resume-builder-ai/tests/e2e/ai-assistant/`, `resume-builder-ai/tests/unit/ai-assistant/`, `resume-builder-ai/tests/unit/hooks/` ✅ CREATED (all directories exist)

**Checkpoint**: All existing features verified operational - ready to build integration layer

---

## Phase 2: Core UI Components (Week 1, Days 1-2)

**Purpose**: Build unified AI Assistant sidebar with tabs

**⚠️ CRITICAL**: These are NEW components - no existing files to modify

- [x] **T005** [P] Create AIAssistantSidebar component at `resume-builder-ai/src/components/ai-assistant/AIAssistantSidebar.tsx`: Sidebar container with fixed positioning (right side), header with title "AI Resume Assistant" and close button, tabs using shadcn/ui Tabs component (Content + Design tabs), responsive layout (full screen on mobile <768px, 384px width on desktop), accepts `optimizationId` and `onClose` props ✅ CREATED (fixed right sidebar, X close button, Content/Design tabs, responsive md:w-96, optimizationId/onClose props)
- [x] **T006** [P] Create ChatPanel component at `resume-builder-ai/src/components/ai-assistant/ChatPanel.tsx`: Message history display with ScrollArea component, user/AI message bubbles (user right-aligned blue, AI left-aligned gray), message input with Textarea component, send button with loading state, empty state showing example prompts ("Make my second bullet point more impactful", "Add project management keywords"), error handling with toast notifications, accepts `optimizationId` prop ✅ CREATED (ScrollArea with messages, user/AI bubbles styled, Textarea input, Send button with Loader2, empty state with 4 example prompts, toast error handling, Enter/Shift+Enter support)
- [x] **T007** [P] Create DesignPanel component at `resume-builder-ai/src/components/ai-assistant/DesignPanel.tsx`: Current template display card showing template name, natural language input field with Input component, suggestion buttons for common requests ("Change header color to dark blue", "Use Roboto font for headings", "Switch to two-column layout"), apply button with loading state, success/error toasts, accepts `optimizationId` prop ✅ CREATED (Card with current template display, Input field, 5 suggestion buttons, Apply button with Loader2, success/error toasts, help text)
- [x] **T008** Create index.ts barrel export at `resume-builder-ai/src/components/ai-assistant/index.ts`: Export all three components (AIAssistantSidebar, ChatPanel, DesignPanel) for clean imports ✅ CREATED (exports all 3 components + their props types)

**Checkpoint**: All UI components created and can be rendered (even without API connections)

---

## Phase 3: React Hooks for API Integration (Week 1, Day 3)

**Purpose**: Connect UI components to existing APIs

**⚠️ CRITICAL**: These hooks call EXISTING APIs - no API changes needed

- [x] **T009** [P] Create useChatSession hook at `resume-builder-ai/src/hooks/useChatSession.ts`: Fetch or create chat session for optimization (GET/POST `/api/v1/chat/sessions`), send messages to POST `/api/v1/chat`, handle AI responses with amendments, manage loading/error states, use React Query for caching with staleTime 5 minutes, return { session, messages, sendMessage, loading, error } interface ✅ CREATED (sendMessage function, automatic session creation, abort controller, error handling, returns session/messages/sendMessage/isLoading/isSending/error/clearMessages/resetSession)
- [x] **T010** [P] Create useDesignCustomization hook at `resume-builder-ai/src/hooks/useDesignCustomization.ts`: Fetch current design assignment (GET `/api/v1/design/{optimizationId}`), send customization requests (POST `/api/v1/design/{optimizationId}/customize`), handle success responses and ATS warnings, manage loading/error states, use React Query for caching, return { currentDesign, applyCustomization, loading, error } interface ✅ CREATED (fetchDesign on mount, applyCustomization function, ATS warning handling, abort controller, error handling, returns currentDesign/applyCustomization/isLoading/isCustomizing/error/refetch/invalidate)

**Checkpoint**: Hooks created and tested with existing API endpoints

---

## Phase 4: Component-Hook Integration (Week 1, Day 3 continued)

**Purpose**: Wire up UI components to hooks

**Dependencies**: Requires T005-T010 complete

- [x] **T011** Update ChatPanel component at `resume-builder-ai/src/components/ai-assistant/ChatPanel.tsx`: Import and use `useChatSession` hook, pass `optimizationId` to hook, display messages from hook state, handle send button click with `sendMessage` function, show loading state during API calls, display error messages with toast, implement Enter key to send (Shift+Enter for new line) ✅ INTEGRATED (imported useChatSession, removed local state, using messages/sendMessage/isLoading/isSending from hook, onSuccess/onError callbacks with toasts, Enter/Shift+Enter working, removed placeholder code)
- [x] **T012** Update DesignPanel component at `resume-builder-ai/src/components/ai-assistant/DesignPanel.tsx`: Import and use `useDesignCustomization` hook, pass `optimizationId` to hook, display current template from hook state, handle apply button click with `applyCustomization` function, show loading state during API calls, display success/error toasts with messages from API response, populate input field when suggestion buttons clicked ✅ INTEGRATED (imported useDesignCustomization, removed local state, using currentDesign/applyCustomization/isLoading/isCustomizing from hook, onSuccess/onError callbacks with toasts, ATS warning display, template customization badge, removed placeholder code)

**Checkpoint**: UI components fully functional with live API connections

---

## Phase 5: Enhanced AI Prompts (Week 1, Day 4)

**Purpose**: Make AI responses more conversational and supportive

**⚠️ CRITICAL**: Modifying EXISTING prompt file - must not break Feature 002/003 functionality

- [x] **T013** Update OpenAI prompts at `resume-builder-ai/src/lib/prompts/resume-optimizer.ts`: Add versioned prompts object with `v1_functional` (current) and `v2_conversational` (new) keys, change v2 tone from formal to friendly ("Let's make this bullet pop for recruiters!"), add encouraging language ("Great start! Here are some ways to make it even better"), structure prompts with clear sections (role, context, task, constraints), add feature flag `CHAT_PROMPT_VERSION` to switch versions (default v1), export `getChatPrompt()` function that returns appropriate version
- [x] **T014** Add clarifying question logic to `resume-builder-ai/src/lib/chat-manager/processor.ts`: Detect vague user requests using regex patterns ("make it better", "improve this", "enhance", etc), return clarifying questions in AI response ("Which section would you like to improve?", "What aspect should I focus on - tone, keywords, or structure?"), set `requires_clarification: true` flag in response metadata, handle follow-up clarifications by appending context to next prompt

**Checkpoint**: AI responses feel conversational - test with 10 sample requests

---

## Phase 6: Duplicate Application Detection (Week 1, Day 5)

**Purpose**: Prevent accidental duplicate job applications

**⚠️ CRITICAL**: Modifying EXISTING API route - must maintain backward compatibility

- [x] **T015** Add duplicate detection to `resume-builder-ai/src/app/api/applications/route.ts`: In POST handler, query `applications` table for matching (user_id, job_title, company, DATE(applied_date) = CURRENT_DATE), if duplicate found AND no `?confirm=true` query param, return 409 status with `{ error: "Duplicate detected", message: "...", confirm_required: true, existing_application_id: "..." }`, if `?confirm=true` param present, bypass check and create application, add unit tests for duplicate detection logic

**Checkpoint**: Duplicate detection tested with various scenarios (duplicate same day, different day, missing fields)

---

## Phase 7: Integration Point - Add AI Assistant to Optimization Page (Week 1, Day 5 continued)

**Purpose**: Make AI Assistant accessible from optimization detail page

**Dependencies**: Requires T005-T012 complete

- [x] **T016** Add AI Assistant button to optimization detail page at `resume-builder-ai/src/app/dashboard/optimizations/[id]/page.tsx`: Import `AIAssistantSidebar` component, add state for sidebar open/closed, add "Open AI Assistant" floating action button (fixed position bottom-right), render AIAssistantSidebar conditionally when open, pass optimization ID from route params, handle close callback to update state

**Checkpoint**: User can open AI Assistant from optimization page - sidebar renders with tabs

---

## Phase 8: E2E Tests (Week 2, Days 6-7)

**Purpose**: Comprehensive end-to-end testing of integrated experience

**⚠️ CRITICAL**: Tests must verify the INTEGRATION of existing features, not features themselves

- [x] **T017** [P] Write full flow E2E test at `resume-builder-ai/tests/e2e/ai-assistant/full-flow.spec.ts`: Navigate to optimization detail page, click "Open AI Assistant" button, verify sidebar opens with Content tab active, send message "Make my second bullet point more impactful", verify AI response appears within 5 seconds, verify response is conversational (contains encouraging language), switch to Design tab, type "change background color to light gray", click Apply Change, verify success toast appears, verify design preview updates (check for gray background in DOM), close AI Assistant, verify sidebar closes and state persists, time full flow (target <10 minutes for upload → chat → design → apply)
- [x] **T018** [P] Write chat panel E2E test at `resume-builder-ai/tests/e2e/ai-assistant/chat-panel.spec.ts`: Test empty state displays with example prompts, test sending clear request ("rewrite my summary"), test sending vague request ("make it better") triggers clarifying question, test sending complex multi-part request, test error handling (network failure, timeout), test rate limiting (send 25 messages rapidly, verify 429 error after 20), test Enter key sends message, test Shift+Enter creates new line
- [x] **T019** [P] Write design panel E2E test at `resume-builder-ai/tests/e2e/ai-assistant/design-panel.spec.ts`: Test current template displays correctly, test suggestion buttons populate input field, test color change request ("make header blue"), test font change request ("use Roboto font"), test layout change request ("switch to two-column"), test unsupported request returns error ("add dancing animations"), test ATS warning appears when score drops >10%, test undo functionality (not part of panel but integration point)

**Checkpoint**: All E2E tests pass - full user journey verified

---

## Phase 9: Unit Tests (Week 2, Day 7 continued)

**Purpose**: Test individual components and hooks in isolation

- [x] **T020** [P] Write ChatPanel unit tests at `resume-builder-ai/tests/unit/ai-assistant/ChatPanel.test.tsx`: Test component renders empty state, test component renders with messages, test send button click calls sendMessage, test Enter key press calls sendMessage, test Shift+Enter inserts newline, test loading state disables input, test error state displays toast
- [x] **T021** [P] Write DesignPanel unit tests at `resume-builder-ai/tests/unit/ai-assistant/DesignPanel.test.tsx`: Test component renders current template, test suggestion button click populates input, test apply button click calls applyCustomization, test loading state disables input, test success toast appears on success, test error toast appears on error
- [x] **T022** [P] Write useChatSession unit tests at `resume-builder-ai/tests/unit/hooks/useChatSession.test.ts`: Test hook fetches existing session, test hook creates new session if none exists, test sendMessage calls API with correct params, test hook updates messages on response, test hook handles loading state, test hook handles error state
- [x] **T023** [P] Write useDesignCustomization unit tests at `resume-builder-ai/tests/unit/hooks/useDesignCustomization.test.ts`: Test hook fetches current design, test applyCustomization calls API with correct params, test hook updates design on success, test hook handles loading state, test hook handles error state, test hook returns ATS warnings

**Checkpoint**: 80%+ unit test coverage on new components and hooks

---

## Phase 10: UI Polish - Responsive Design (Week 2, Day 8)

**Purpose**: Ensure AI Assistant works on all screen sizes

**Dependencies**: Requires T005-T012 complete

- [x] **T024** Update AIAssistantSidebar for mobile responsiveness at `resume-builder-ai/src/components/ai-assistant/AIAssistantSidebar.tsx`: Add breakpoint logic (full screen width on <768px, 384px on ≥768px), add collapsible behavior (slide in from right), ensure touch targets are ≥44px (buttons, tabs), add horizontal scroll for long content (message bubbles), test on real device viewports (360px, 375px, 390px, 768px, 1024px), verify Tailwind responsive classes (sm:, md:, lg:) applied correctly
- [x] **T025** Add responsive styles to ChatPanel at `resume-builder-ai/src/components/ai-assistant/ChatPanel.tsx`: Stack input and button vertically on mobile (<640px), increase font size for mobile readability (16px min to prevent zoom), ensure message bubbles wrap correctly on narrow screens, add padding for safe areas (notch, home indicator on iOS)
- [x] **T026** Add responsive styles to DesignPanel at `resume-builder-ai/src/components/ai-assistant/DesignPanel.tsx`: Stack suggestion buttons vertically on mobile, increase touch target size for buttons (min 44x44px), ensure input field is large enough for thumb typing, add spacing for comfortable mobile interaction

**Checkpoint**: AI Assistant works smoothly on mobile and desktop - test on 3+ screen sizes

---

## Phase 11: UI Polish - Loading & Error States (Week 2, Day 8 continued)

**Purpose**: Provide clear feedback during async operations

**Dependencies**: Requires T005-T012 complete

- [x] **T027** Add loading skeleton to ChatPanel at `resume-builder-ai/src/components/ai-assistant/ChatPanel.tsx`: Show skeleton messages (3 placeholder bubbles with shimmer animation) while fetching message history, disable input and send button during sendMessage operation, show typing indicator (three animated dots) while waiting for AI response, add pulse animation to loading states
- [x] **T028** Add loading indicator to DesignPanel at `resume-builder-ai/src/components/ai-assistant/DesignPanel.tsx`: Disable apply button and show spinner during customization request, show progress bar for long operations (>2s), add success animation (checkmark fade-in) on successful customization, add error shake animation on failure
- [x] **T029** Improve error messages across all components: Replace technical errors with user-friendly messages ("Something went wrong" → "We couldn't connect to the server. Please check your internet connection."), add retry buttons for recoverable errors (network failures), add "Report Issue" link for unexpected errors, add rate limit warnings with countdown timer ("Too many requests. Please wait 30 seconds."), test error states with network throttling and API failures

**Checkpoint**: All loading and error states provide clear feedback - no silent failures

---

## Phase 12: UI Polish - Accessibility (Week 2, Day 9)

**Purpose**: Make AI Assistant accessible to all users

**Dependencies**: Requires T005-T012 complete

- [x] **T030** Add keyboard navigation to AIAssistantSidebar at `resume-builder-ai/src/components/ai-assistant/AIAssistantSidebar.tsx`: Support Esc key to close sidebar, support Tab key to navigate between tabs and inputs, support Arrow keys to navigate between suggestion buttons, trap focus inside sidebar when open (don't allow focus on elements behind sidebar), restore focus to trigger button when closed, add ARIA labels to all interactive elements
- [x] **T031** Add accessibility to ChatPanel at `resume-builder-ai/src/components/ai-assistant/ChatPanel.tsx`: Add ARIA live region for new messages (screen reader announces new AI responses), add ARIA labels to send button ("Send message"), input ("Type your message here"), add role="log" to message history container, ensure color contrast meets WCAG AA (4.5:1 for normal text), add skip link to jump to message input
- [x] **T032** Add accessibility to DesignPanel at `resume-builder-ai/src/components/ai-assistant/DesignPanel.tsx`: Add ARIA labels to all buttons and inputs, add role="status" to success/error messages, add aria-live="polite" to current template display (announces changes), ensure focus indicators are visible (outline on keyboard focus), add descriptive alt text to any icons or images

**Checkpoint**: AI Assistant passes WCAG AA compliance - test with screen reader (NVDA/JAWS)

---

## Phase 13: Documentation & Deployment (Week 2, Day 10)

**Purpose**: Update documentation and prepare for production deployment

- [ ] **T033** [P] Update CLAUDE.md at `resume-builder-ai/CLAUDE.md`: Add "Feature 006 - AI Resume Assistant" section under Recent Changes, document new components (`AIAssistantSidebar`, `ChatPanel`, `DesignPanel`), document new hooks (`useChatSession`, `useDesignCustomization`), update directory structure to show `src/components/ai-assistant/`, add development patterns for integration projects, include note that 80% of functionality comes from Features 002/003
- [ ] **T034** [P] Add inline JSDoc comments to all components: Add JSDoc to `AIAssistantSidebar.tsx` (describe props, component purpose), add JSDoc to `ChatPanel.tsx` (describe behavior, API calls), add JSDoc to `DesignPanel.tsx` (describe customization flow), add JSDoc to both hooks (describe parameters, return values), add examples in JSDoc for common usage patterns
- [ ] **T035** [P] Create user help content: Add help tooltip to AI Assistant sidebar (triggered by ? icon), include example prompts for content editing ("Make my second bullet point more impactful", "Add project management keywords to experience"), include example prompts for design ("Change header color to navy blue", "Use Roboto font for headings"), add troubleshooting tips ("If AI doesn't respond, try rephrasing your request"), add link to full documentation
- [ ] **T036** Add feature flag for gradual rollout: Add `ENABLE_AI_ASSISTANT` environment variable (default false), conditionally render "Open AI Assistant" button based on flag, add admin override to enable for specific users (via profiles.features JSONB column), add monitoring for feature flag checks (track how many users see the button)
- [ ] **T037** Run full test suite before deployment: Run `npm run lint` and fix all errors, run `npm run build` and verify no TypeScript errors, run `npm test` and verify all unit tests pass, run E2E tests and verify all pass, run performance tests and verify targets met (<3s chat, <2s design preview), manually test on 3 browsers (Chrome, Firefox, Safari) and 2 screen sizes (mobile, desktop)
- [ ] **T038** Deploy to staging with monitoring: Deploy branch to staging environment, enable feature flag for internal team only, test full flow manually (upload → chat → design → apply → export), monitor error logs for 24 hours, gather feedback from 5+ team members, fix critical bugs before production
- [ ] **T039** Gradual production rollout: Deploy to production with feature flag disabled, enable for 10% of users (via random assignment), monitor success criteria for 48 hours (SC-001: session time, SC-002: acceptance rate, SC-003: preview speed), if metrics good, roll out to 50% of users, monitor for another 48 hours, if metrics still good, enable for 100% of users, announce feature via email/blog post

**Checkpoint**: AI Assistant deployed to production - monitoring shows healthy metrics

---

## Dependencies & Execution Order

### Sequential Dependencies

**Must Run in Order** (blocking dependencies):
1. **T001-T004** (Setup) → MUST complete before any development
2. **T005-T008** (Components) → MUST complete before hooks (T009-T010)
3. **T009-T010** (Hooks) → MUST complete before integration (T011-T012)
4. **T011-T012** (Integration) → MUST complete before enhanced prompts (T013-T014)
5. **T013-T014** (Prompts) → MUST complete before duplicate detection (T015)
6. **T015** (Duplicate Detection) → MUST complete before integration point (T016)
7. **T016** (Integration Point) → MUST complete before E2E tests (T017-T019)
8. **T017-T019** (E2E Tests) → MUST complete before UI polish (T024-T032)
9. **T024-T032** (UI Polish) → MUST complete before documentation (T033-T039)
10. **T033-T037** (Documentation) → MUST complete before deployment (T038-T039)

### Parallel Execution Groups

**Group 1: Setup (can run in parallel)**
```bash
# All setup tasks are independent
Task T001 & Task T002 & Task T003 & Task T004
```

**Group 2: Core Components (can run in parallel)**
```bash
# All components are separate files
Task T005 & Task T006 & Task T007
# Then T008 (depends on all three)
```

**Group 3: Hooks (can run in parallel)**
```bash
# Hooks are separate files
Task T009 & Task T010
```

**Group 4: E2E Tests (can run in parallel after T016)**
```bash
# E2E tests are separate files
Task T017 & Task T018 & Task T019
```

**Group 5: Unit Tests (can run in parallel after T017-T019)**
```bash
# Unit tests are separate files
Task T020 & Task T021 & Task T022 & Task T023
```

**Group 6: Documentation (can run in parallel after T032)**
```bash
# Documentation files are separate
Task T033 & Task T034 & Task T035
```

---

## Execution Guidance

### Week 1: UI Integration (5 days)

**Day 1-2**: Foundation (T001-T008)
```bash
# Start setup in parallel
Task T001 & Task T002 & Task T003 & Task T004

# Then build components in parallel
Task T005 & Task T006 & Task T007
Task T008  # Quick barrel export
```

**Day 3**: API Integration (T009-T012)
```bash
# Build hooks in parallel
Task T009 & Task T010

# Then integrate sequentially (same files)
Task T011
Task T012
```

**Day 4**: Enhanced Prompts (T013-T014)
```bash
# Careful: modifying existing code
Task T013  # Version prompts first
Task T014  # Then add clarifying logic
```

**Day 5**: Duplicate Detection & Integration Point (T015-T016)
```bash
Task T015  # Duplicate detection
Task T016  # Add to optimization page
```

### Week 2: Testing & Polish (5 days)

**Day 6-7**: Testing (T017-T023)
```bash
# E2E tests in parallel
Task T017 & Task T018 & Task T019

# Unit tests in parallel
Task T020 & Task T021 & Task T022 & Task T023
```

**Day 8-9**: UI Polish (T024-T032)
```bash
# Responsive design
Task T024
Task T025
Task T026

# Loading & error states
Task T027
Task T028
Task T029

# Accessibility
Task T030
Task T031
Task T032
```

**Day 10**: Documentation & Deployment (T033-T039)
```bash
# Documentation in parallel
Task T033 & Task T034 & Task T035

# Deployment sequentially
Task T036  # Feature flag
Task T037  # Test suite
Task T038  # Staging
Task T039  # Production
```

---

## Risk Mitigation

### High-Risk Tasks

**T013-T014: Enhanced Prompts**
- **Risk**: Breaking existing Features 002/003 functionality
- **Mitigation**: Version prompts, run comprehensive tests before/after, A/B test in production
- **Rollback**: Revert to v1 prompts via feature flag

**T015: Duplicate Detection**
- **Risk**: Breaking existing application creation flow
- **Mitigation**: Maintain backward compatibility (bypass check with ?confirm=true), add unit tests
- **Rollback**: Remove duplicate check logic, keep 409 handling

**T038-T039: Deployment**
- **Risk**: Production issues affecting all users
- **Mitigation**: Gradual rollout (10% → 50% → 100%), monitor metrics closely, feature flag for instant disable
- **Rollback**: Disable feature flag immediately if issues detected

---

## Success Criteria Verification

**After T039 (Production Rollout)**, verify these metrics:

- **SC-001**: Full session <10 min - Measure with Playwright performance API during T017
- **SC-002**: 90% acceptance rate - Query `amendment_requests` table: `SELECT COUNT(*) FILTER (WHERE status='applied') * 100.0 / COUNT(*) FROM amendment_requests WHERE created_at > NOW() - INTERVAL '7 days'`
- **SC-003**: Design preview <2s - Measure with `performance.now()` before/after API call in T019
- **SC-004**: Clarifying questions <20% - Query messages: `SELECT COUNT(*) FILTER (WHERE metadata->>'requires_clarification' = 'true') * 100.0 / COUNT(*) FROM chat_messages WHERE sender='ai' AND created_at > NOW() - INTERVAL '7 days'`
- **SC-005**: 100% history accuracy - Manual verification during T018 (check 10 saved applications)
- **SC-006**: Zero fabrication - Manual audit during T018 (review 20 chat amendments for invented content)
- **SC-007**: 85% complete apply - Query: `SELECT COUNT(DISTINCT user_id) FROM applications WHERE created_at > NOW() - INTERVAL '7 days'` / `SELECT COUNT(DISTINCT user_id) FROM optimizations WHERE created_at > NOW() - INTERVAL '7 days'`
- **SC-008**: 100% error handling - Verify during T017-T019 (no uncaught exceptions in E2E tests)

---

## Definition of Done

Each task is complete when:
- ✅ Code is written and follows TypeScript strict mode
- ✅ All ESLint warnings resolved
- ✅ Unit tests written and passing (where applicable)
- ✅ Integration/E2E tests passing (where applicable)
- ✅ Code reviewed by peer (for T013-T015 critical tasks)
- ✅ Documentation updated (inline comments + external docs)
- ✅ Manual testing completed (for UI tasks)
- ✅ Accessibility verified (for T030-T032)
- ✅ Performance benchmarks met (for T017-T019)
- ✅ No regressions in existing features (especially T013-T015)

---

## Estimated Effort Breakdown

| Phase | Tasks | Estimated Days | Priority |
|-------|-------|----------------|----------|
| **Phase 1: Setup** | T001-T004 | 0.5 days | HIGH |
| **Phase 2: Core Components** | T005-T008 | 2 days | HIGH |
| **Phase 3-4: Hooks & Integration** | T009-T012 | 1 day | HIGH |
| **Phase 5: Enhanced Prompts** | T013-T014 | 1 day | HIGH |
| **Phase 6-7: Duplicate Detection & Integration** | T015-T016 | 0.5 days | MEDIUM |
| **Phase 8-9: E2E & Unit Tests** | T017-T023 | 2 days | HIGH |
| **Phase 10-12: UI Polish** | T024-T032 | 2 days | MEDIUM |
| **Phase 13: Documentation & Deployment** | T033-T039 | 1 day | HIGH |
| **TOTAL** | **39 tasks** | **10 days** | - |

**Confidence**: High (80% reusing existing infrastructure)

---

## Notes for Implementers

1. **This is an integration project** - Most code already exists. Focus on UI and connections.
2. **Test existing APIs first** (T001-T003) - Don't assume they work, verify before building on top.
3. **Version prompts carefully** (T013) - Changing AI behavior is risky, always have rollback plan.
4. **Don't break backward compatibility** (T015) - Existing applications flow must keep working.
5. **Parallel execution is key** - Many tasks can run simultaneously, saving days of work.
6. **Mobile-first design** (T024-T026) - 60% of users are on mobile, prioritize mobile UX.
7. **Accessibility is not optional** (T030-T032) - WCAG AA compliance required for all users.
8. **Gradual rollout** (T038-T039) - Never enable for 100% of users at once, monitor and iterate.

**Ready to begin implementation? Start with Phase 1 (T001-T004) to verify prerequisites, then move to Phase 2 (T005-T008) to build core components.**
