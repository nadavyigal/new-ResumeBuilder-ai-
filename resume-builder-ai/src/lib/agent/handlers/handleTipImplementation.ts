import { parseTipNumbers, validateTipNumbers } from '../parseTipNumbers';
import { applySuggestions } from '../applySuggestions';
import type { Suggestion } from '@/lib/ats/types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AgentContext {
  message: string;
  optimizationId: string;
  atsSuggestions?: Suggestion[];
  supabase: SupabaseClient; // Accept authenticated client from caller
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
  console.log('💡 [handleTipImplementation] INVOKED with:', {
    message: context.message,
    optimizationId: context.optimizationId,
    suggestionsCount: context.atsSuggestions?.length || 0
  });
  const { message, optimizationId, atsSuggestions = [], supabase } = context;

  // 1. Parse tip numbers
  const tipNumbers = parseTipNumbers(message);
  console.log('💡 [handleTipImplementation] Parsed tip numbers:', tipNumbers);
  
  if (tipNumbers.length === 0) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'No valid tip numbers found in message. Try: "implement tip 1" or "apply tips 1, 2 and 3"',
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
  
  if (suggestions.length === 0) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Could not find suggestions for the specified tip numbers',
    };
  }
  
  // 4. Fetch current optimization data
  console.log('💡 [handleTipImplementation] Fetching optimization:', optimizationId);
  const { data: optimization, error: fetchError } = await supabase
    .from('optimizations')
    .select('rewrite_data, ats_score_optimized')
    .eq('id', optimizationId)
    .maybeSingle(); // Use maybeSingle() to avoid 406 errors when no rows found

  if (fetchError || !optimization) {
    console.error('❌ [handleTipImplementation] Error fetching optimization:', fetchError);
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Failed to fetch optimization data',
    };
  }
  
  const scoreBefore = optimization.ats_score_optimized || 0;
  console.log('💡 [handleTipImplementation] Current score:', scoreBefore);

  // 5. Apply suggestions to resume
  try {
    console.log('💡 [handleTipImplementation] Applying suggestions:', suggestions.map(s => s.text));
    const updatedResume = await applySuggestions(
      optimization.rewrite_data,
      suggestions
    );
    console.log('💡 [handleTipImplementation] Resume updated successfully');

    // 6. Calculate new score (estimate based on gains)
    const estimatedGain = suggestions.reduce((sum, s) => sum + s.estimated_gain, 0);
    const scoreAfter = Math.min(100, scoreBefore + estimatedGain);
    console.log('💡 [handleTipImplementation] New score:', scoreAfter, '(+' + estimatedGain + ')');

    // 7. Update database
    const updatePayload = {
      rewrite_data: updatedResume,
      ats_score_optimized: scoreAfter,
      updated_at: new Date().toISOString(),
    };
    console.log('💡 [handleTipImplementation] Updating optimization in database with payload:', {
      optimizationId,
      scoreAfter,
      hasRewriteData: !!updatedResume,
      updated_at: updatePayload.updated_at
    });

    const { data: updateResult, error: updateError } = await supabase
      .from('optimizations')
      .update(updatePayload)
      .eq('id', optimizationId)
      .select('id, updated_at, ats_score_optimized');

    console.log('💡 [handleTipImplementation] Database update result:', { updateResult, updateError });

    if (updateError) {
      console.error('❌ [handleTipImplementation] Error updating optimization:', updateError);
      return {
        intent: 'tip_implementation',
        success: false,
        error: 'Failed to update optimization',
      };
    }

    console.log('✅ [handleTipImplementation] Database updated successfully!');

    // 8. Return success
    const tipList = tipNumbers.length === 1
      ? `tip ${tipNumbers[0]}`
      : `tips ${tipNumbers.join(', ')}`;

    const result = {
      intent: 'tip_implementation',
      success: true,
      tips_applied: {
        tip_numbers: tipNumbers,
        score_change: scoreAfter - scoreBefore,
        new_ats_score: scoreAfter,
      },
      message: `✅ Applied ${tipList}! Your ATS score increased from ${scoreBefore}% to ${scoreAfter}% (+${scoreAfter - scoreBefore} points).`,
    };

    console.log('✅ [handleTipImplementation] SUCCESS! Returning:', result);
    return result;
  } catch (error) {
    console.error('❌ [handleTipImplementation] Error applying suggestions:', error);
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Failed to apply suggestions to resume',
    };
  }
}




