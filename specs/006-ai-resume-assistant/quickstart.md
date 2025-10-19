# Quickstart Guide: AI Resume Assistant Integration

**Feature**: 006-ai-resume-assistant
**Estimated Time**: 1-2 weeks
**Prerequisites**: Features 002, 003, and 005 must be deployed

## Overview

This is **NOT a new feature build** - it's an integration project that unifies existing chat (Feature 002) and design (Feature 003) systems under a single "AI Resume Assistant" interface.

**What already exists**: 95% of backend functionality (APIs, database, business logic)
**What you'll build**: Unified UI components and enhanced AI prompts

---

## Prerequisites Checklist

Before starting, verify these features are deployed:

- ✅ **Feature 002** (Chat Resume Iteration) - `/api/v1/chat` endpoints operational
- ✅ **Feature 003** (Design Selection & Customization) - `/api/v1/design` endpoints operational
- ✅ **Feature 005** (History View) - `/dashboard/history` page working
- ✅ **Database migrations** applied (chat_sessions, design_templates, applications tables exist)
- ✅ **OpenAI API** configured with valid key
- ✅ **Supabase** authentication working

**Verification Commands**:
```bash
# From resume-builder-ai directory
cd resume-builder-ai

# Check if migrations applied
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -c "\dt chat_sessions; \dt design_templates; \dt applications;"

# Verify API endpoints respond
curl http://localhost:3000/api/v1/chat/sessions -H "Cookie: sb-access-token=..."
curl http://localhost:3000/api/v1/design/templates

# Check OpenAI key
echo $OPENAI_API_KEY  # Should not be empty
```

---

## Quick Start (4 hours - MVP)

### Step 1: Create AI Assistant UI Component (2 hours)

**Goal**: Build unified interface combining chat and design panels

```typescript
// File: src/components/ai-assistant/AIAssistantSidebar.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatPanel from './ChatPanel';
import DesignPanel from './DesignPanel';

interface AIAssistantSidebarProps {
  optimizationId: string;
  onClose?: () => void;
}

export default function AIAssistantSidebar({ optimizationId, onClose }: AIAssistantSidebarProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'design'>('content');

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-xl border-l flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Resume Assistant</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'content' | 'design')} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2">
          <TabsTrigger value="content">Content Editing</TabsTrigger>
          <TabsTrigger value="design">Visual Design</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="flex-1 overflow-hidden">
          <ChatPanel optimizationId={optimizationId} />
        </TabsContent>

        <TabsContent value="design" className="flex-1 overflow-hidden">
          <DesignPanel optimizationId={optimizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Acceptance Test**:
```bash
# Navigate to optimization detail page
# Open AI Assistant sidebar
# Verify two tabs: "Content Editing" and "Visual Design"
# Switch between tabs - both should load without errors
```

---

### Step 2: Implement Chat Panel (1 hour)

**Goal**: Connect to existing `/api/v1/chat` endpoint with improved prompts

```typescript
// File: src/components/ai-assistant/ChatPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatSession } from '@/hooks/useChatSession';

interface ChatPanelProps {
  optimizationId: string;
}

export default function ChatPanel({ optimizationId }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const { session, messages, sendMessage, loading } = useChatSession(optimizationId);

  const handleSend = async () => {
    if (!message.trim()) return;
    await sendMessage(message);
    setMessage('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-medium mb-2">Let's make your resume shine! ✨</p>
            <p className="text-sm">Ask me to improve any section, add keywords, or rephrase content.</p>
            <div className="mt-4 space-y-2 text-left">
              <p className="text-xs"><strong>Try:</strong></p>
              <p className="text-xs text-gray-600">• "Make my second bullet point more impactful"</p>
              <p className="text-xs text-gray-600">• "Add project management keywords to my experience"</p>
              <p className="text-xs text-gray-600">• "Rewrite my summary to emphasize leadership"</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`mb-4 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block rounded-lg px-4 py-2 max-w-[85%] ${
              msg.sender === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}>
              {msg.content}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(msg.created_at).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask me to improve your resume..."
          className="mb-2"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={loading || !message.trim()} className="w-full">
          {loading ? 'Thinking...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
```

**Acceptance Test**:
```bash
# Open AI Assistant → Content Editing tab
# Verify empty state shows encouraging message
# Type "Make my first bullet point more impactful" and send
# Verify AI response appears within 3 seconds
# Verify response is conversational and supportive
```

---

### Step 3: Implement Design Panel (30 min)

**Goal**: Connect to existing `/api/v1/design` endpoints with natural language input

```typescript
// File: src/components/ai-assistant/DesignPanel.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDesignCustomization } from '@/hooks/useDesignCustomization';
import { toast } from '@/components/ui/use-toast';

interface DesignPanelProps {
  optimizationId: string;
}

export default function DesignPanel({ optimizationId }: DesignPanelProps) {
  const [request, setRequest] = useState('');
  const { currentDesign, applyCustomization, loading } = useDesignCustomization(optimizationId);

  const handleCustomize = async () => {
    if (!request.trim()) return;

    const result = await applyCustomization(request);
    if (result.success) {
      toast({
        title: 'Design updated!',
        description: result.message || 'Your changes have been applied.',
      });
      setRequest('');
    } else {
      toast({
        title: 'Unable to apply change',
        description: result.message || 'Please try rephrasing your request.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Current Template */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700">Current Template</p>
        <p className="text-lg font-semibold">{currentDesign?.template_display_name || 'Minimal'}</p>
      </div>

      {/* Natural Language Input */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          What would you like to change?
        </label>
        <Input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="e.g., 'change background color to navy blue'"
          className="mb-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCustomize();
            }
          }}
        />
        <Button onClick={handleCustomize} disabled={loading || !request.trim()} className="w-full">
          {loading ? 'Applying...' : 'Apply Change'}
        </Button>
      </div>

      {/* Suggestions */}
      <div className="flex-1 overflow-auto">
        <p className="text-sm font-medium text-gray-700 mb-2">Try these:</p>
        <div className="space-y-2">
          {['Change header color to dark blue', 'Use Roboto font for headings', 'Switch to two-column layout'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setRequest(suggestion)}
              className="w-full text-left px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Test**:
```bash
# Open AI Assistant → Visual Design tab
# Verify current template name displays
# Click "Change header color to dark blue"
# Verify input field populates with suggestion
# Click "Apply Change"
# Verify success toast appears
# Verify preview updates with new color
```

---

### Step 4: Test End-to-End Flow (30 min)

**Full User Journey**:
```
1. Navigate to optimization detail page
2. Click "Open AI Assistant" button
3. Content Editing tab:
   - Send message: "Make my second bullet point more impactful"
   - Verify AI provides 2-3 alternative phrasings
   - Click "Apply" on one option
   - Verify preview updates immediately
4. Visual Design tab:
   - Type: "change background color to light gray"
   - Click "Apply Change"
   - Verify preview updates with new background
5. Close AI Assistant
6. Click "Download PDF"
7. Verify PDF has both content and design changes
```

**Pass Criteria**:
- ✅ Full flow completes in <10 minutes
- ✅ AI responses feel conversational
- ✅ No errors in console
- ✅ Changes persist after page reload

---

## Development Phases

### Week 1: Core Integration

**Day 1-2: UI Components**
- ✅ Create `AIAssistantSidebar` component
- ✅ Create `ChatPanel` component
- ✅ Create `DesignPanel` component
- ✅ Add to optimization detail page
- ✅ Wire up existing API endpoints

**Day 3-4: Enhanced Prompts**
- ✅ Update OpenAI system prompts for more conversational tone
- ✅ Add clarifying question logic (when user request is vague)
- ✅ Test prompt changes don't break existing functionality
- ✅ Add acceptance tracking for amendments (SC-002)

**Day 5: Duplicate Detection**
- ✅ Add duplicate application check in `POST /api/applications`
- ✅ Show confirmation dialog when duplicate detected
- ✅ Allow user to proceed with `?confirm=true` param

---

### Week 2: Polish & Testing

**Day 6-7: E2E Tests**
- ✅ Test full user flow (upload → chat → design → apply)
- ✅ Test clarifying questions appear correctly
- ✅ Test duplicate detection scenarios
- ✅ Performance testing (ensure <2s responses)

**Day 8-9: UI Polish**
- ✅ Responsive design for mobile (collapsible sidebar)
- ✅ Loading states and skeleton screens
- ✅ Error handling and user-friendly messages
- ✅ Accessibility (keyboard navigation, ARIA labels)

**Day 10: Documentation & Deployment**
- ✅ Update CLAUDE.md with AI Assistant feature
- ✅ Add inline comments for prompt logic
- ✅ Create user guide (help tooltip in UI)
- ✅ Deploy to staging and test
- ✅ Deploy to production with feature flag

---

## File Structure

```
resume-builder-ai/
├── src/
│   ├── components/
│   │   └── ai-assistant/
│   │       ├── AIAssistantSidebar.tsx   # Main sidebar component
│   │       ├── ChatPanel.tsx             # Content editing panel
│   │       ├── DesignPanel.tsx           # Visual customization panel
│   │       └── index.ts                  # Exports
│   ├── hooks/
│   │   ├── useChatSession.ts             # Hook for chat API
│   │   └── useDesignCustomization.ts     # Hook for design API
│   ├── lib/
│   │   └── prompts/
│   │       └── resume-optimizer.ts       # Enhanced prompts (update existing)
│   └── app/
│       └── dashboard/
│           └── optimizations/
│               └── [id]/
│                   └── page.tsx          # Add AI Assistant button
└── tests/
    └── e2e/
        └── ai-assistant/
            └── full-flow.spec.ts         # E2E test
```

---

## Testing Checklist

### Unit Tests
- [ ] ChatPanel renders empty state correctly
- [ ] ChatPanel sends messages to correct endpoint
- [ ] DesignPanel applies customizations correctly
- [ ] Error states display user-friendly messages

### Integration Tests
- [ ] Chat API returns conversational responses
- [ ] Design API applies changes correctly
- [ ] Duplicate detection works correctly
- [ ] Changes persist after page reload

### E2E Tests
- [ ] Full flow: upload → chat → design → apply → export
- [ ] Clarifying questions appear when request is vague
- [ ] Design changes render within 2s
- [ ] Duplicate warning appears correctly
- [ ] Application history persists correctly

### Performance Tests
- [ ] Chat response time <3s (SC-003 equivalent)
- [ ] Design preview renders <2s (SC-003)
- [ ] Page load with AI Assistant <2s additional overhead
- [ ] No memory leaks after 100+ messages

---

## Common Pitfalls

### Pitfall 1: Treating as New Feature

**Problem**: Building from scratch instead of integrating existing systems

**Solution**: **Always check if endpoint exists first**. 95% of backend is already built.

**Verification**:
```bash
# Before writing new API route, check:
ls src/app/api/v1/chat/
ls src/app/api/v1/design/

# Before writing new database query, check:
grep -r "chat_sessions" src/lib/supabase/
grep -r "design_customizations" src/lib/supabase/
```

---

### Pitfall 2: Changing Existing Prompts Without Tests

**Problem**: Updating OpenAI prompts breaks existing functionality

**Solution**: **Version prompts and A/B test**

**Implementation**:
```typescript
// File: src/lib/prompts/resume-optimizer.ts

export const CHAT_PROMPTS = {
  v1_functional: `You are a resume optimization assistant...`,
  v2_conversational: `You're a friendly career coach helping users shine...`,
};

// Feature flag to switch versions
const PROMPT_VERSION = process.env.CHAT_PROMPT_VERSION || 'v1_functional';

export function getChatPrompt() {
  return CHAT_PROMPTS[PROMPT_VERSION];
}
```

**Test Before Rollout**:
1. Run existing integration tests with new prompt
2. Manually test 10 common requests (e.g., "make it better", "add keywords")
3. Deploy to staging with v2, monitor for 24 hours
4. Roll out to production gradually (10% → 50% → 100%)

---

### Pitfall 3: Not Handling Rate Limits

**Problem**: AI Assistant triggers rate limit errors (20 req/min on `/api/v1/chat`)

**Solution**: **Debounce user input + show rate limit warnings**

**Implementation**:
```typescript
// In ChatPanel.tsx
const [rateLimitWarning, setRateLimitWarning] = useState(false);

const handleSend = async () => {
  try {
    await sendMessage(message);
  } catch (error) {
    if (error.status === 429) {
      setRateLimitWarning(true);
      toast({
        title: 'Slow down!',
        description: 'You\'re sending messages too quickly. Please wait 30 seconds.',
        variant: 'destructive',
      });
    }
  }
};
```

---

### Pitfall 4: Forgetting Duplicate Detection

**Problem**: Users accidentally apply to same job twice

**Solution**: **Implement duplicate check with user confirmation**

**Implementation**:
```typescript
// In Apply Resume flow
async function handleApplyResume(optimizationId: string) {
  const response = await fetch('/api/applications', {
    method: 'POST',
    body: JSON.stringify({ optimization_id: optimizationId }),
  });

  if (response.status === 409) {
    const data = await response.json();
    const confirmed = await confirmDialog({
      title: 'Duplicate Application',
      message: data.message,
    });

    if (confirmed) {
      // Retry with ?confirm=true
      await fetch('/api/applications?confirm=true', {
        method: 'POST',
        body: JSON.stringify({ optimization_id: optimizationId }),
      });
    }
  }
}
```

---

## Debugging Commands

```bash
# Check if chat endpoint responds
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{"optimization_id":"UUID","message":"test"}'

# Check if design endpoint responds
curl http://localhost:3000/api/v1/design/templates

# Check database tables exist
psql -h localhost -U postgres -c "SELECT * FROM chat_sessions LIMIT 1;"
psql -h localhost -U postgres -c "SELECT * FROM design_templates LIMIT 1;"
psql -h localhost -U postgres -c "SELECT * FROM applications LIMIT 1;"

# Check OpenAI API key
node -e "console.log(process.env.OPENAI_API_KEY ? 'Set' : 'Not set')"

# Tail logs for errors
tail -f .next/server-logs.txt | grep ERROR
```

---

## Performance Optimization Tips

1. **Lazy load AI Assistant**: Don't mount until user clicks "Open AI Assistant"
2. **Paginate messages**: Load last 20 messages, fetch more on scroll
3. **Debounce design preview**: Wait 500ms after customization before re-rendering
4. **Cache design templates**: Store in React Query with 1-hour cache
5. **Optimistic updates**: Apply chat amendments immediately, revert if API fails

---

## Success Criteria Verification

### SC-001: Full session in <10 minutes

**Test**:
```bash
# Time the full flow from upload to export
# Target: <10 minutes
```

**Pass**: Average time <10 min for 10 users

---

### SC-002: 90% acceptance rate

**Test**:
```sql
-- Check acceptance rate for amendments
SELECT
  COUNT(*) FILTER (WHERE status = 'applied') * 100.0 / COUNT(*) AS acceptance_rate
FROM amendment_requests
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Pass**: Acceptance rate ≥90%

---

### SC-003: Design preview in <2s

**Test**:
```typescript
// Measure preview render time
const start = performance.now();
await fetch(`/api/v1/design/templates/${templateId}/preview?optimization_id=${optId}`);
const end = performance.now();
console.log(`Preview rendered in ${end - start}ms`);
```

**Pass**: p95 render time <2000ms

---

### SC-006: Zero fabrication

**Test**:
```typescript
// Manually audit 100 chat amendments
// Verify all suggestions are based on existing resume content
// Flag any AI responses that invent experience/achievements
```

**Pass**: 0 fabrication instances in 100 amendments

---

## Next Steps After Quickstart

1. **Monitor Success Criteria**: Set up dashboards for SC-001 through SC-008
2. **Gather User Feedback**: Add feedback widget in AI Assistant
3. **Iterate on Prompts**: A/B test conversational vs. functional prompts
4. **Add Advanced Features**:
   - Voice input for chat messages
   - Side-by-side diff view for content changes
   - Design template recommendations based on industry
5. **Scale Up**: Increase rate limits for premium users

---

## Support Resources

- **API Documentation**: `specs/006-ai-resume-assistant/contracts/api-ai-assistant.md`
- **Data Model**: `specs/006-ai-resume-assistant/data-model.md`
- **Research**: `specs/006-ai-resume-assistant/research.md`
- **Feature 002 Docs**: `specs/002-chat-resume-iteration/` (chat system)
- **Feature 003 Docs**: `specs/003-design-selection/` (design system)
- **Feature 005 Docs**: `specs/005-history-view-previous/` (history dashboard)

---

## Estimated Effort Summary

| Phase | Days | Key Deliverables |
|-------|------|------------------|
| **Week 1: Core Integration** | 5 | AI Assistant UI, enhanced prompts, duplicate detection |
| **Week 2: Polish** | 5 | E2E tests, UI polish, documentation, deployment |
| **Total** | **10 days** | **Fully integrated AI Resume Assistant** |

**Confidence**: High - 95% of functionality already exists, integration is straightforward.
