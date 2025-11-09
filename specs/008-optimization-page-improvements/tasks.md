# Implementation Tasks: Optimization Page Improvements

## Task Breakdown

### Epic 1: Numbered ATS Tips Display
**Estimated Time:** 30 minutes  
**Priority:** P0 (Blocker for tip implementation)

---

#### Task 1.1: Update SuggestionsList Component
**File:** `src/components/ats/SuggestionsList.tsx`  
**Estimated Time:** 15 minutes

**Changes:**
1. Add props: `showNumbers?: boolean`, `appliedSuggestionIds?: string[]`
2. Update `SuggestionCard` to accept index parameter
3. Add numbered badge before suggestion text
4. Add visual indicator for applied tips

**Implementation:**
```typescript
interface SuggestionsListProps {
  suggestions: Suggestion[];
  onApplySuggestion?: (suggestion: Suggestion) => void;
  maxSuggestions?: number;
  title?: string;
  showNumbers?: boolean;                // NEW
  appliedSuggestionIds?: string[];      // NEW
}

function SuggestionCard({
  suggestion,
  index,                                // NEW
  onApply,
  isApplied,                            // NEW
}: {
  suggestion: Suggestion;
  index?: number;                       // NEW
  onApply?: (suggestion: Suggestion) => void;
  isApplied?: boolean;                  // NEW
}) {
  return (
    <div className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${isApplied ? 'bg-green-50 border-green-300' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        {/* NEW: Number badge */}
        {index !== undefined && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
            {index + 1}
          </div>
        )}
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isApplied && (
              <Badge variant="default" className="text-xs bg-green-600">
                ✓ Applied
              </Badge>
            )}
            {suggestion.quick_win && !isApplied && (
              <Badge variant="default" className="text-xs">
                Quick Win
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {getCategoryLabel(suggestion.category)}
            </Badge>
          </div>
          <p className={`text-sm text-gray-900 ${isApplied ? 'line-through' : ''}`}>
            {suggestion.text}
          </p>
        </div>
        
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold text-green-600">
            +{suggestion.estimated_gain} pts
          </div>
          {onApply && !isApplied && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => onApply(suggestion)}
            >
              Apply
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Testing:**
- [ ] Tips display with numbers 1, 2, 3...
- [ ] Numbers use blue circle with white text
- [ ] Applied tips show green background and checkmark
- [ ] Quick win badge still displays correctly

---

#### Task 1.2: Update AtsTipsPanel
**File:** `src/components/chat/ChatSidebar.tsx`  
**Estimated Time:** 15 minutes

**Changes:**
1. Pass `showNumbers={true}` to SuggestionsList
2. Update header text to mention numbers
3. Add props for applied tips tracking

**Implementation:**
```typescript
function AtsTipsPanel({ 
  suggestions,
  appliedTipIds = [],
}: { 
  suggestions: Suggestion[];
  appliedTipIds?: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const quickWins = suggestions.filter(s => s.quick_win);
  const count = suggestions.length;
  
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left bg-white border rounded-md px-3 py-2 hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600">...</svg>
            <span className="font-semibold text-sm">ATS Improvement Tips</span>
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {count}
            </span>
          </div>
          <div className="text-xs text-gray-600">
            {/* NEW: Mention numbered tips */}
            {quickWins.length > 0 
              ? `${quickWins.length} quick wins available • Click to ${open ? 'collapse' : 'expand'}` 
              : `${count} numbered tips • Click to ${open ? 'collapse' : 'expand'}`
            }
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-2">
          <SuggestionsList 
            suggestions={suggestions} 
            maxSuggestions={10}
            title="ATS Tips" 
            showNumbers={true}                    // NEW
            appliedSuggestionIds={appliedTipIds}  // NEW
          />
        </div>
      )}
    </div>
  );
}
```

**Testing:**
- [ ] Header mentions "numbered tips"
- [ ] Numbers display when panel expanded
- [ ] Quick wins count still accurate

---

### Epic 2: AI Tip Implementation
**Estimated Time:** 2 hours  
**Priority:** P0 (Core feature)

---

#### Task 2.1: Add Tip Implementation Intent Pattern
**File:** `src/lib/agent/intents.ts`  
**Estimated Time:** 15 minutes

**Changes:**
1. Add `TIP_IMPLEMENTATION_INTENT` constant
2. Add to intent registry
3. Export handler name

**Implementation:**
```typescript
export const TIP_IMPLEMENTATION_INTENT = {
  patterns: [
    /implement\s+tip[s]?\s+(\d+(?:(?:,|\s+and)\s*\d+)*)/i,
    /apply\s+tip[s]?\s+(\d+(?:(?:,|\s+and)\s*\d+)*)/i,
    /use\s+suggestion[s]?\s+(\d+(?:(?:,|\s+and)\s*\d+)*)/i,
    /do\s+tip[s]?\s+(\d+(?:(?:,|\s+and)\s*\d+)*)/i,
  ],
  handler: 'handleTipImplementation',
  priority: 'high',
};

// Add to intent registry
export const ALL_INTENTS = [
  REFINE_SECTION_INTENT,
  DESIGN_CHANGE_INTENT,
  COLOR_CHANGE_INTENT,
  TIP_IMPLEMENTATION_INTENT,  // NEW
];
```

**Testing:**
- [ ] Intent pattern matches "implement tip 1"
- [ ] Intent pattern matches "apply tips 1, 2 and 3"
- [ ] Intent pattern matches "do tip 2"
- [ ] Pattern doesn't match unrelated messages

---

#### Task 2.2: Create Tip Number Parser
**File:** `src/lib/agent/parseTipNumbers.ts` (new file)  
**Estimated Time:** 20 minutes

**Changes:**
1. Create parser function
2. Handle various input formats
3. Add validation

**Implementation:**
```typescript
/**
 * Parse tip numbers from user message
 * 
 * Examples:
 *   "implement tip 1" → [1]
 *   "apply tips 1, 2 and 4" → [1, 2, 4]
 *   "do tip 2 and 3" → [2, 3]
 */
export function parseTipNumbers(message: string): number[] {
  // Match patterns like "tip 1", "tips 1, 2 and 3"
  const match = message.match(/tip[s]?\s+(\d+(?:(?:,|\s+and)\s*\d+)*)/i);
  
  if (!match) {
    return [];
  }
  
  const numbersStr = match[1];
  
  // Split by comma or "and"
  const numbers = numbersStr
    .split(/,|\s+and\s+/)
    .map(s => s.trim())
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n) && n > 0);
  
  // Remove duplicates
  return [...new Set(numbers)];
}

/**
 * Validate tip numbers against available suggestions
 */
export function validateTipNumbers(
  tipNumbers: number[],
  totalTips: number
): { valid: boolean; invalid: number[] } {
  const invalid = tipNumbers.filter(n => n > totalTips);
  return {
    valid: invalid.length === 0,
    invalid,
  };
}
```

**Testing:**
- [ ] "implement tip 1" → [1]
- [ ] "apply tips 1, 2 and 4" → [1, 2, 4]
- [ ] "do tip 2 and 3" → [2, 3]
- [ ] "implement tip 1 and 1" → [1] (no duplicates)
- [ ] Validation catches out-of-range numbers

---

#### Task 2.3: Create Suggestion Applier
**File:** `src/lib/agent/applySuggestions.ts` (new file)  
**Estimated Time:** 45 minutes

**Changes:**
1. Create main applier function
2. Handle keyword suggestions
3. Handle metrics suggestions
4. Handle format suggestions
5. Handle structure suggestions

**Implementation:**
```typescript
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { Suggestion } from '@/lib/ats/types';

/**
 * Apply multiple ATS suggestions to resume content
 */
export async function applySuggestions(
  resume: OptimizedResume,
  suggestions: Suggestion[]
): Promise<OptimizedResume> {
  let updated = { ...resume };
  
  for (const suggestion of suggestions) {
    updated = await applySingleSuggestion(updated, suggestion);
  }
  
  return updated;
}

async function applySingleSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): Promise<OptimizedResume> {
  const updated = { ...resume };
  
  switch (suggestion.category) {
    case 'keywords':
      return applyKeywordSuggestion(updated, suggestion);
    
    case 'metrics':
      return applyMetricsSuggestion(updated, suggestion);
    
    case 'formatting':
      return applyFormattingSuggestion(updated, suggestion);
    
    case 'structure':
      return applyStructureSuggestion(updated, suggestion);
    
    case 'content':
      return applyContentSuggestion(updated, suggestion);
    
    default:
      console.warn(`Unknown suggestion category: ${suggestion.category}`);
      return updated;
  }
}

/**
 * Apply keyword-related suggestions
 */
function applyKeywordSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): OptimizedResume {
  // Extract keywords from suggestion text
  // E.g., "Add Python keyword 5 more times" → ["Python"]
  const keywords = extractKeywordsFromText(suggestion.text);
  
  return {
    ...resume,
    skills: {
      ...resume.skills,
      technical: addUniqueKeywords(resume.skills.technical, keywords),
    },
  };
}

/**
 * Apply metrics-related suggestions
 */
function applyMetricsSuggestion(
  resume: OptimizedResume,
  suggestion: Suggestion
): OptimizedResume {
  // Add metrics guidance to most recent experience
  const updated = { ...resume };
  
  if (updated.experience.length > 0) {
    const latestExp = updated.experience[0];
    
    // Add a placeholder achievement with metric
    latestExp.achievements.push(
      `Achieved [X]% improvement in [metric] through [action]`
    );
  }
  
  return updated;
}

/**
 * Extract keywords from suggestion text
 */
function extractKeywordsFromText(text: string): string[] {
  // Simple extraction - look for quoted terms or capitalized words
  const quotedMatch = text.match(/"([^"]+)"/g);
  if (quotedMatch) {
    return quotedMatch.map(m => m.replace(/"/g, ''));
  }
  
  // Look for keywords after "add" or "include"
  const addMatch = text.match(/(?:add|include)\s+([A-Z][A-Za-z+#\s]+?)(?:\s+keyword|\s+to|$)/);
  if (addMatch) {
    return [addMatch[1].trim()];
  }
  
  return [];
}

/**
 * Add keywords to array without duplicates
 */
function addUniqueKeywords(existing: string[], newKeywords: string[]): string[] {
  const combined = [...existing, ...newKeywords];
  return [...new Set(combined)];
}
```

**Testing:**
- [ ] Keyword suggestion adds to skills.technical
- [ ] Metrics suggestion adds achievement
- [ ] No duplicate keywords added
- [ ] Resume structure preserved

---

#### Task 2.4: Create Tip Implementation Handler
**File:** `src/lib/agent/handlers/handleTipImplementation.ts` (new file)  
**Estimated Time:** 40 minutes

**Changes:**
1. Create handler function
2. Integrate with agent system
3. Update database
4. Recalculate ATS score

**Implementation:**
```typescript
import { parseTipNumbers, validateTipNumbers } from '../parseTipNumbers';
import { applySuggestions } from '../applySuggestions';
import type { AgentContext, AgentResponse } from '../types';
import { createClientComponentClient } from '@/lib/supabase';

export async function handleTipImplementation(
  context: AgentContext
): Promise<AgentResponse> {
  const { message, optimizationId, atsSuggestions = [] } = context;
  const supabase = createClientComponentClient();
  
  // 1. Parse tip numbers from message
  const tipNumbers = parseTipNumbers(message);
  
  if (tipNumbers.length === 0) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'No valid tip numbers found in message',
    };
  }
  
  // 2. Validate tip numbers
  const validation = validateTipNumbers(tipNumbers, atsSuggestions.length);
  if (!validation.valid) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: `Tips ${validation.invalid.join(', ')} do not exist. Available tips: 1-${atsSuggestions.length}`,
    };
  }
  
  // 3. Get suggestions for these tip numbers
  const suggestions = tipNumbers
    .map(num => atsSuggestions[num - 1])
    .filter(Boolean);
  
  // 4. Fetch current optimization data
  const { data: optimization, error: fetchError } = await supabase
    .from('optimizations')
    .select('rewrite_data, ats_score_optimized')
    .eq('id', optimizationId)
    .single();
  
  if (fetchError || !optimization) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Failed to fetch optimization data',
    };
  }
  
  const scoreBefore = optimization.ats_score_optimized || 0;
  
  // 5. Apply suggestions to resume
  const updatedResume = await applySuggestions(
    optimization.rewrite_data,
    suggestions
  );
  
  // 6. Calculate estimated score increase
  const estimatedGain = suggestions.reduce((sum, s) => sum + s.estimated_gain, 0);
  const scoreAfter = Math.min(100, scoreBefore + estimatedGain);
  
  // 7. Update optimization in database
  const { error: updateError } = await supabase
    .from('optimizations')
    .update({
      rewrite_data: updatedResume,
      ats_score_optimized: scoreAfter,
      updated_at: new Date().toISOString(),
    })
    .eq('id', optimizationId);
  
  if (updateError) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Failed to update optimization',
    };
  }
  
  // 8. Return success response
  return {
    intent: 'tip_implementation',
    success: true,
    tips_applied: {
      tip_numbers: tipNumbers,
      score_change: scoreAfter - scoreBefore,
      new_ats_score: scoreAfter,
      updated_sections: ['skills', 'experience'], // TODO: Track actual sections
    },
    message: `Applied tips ${tipNumbers.join(', ')}. Your ATS score increased from ${scoreBefore}% to ${scoreAfter}%!`,
  };
}
```

**Testing:**
- [ ] Handler parses tip numbers correctly
- [ ] Handler validates tip numbers
- [ ] Handler applies suggestions
- [ ] Database updated with new resume content
- [ ] Response includes score change

---

#### Task 2.5: Integrate Handler into Agent System
**File:** `src/lib/agent/index.ts`  
**Estimated Time:** 20 minutes

**Changes:**
1. Import handler
2. Add to handler registry
3. Pass ATS suggestions to agent context

**Implementation:**
```typescript
import { handleTipImplementation } from './handlers/handleTipImplementation';

// Add to handler map
const HANDLERS: Record<string, HandlerFunction> = {
  handleRefineSection,
  handleDesignChange,
  handleColorCustomization,
  handleTipImplementation,  // NEW
};

// Update runAgent to include ATS suggestions
export async function runAgent(params: {
  message: string;
  optimizationId: string;
  sessionId?: string;
  atsSuggestions?: Suggestion[];  // NEW
}): Promise<AgentResponse> {
  const { message, optimizationId, sessionId, atsSuggestions } = params;
  
  // Build context
  const context: AgentContext = {
    message,
    optimizationId,
    sessionId,
    atsSuggestions,  // NEW
  };
  
  // Detect intent and run handler
  const intent = detectIntent(message);
  const handler = HANDLERS[intent.handler];
  
  return await handler(context);
}
```

**Testing:**
- [ ] Handler registered in agent system
- [ ] ATS suggestions passed to context
- [ ] Intent detection triggers handler

---

#### Task 2.6: Update Chat API to Support Tips
**File:** `src/app/api/v1/chat/route.ts`  
**Estimated Time:** 20 minutes

**Changes:**
1. Accept `tip_context` in request body
2. Pass ATS suggestions to agent
3. Return `tips_applied` in response

**Implementation:**
```typescript
export async function POST(request: Request) {
  // ... existing auth and parsing ...
  
  const { session_id, optimization_id, message, tip_context } = body;
  
  // Fetch ATS suggestions if not provided
  let atsSuggestions = tip_context?.tip_suggestions;
  if (!atsSuggestions) {
    const { data } = await supabase
      .from('optimizations')
      .select('ats_suggestions')
      .eq('id', optimization_id)
      .single();
    
    atsSuggestions = data?.ats_suggestions || [];
  }
  
  // Run agent with ATS suggestions
  const agentResponse = await runAgent({
    message,
    optimizationId: optimization_id,
    sessionId: session_id,
    atsSuggestions,  // NEW
  });
  
  // ... save message ...
  
  // Return enhanced response
  return NextResponse.json({
    session_id: session.id,
    message: assistantMessage,
    tips_applied: agentResponse.tips_applied,  // NEW
    design_customization: agentResponse.design_customization,
  });
}
```

**Testing:**
- [ ] API accepts tip_context
- [ ] API passes suggestions to agent
- [ ] API returns tips_applied in response

---

#### Task 2.7: Update ChatSidebar to Send Tip Context
**File:** `src/components/chat/ChatSidebar.tsx`  
**Estimated Time:** 20 minutes

**Changes:**
1. Track applied tip IDs
2. Send tip context with message
3. Handle tips_applied response

**Implementation:**
```typescript
export function ChatSidebar({ ... }) {
  // NEW: Track applied tips
  const [appliedTipIds, setAppliedTipIds] = useState<string[]>([]);
  
  // Create numbered tips map
  const numberedTips = useMemo(() => {
    return (atsSuggestions || []).map((s, idx) => ({
      number: idx + 1,
      suggestion: s,
    }));
  }, [atsSuggestions]);
  
  const handleSendMessage = async (message: string) => {
    // ... existing code ...
    
    // NEW: Parse tip numbers from message
    const tipNumbers = parseTipNumbers(message);
    const tipContext = tipNumbers.length > 0 ? {
      tip_numbers: tipNumbers,
      tip_suggestions: tipNumbers.map(n => numberedTips[n - 1]?.suggestion).filter(Boolean),
    } : undefined;
    
    // Send with tip context
    const response = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        optimization_id: optimizationId,
        message,
        tip_context: tipContext,  // NEW
      }),
    });
    
    const data = await response.json();
    
    // NEW: Handle tips_applied response
    if (data.tips_applied) {
      const appliedSuggestionIds = data.tips_applied.tip_numbers
        .map((n: number) => numberedTips[n - 1]?.suggestion.id)
        .filter(Boolean);
      
      setAppliedTipIds(prev => [...prev, ...appliedSuggestionIds]);
    }
    
    // ... rest of existing code ...
  };
  
  // Pass appliedTipIds to AtsTipsPanel
  return (
    <div>
      {atsSuggestions && (
        <AtsTipsPanel 
          suggestions={atsSuggestions}
          appliedTipIds={appliedTipIds}  // NEW
        />
      )}
      {/* ... rest of component ... */}
    </div>
  );
}
```

**Testing:**
- [ ] Tip context sent with message
- [ ] Applied tips tracked in state
- [ ] Visual feedback shows applied tips

---

### Epic 3: AI Color Customization
**Estimated Time:** 1.5 hours  
**Priority:** P1 (High user value)

---

#### Task 3.1: Add Color Intent Pattern
**File:** `src/lib/agent/intents.ts`  
**Estimated Time:** 10 minutes

**Implementation:**
```typescript
export const COLOR_CUSTOMIZATION_INTENT = {
  patterns: [
    /(?:change|make|set|update)\s+(?:the\s+)?background\s+(?:color\s+)?(?:to\s+)?(\w+|#[0-9A-Fa-f]{6})/i,
    /(?:change|make|set|update)\s+(?:the\s+)?header[s]?\s+(?:color\s+)?(?:to\s+)?(\w+|#[0-9A-Fa-f]{6})/i,
    /(?:change|make|set|update)\s+(?:the\s+)?(?:text|font)\s+color\s+(?:to\s+)?(\w+|#[0-9A-Fa-f]{6})/i,
  ],
  handler: 'handleColorCustomization',
  priority: 'high',
};
```

---

#### Task 3.2: Create Color Parser
**File:** `src/lib/agent/parseColorRequest.ts` (new file)  
**Estimated Time:** 25 minutes

**Implementation:**
```typescript
const NAMED_COLORS: Record<string, string> = {
  // Blues
  blue: '#3b82f6',
  'light blue': '#bfdbfe',
  'dark blue': '#1e40af',
  navy: '#1e3a8a',
  
  // Greens
  green: '#10b981',
  'light green': '#86efac',
  'dark green': '#065f46',
  
  // Reds
  red: '#ef4444',
  'light red': '#fca5a5',
  'dark red': '#991b1b',
  
  // Grays
  gray: '#6b7280',
  'light gray': '#d1d5db',
  'dark gray': '#374151',
  black: '#000000',
  white: '#ffffff',
  
  // Others
  yellow: '#fbbf24',
  purple: '#a855f7',
  pink: '#ec4899',
  orange: '#f97316',
};

export interface ColorRequest {
  target: 'background' | 'header' | 'text' | 'accent';
  color: string;  // Normalized hex value
}

export function parseColorRequest(message: string): ColorRequest[] {
  const requests: ColorRequest[] = [];
  
  // Background color
  const bgMatch = message.match(/background\s+(?:color\s+)?(?:to\s+)?(\w+(?:\s+\w+)?|#[0-9A-Fa-f]{6})/i);
  if (bgMatch) {
    requests.push({
      target: 'background',
      color: normalizeColor(bgMatch[1]),
    });
  }
  
  // Header color
  const headerMatch = message.match(/header[s]?\s+(?:color\s+)?(?:to\s+)?(\w+(?:\s+\w+)?|#[0-9A-Fa-f]{6})/i);
  if (headerMatch) {
    requests.push({
      target: 'header',
      color: normalizeColor(headerMatch[1]),
    });
  }
  
  // Text color
  const textMatch = message.match(/(?:text|font)\s+color\s+(?:to\s+)?(\w+(?:\s+\w+)?|#[0-9A-Fa-f]{6})/i);
  if (textMatch) {
    requests.push({
      target: 'text',
      color: normalizeColor(textMatch[1]),
    });
  }
  
  return requests;
}

function normalizeColor(color: string): string {
  const trimmed = color.trim().toLowerCase();
  
  // If it's a hex code, return as-is
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }
  
  // Look up named color
  if (NAMED_COLORS[trimmed]) {
    return NAMED_COLORS[trimmed];
  }
  
  // Default to gray if unknown
  console.warn(`Unknown color: ${color}, using gray`);
  return NAMED_COLORS.gray;
}

export function validateColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
```

**Testing:**
- [ ] "change background to blue" → { target: 'background', color: '#3b82f6' }
- [ ] "make headers green" → { target: 'header', color: '#10b981' }
- [ ] "set text color to #333333" → { target: 'text', color: '#333333' }

---

#### Task 3.3: Create Color Handler
**File:** `src/lib/agent/handlers/handleColorCustomization.ts` (new file)  
**Estimated Time:** 35 minutes

**Implementation:**
```typescript
import { parseColorRequest, validateColor } from '../parseColorRequest';
import type { AgentContext, AgentResponse } from '../types';
import { createClientComponentClient } from '@/lib/supabase';

export async function handleColorCustomization(
  context: AgentContext
): Promise<AgentResponse> {
  const { message, optimizationId } = context;
  const supabase = createClientComponentClient();
  
  // 1. Parse color requests
  const colorRequests = parseColorRequest(message);
  
  if (colorRequests.length === 0) {
    return {
      intent: 'color_customization',
      success: false,
      error: 'No valid color change request found',
    };
  }
  
  // 2. Build customization object
  const customization: any = {
    colors: {},
  };
  
  for (const request of colorRequests) {
    if (!validateColor(request.color)) {
      return {
        intent: 'color_customization',
        success: false,
        error: `Invalid color format: ${request.color}`,
      };
    }
    
    switch (request.target) {
      case 'background':
        customization.colors.background = request.color;
        break;
      case 'header':
        customization.colors.heading = request.color;
        break;
      case 'text':
        customization.colors.text = request.color;
        break;
      case 'accent':
        customization.colors.accent = request.color;
        break;
    }
  }
  
  // 3. Fetch or create design assignment
  const { data: existing } = await supabase
    .from('design_assignments')
    .select('*')
    .eq('optimization_id', optimizationId)
    .maybeSingle();
  
  // 4. Merge customizations
  const mergedCustomization = {
    ...(existing?.customization || {}),
    colors: {
      ...(existing?.customization?.colors || {}),
      ...customization.colors,
    },
  };
  
  // 5. Upsert design assignment
  const { error: upsertError } = await supabase
    .from('design_assignments')
    .upsert({
      optimization_id: optimizationId,
      template_id: existing?.template_id || null,
      customization: mergedCustomization,
      updated_at: new Date().toISOString(),
    });
  
  if (upsertError) {
    return {
      intent: 'color_customization',
      success: false,
      error: 'Failed to save color customization',
    };
  }
  
  // 6. Return success with preview
  const colorNames = colorRequests.map(r => r.target).join(' and ');
  
  return {
    intent: 'color_customization',
    success: true,
    color_customization: customization.colors,
    design_customization: mergedCustomization,
    message: `Changed ${colorNames} color${colorRequests.length > 1 ? 's' : ''} successfully!`,
  };
}
```

**Testing:**
- [ ] Handler parses color requests
- [ ] Handler validates colors
- [ ] Handler updates design_assignments table
- [ ] Response includes customization for preview

---

#### Task 3.4: Integrate Color Handler
**File:** `src/lib/agent/index.ts`  
**Estimated Time:** 10 minutes

**Implementation:**
```typescript
import { handleColorCustomization } from './handlers/handleColorCustomization';

const HANDLERS: Record<string, HandlerFunction> = {
  // ... existing handlers ...
  handleColorCustomization,  // NEW
};
```

---

#### Task 3.5: Apply Colors in Frontend
**File:** `src/app/dashboard/optimizations/[id]/page.tsx`  
**Estimated Time:** 20 minutes

**Implementation:**
```typescript
const handleChatMessageSent = async () => {
  // ... existing code ...
  
  const response = await fetch(`/api/v1/design/${params.id}`, {
    cache: 'no-store',
  });
  
  if (response.ok) {
    const data = await response.json();
    
    // NEW: Apply color customization
    if (data.assignment?.customization?.colors) {
      setEphemeralCustomization(data.assignment.customization);
    }
    
    setCurrentDesignAssignment(data.assignment);
    setRefreshKey(prev => prev + 1);
  }
};
```

**Testing:**
- [ ] Color changes apply to preview
- [ ] Multiple color changes work
- [ ] Colors persist after refresh

---

### Epic 4: UI Layout Fixes
**Estimated Time:** 1 hour  
**Priority:** P2 (Polish)

#### Task 4.1: Compare Against Reference
**File:** Multiple  
**Estimated Time:** 30 minutes

**Actions:**
1. Open reference screenshot
2. Compare button layout, colors, spacing
3. Document differences
4. Create fix list

#### Task 4.2: Apply Layout Fixes
**File:** `src/app/dashboard/optimizations/[id]/page.tsx`  
**Estimated Time:** 30 minutes

**Changes:**
- Adjust button order and styling
- Fix ATS card colors
- Adjust spacing and padding

---

## Testing Plan

### Unit Tests
- [ ] parseTipNumbers utility
- [ ] validateTipNumbers utility
- [ ] parseColorRequest utility
- [ ] applySuggestions function

### Integration Tests
- [ ] POST /api/v1/chat with tip_context
- [ ] Agent intent detection
- [ ] Database updates

### E2E Tests
- [ ] User says "implement tip 1"
- [ ] User says "apply tips 2 and 4"
- [ ] User says "change background to blue"
- [ ] User says "make headers green"

---

## Rollout Plan

1. **Deploy Phase 1:** Numbered tips (low risk)
2. **Deploy Phase 2:** Tip implementation (test thoroughly)
3. **Deploy Phase 3:** Color customization (test with multiple templates)
4. **Deploy Phase 4:** UI fixes (visual QA)

---

## Confidence Levels

| Task | CL% | Notes |
|------|-----|-------|
| Numbered tips display | 98% | Straightforward UI change |
| Tip implementation | 85% | Complex logic, needs testing |
| Color customization | 90% | Depends on design system |
| UI layout fixes | 95% | CSS adjustments |

---

## Total Estimate: 5-6 hours




