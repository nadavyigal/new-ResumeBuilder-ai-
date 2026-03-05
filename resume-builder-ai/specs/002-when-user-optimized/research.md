# Research: AI Chat Resume Iteration

**Feature**: 002-when-user-optimized
**Date**: 2025-10-06
**Status**: Complete

## Research Questions

This document captures research decisions made during Phase 0 planning for the AI Chat Resume Iteration feature. All decisions follow the constitution's simplicity principle (YAGNI) and are informed by existing project architecture.

##1. AI Model Selection

**Question**: Should chat use the same OpenAI model as optimization (GPT-4) or a different model (GPT-3.5-turbo) for cost savings?

**Decision**: Use GPT-4 (same as resume optimization)

**Rationale**:
- **Consistency**: Resume quality and tone remain consistent across optimization and chat-based amendments
- **Accuracy**: GPT-4 better understands complex, nuanced requests (e.g., "make more leadership-focused" vs. simple "add skill X")
- **Safety**: Higher accuracy in maintaining factual boundaries reduces risk of fabricating experience
- **Context Understanding**: Better preserves original resume context when making targeted changes
- **Cost Acceptable**: Freemium model limits usage (1 free optimization + chat), premium users justify cost

**Alternatives Considered**:
| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| GPT-3.5-turbo | Lower cost (~10x cheaper) | Less accurate for nuanced amendments, higher risk of tone inconsistency | Quality degradation not worth cost savings given freemium limits |
| Hybrid (GPT-4 for complex, GPT-3.5 for simple) | Optimizes cost | Complexity in routing logic, user confusion on quality variance | Violates YAGNI - premature optimization |

**Implementation Notes**:
- Use existing OpenAI SDK configuration from ai-optimizer library
- Share API key and rate limiting infrastructure
- Monitor token usage for cost tracking

---

## 2. Diff Algorithm for Change Visualization

**Question**: What library/approach should be used to visualize resume changes (additions, deletions, modifications)?

**Decision**: react-diff-viewer + diff-match-patch

**Rationale**:
- **Ready-Made Solution**: react-diff-viewer provides pre-built React component with line-by-line diff display
- **Proven Algorithm**: diff-match-patch is industry-standard text comparison library (used by Google)
- **Visual Clarity**: Built-in color coding (green for additions, red for deletions, yellow for modifications)
- **Accessibility**: Supports keyboard navigation, screen reader compatibility
- **Low Maintenance**: Actively maintained open-source projects

**Alternatives Considered**:
| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Custom diff implementation | Full control over rendering | Reinvents wheel, high maintenance burden | Violates YAGNI and simplicity principles |
| Simple text highlighting | Very simple | Doesn't show deletions clearly, poor UX for complex changes | Insufficient for resume editing use case |
| jsdiff (raw library) | Lightweight | Requires custom React component, more work | react-diff-viewer already wraps this |

**Implementation Notes**:
- Install: `npm install react-diff-viewer diff-match-patch`
- Component: `src/components/chat/ChangeDiff.tsx`
- Use side-by-side view for larger screens, unified for mobile

---

## 3. Real-Time Update Mechanism

**Question**: How should AI responses and resume updates be delivered to the client? WebSocket, Server-Sent Events (SSE), or polling?

**Decision**: Server-Sent Events (SSE) for AI streaming, React state for UI updates

**Rationale**:
- **Simplicity**: SSE is simpler than WebSockets for one-way server-to-client streaming
- **Native Support**: OpenAI SDK supports streaming responses natively via SSE
- **Deployment**: SSE works on Vercel without additional infrastructure (WebSockets require persistent connections)
- **User Experience**: Streaming AI responses feel more responsive than waiting for full response
- **State Management**: React state sufficient for local resume preview updates (no need for real-time multi-user sync)

**Alternatives Considered**:
| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| WebSockets | Bidirectional, real-time | Overcomplicated for one-way streaming, harder to deploy on serverless | Unnecessary bidirectional communication |
| HTTP Polling | Very simple | Poor UX (delayed updates), unnecessary server load | Inferior user experience |
| Long Polling | Better than regular polling | Still inefficient, outdated pattern | SSE is modern standard for this use case |

**Implementation Notes**:
- API route returns `ReadableStream` for SSE
- Frontend uses `EventSource` or fetch with stream reading
- Fallback to regular HTTP for browsers without SSE support (rare)

---

## 4. Session Management Strategy

**Question**: How should chat sessions be scoped? One global session per user, one session per resume, or multiple concurrent sessions?

**Decision**: One active session per optimization_id, enforced by database unique constraint

**Rationale**:
- **Natural Boundary**: Each resume optimization represents a distinct conversation context
- **Database Enforcement**: Unique constraint on `(user_id, optimization_id)` prevents multiple active sessions per resume
- **Parallel Workflows**: Users can refine multiple resumes simultaneously (each has own session)
- **Clear Context**: AI always knows which resume version is being discussed
- **Simplified UX**: No ambiguity about which session applies changes to which resume

**Alternatives Considered**:
| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Multiple sessions per resume | Maximum flexibility | Confusing UX - which session's changes apply? Database complexity | Violates simplicity, unclear user benefit |
| Global single session | Simplest | Can't work on multiple resumes in parallel, context confusion | Poor UX for users with multiple job applications |
| Session per user (cross-resume) | Continuous conversation | Loses resume-specific context, ambiguous references | Doesn't match mental model of resume editing |

**Implementation Notes**:
- Database schema: `UNIQUE INDEX idx_active_session ON chat_sessions(user_id, optimization_id) WHERE status = 'active'`
- When user opens chat on resume, either resume existing active session or create new one
- Closing chat marks session as 'closed' but preserves history

---

## 5. Chat History Search

**Question**: Should chat history support full-text search, or only chronological display?

**Decision**: Chronological display only (no search in MVP)

**Rationale**:
- **YAGNI**: No user story or requirement specifies searching old chat messages
- **Limited History**: 30-day retention limits total history size
- **Natural Scope**: Sessions tied to specific resume, already narrowly scoped
- **Future-Proof**: Can add Postgres full-text search later if user research shows need
- **Reduced Complexity**: Avoids indexing, query parsing, search UI in MVP

**Alternatives Considered**:
| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Postgres full-text search | Native DB capability | Added complexity, index maintenance, no proven need | Premature optimization |
| Elasticsearch integration | Powerful search | Massive overkill, operational overhead | Violates simplicity for unproven need |
| Client-side filtering | Simple | Poor performance for large histories | 30-day limit makes this unnecessary |

**Implementation Notes**:
- Simple `ORDER BY created_at DESC` query
- Pagination for sessions with 100+ messages (unlikely but future-proof)
- If search needed later: Add `tsvector` column to `chat_messages`, create GIN index

---

## 6. Resume Versioning Strategy

**Question**: How should resume versions be stored? Full snapshots, incremental diffs, or hybrid approach?

**Decision**: Full resume content snapshots for each version

**Rationale**:
- **Simplicity**: Storing complete resume JSON avoids complex diff application logic
- **Undo Reliability**: Can revert to any version instantly without replaying diffs
- **Query Performance**: No need to reconstruct resume by applying sequential diffs
- **Storage Cost**: Acceptable given JSON compression and Supabase storage limits
- **Debugging**: Easy to inspect any version's complete state

**Alternatives Considered**:
| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Incremental diffs only | Minimal storage | Complex reconstruction, error-prone, harder debugging | Premature optimization, maintenance burden |
| Hybrid (snapshots + diffs) | Best of both worlds | Most complex implementation | Violates YAGNI - no evidence of storage constraint |
| Event sourcing | Audit trail, time travel | Massive complexity for feature scope | Over-engineering |

**Implementation Notes**:
- Store in `resume_versions.content::JSONB`
- Index on `(optimization_id, version_number)` for efficient lookup
- Postgres JSONB compression handles storage efficiency

---

## Technology Decisions Summary

| Decision Area | Chosen Solution | Key Rationale |
|---------------|----------------|---------------|
| AI Model | GPT-4 | Consistency, accuracy, safety |
| Diff Visualization | react-diff-viewer | Ready-made, accessible, maintained |
| Real-Time Updates | Server-Sent Events | Simple, native OpenAI support, Vercel compatible |
| Session Management | One per optimization_id | Natural boundary, parallel workflows |
| Chat Search | None (chronological only) | YAGNI, limited history scope |
| Resume Versioning | Full snapshots | Simplicity, undo reliability |

---

## Remaining Unknowns

**None** - All research questions resolved. Ready for Phase 1 (Design & Contracts).

---

## References

- OpenAI API Documentation: https://platform.openai.com/docs/api-reference/streaming
- react-diff-viewer: https://github.com/praneshr/react-diff-viewer
- diff-match-patch: https://github.com/google/diff-match-patch
- Server-Sent Events Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
- Supabase Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
