import { parseTipNumbers, validateTipNumbers } from '../parseTipNumbers';
import { applySuggestions } from '../applySuggestions';
import type { Suggestion } from '@/lib/ats/types';
import { createClient } from '@supabase/supabase-js';

interface AgentContext {
  message: string;
  optimizationId: string;
  atsSuggestions?: Suggestion[];
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
  const { message, optimizationId, atsSuggestions = [] } = context;
  
  // Create Supabase client with service role for server-side operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return {
      intent: 'tip_implementation',
      success: false,
      error: 'Supabase configuration missing',
    };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // 1. Parse tip numbers
  const tipNumbers = parseTipNumbers(message);
  
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
  
  const scoreBefore = optimization.ats_score_optimized || 0;
  
  // 5. Apply suggestions to resume
  try {
    const updatedResume = await applySuggestions(
      optimization.rewrite_data,
      suggestions
    );
    
    // 6. Calculate new score (estimate based on gains)
    const estimatedGain = suggestions.reduce((sum, s) => sum + s.estimated_gain, 0);
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
    const tipList = tipNumbers.length === 1 
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
      message: `✅ Applied ${tipList}! Your ATS score increased from ${scoreBefore}% to ${scoreAfter}% (+${scoreAfter - scoreBefore} points).`,
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




