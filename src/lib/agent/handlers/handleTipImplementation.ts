import { parseTipNumbers, validateTipNumbers } from '../parseTipNumbers';
import { applySuggestions } from '../applySuggestions';
import type { Suggestion } from '@/lib/ats/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OptimizedResume } from '@/lib/ai-optimizer';

interface AgentContext {
  message: string;
  optimizationId: string;
  atsSuggestions?: Suggestion[];
  supabase: SupabaseClient;
}

interface AgentResponse {
  intent: string;
  success: boolean;
  error?: string;
  tips_applied?: {
    tip_numbers: number[];
    score_change: number;
    new_ats_score: number;
  };
  message?: string;
}

export async function handleTipImplementation(
  context: AgentContext
): Promise<AgentResponse> {
  const { message, optimizationId, atsSuggestions = [], supabase } = context;

  // 1. Parse tip numbers
  const tipNumbers = parseTipNumbers(message);

  if (tipNumbers.length === 0) {
    return {
      intent: 'tip_implementation',
      success: false,
      error:
        'No valid tip numbers found in message. Try: "implement tip 1" or "apply tips 1, 2 and 3"',
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
    .map((num) => atsSuggestions[num - 1])
    .filter(Boolean);

  if (suggestions.length === 0) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Could not find suggestions for the specified tip numbers',
    };
  }

  // 4. Fetch current optimization data
  const { data: optimization, error: fetchError } = await supabase
    .from('optimizations')
    .select('rewrite_data, ats_score_optimized')
    .eq('id', optimizationId)
    .single();

  if (fetchError || !optimization) {
    console.error('Error fetching optimization:', fetchError);
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Failed to fetch optimization data',
    };
  }

  const resumeData = ensureOptimizedResume(optimization.rewrite_data);
  if (!resumeData) {
    return {
      intent: 'tip_implementation',
      success: false,
      error:
        'No editable resume data found for this optimization. Run an optimization first, then try applying the tips again.',
    };
  }

  const scoreBefore = typeof optimization.ats_score_optimized === 'number'
    ? optimization.ats_score_optimized
    : 0;

  // 5. Apply suggestions to resume
  try {
    const updatedResume = await applySuggestions(
      resumeData,
      suggestions
    );

    // 6. Calculate new score (estimate based on gains)
    const estimatedGain = suggestions.reduce(
      (sum, s) => sum + (s.estimated_gain || 0),
      0
    );
    const scoreAfter = Math.min(100, scoreBefore + estimatedGain);

    // 7. Update database
    const { error: updateError } = await supabase
      .from('optimizations')
      .update({
        rewrite_data: updatedResume,
        ats_score_optimized: scoreAfter,
        updated_at: new Date().toISOString(),
      })
      .eq('id', optimizationId);

    if (updateError) {
      console.error('Error updating optimization:', updateError);
      return {
        intent: 'tip_implementation',
        success: false,
        error: 'Failed to update optimization',
      };
    }

    // 8. Return success
    const tipList =
      tipNumbers.length === 1
        ? `tip ${tipNumbers[0]}`
        : `tips ${tipNumbers.join(', ')}`;

    return {
      intent: 'tip_implementation',
      success: true,
      tips_applied: {
        tip_numbers: tipNumbers,
        score_change: scoreAfter - scoreBefore,
        new_ats_score: scoreAfter,
      },
      message: `Applied ${tipList}. ATS score: ${scoreBefore}% → ${scoreAfter}% (+${scoreAfter - scoreBefore}).`,
    };
  } catch (error) {
    console.error('Error applying suggestions:', error);
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Failed to apply suggestions to resume',
    };
  }
}

function ensureOptimizedResume(data: unknown): OptimizedResume | null {
  if (!data) {
    return null;
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as OptimizedResume;
    } catch (error) {
      console.error('Failed to parse rewrite_data JSON', error);
      return null;
    }
  }

  if (typeof data === 'object') {
    return data as OptimizedResume;
  }

  return null;
}

