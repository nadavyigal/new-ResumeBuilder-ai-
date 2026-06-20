import { parseTipNumbers, validateTipNumbers } from '../parseTipNumbers';
import { applySuggestionsWithTracking } from '../applySuggestions';
import type { Suggestion } from '@/lib/ats/types';
import { buildJobDataFromExtractedJson, resolveJobDescriptionText } from '@/lib/ats/job-data-resolver';
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
    .select('rewrite_data, ats_score_optimized, ai_modification_count, user_id, jd_id, resume_id, ats_score_original, ats_subscores_original, jd_text')
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
  
  const scoreBefore = optimization.ats_score_optimized ?? 0;
  console.log('💡 [handleTipImplementation] Current score:', scoreBefore);

  const jobId = optimization.jd_id;
  const resumeId = optimization.resume_id;
  let jobDesc: any = null;
  let resumeData: any = null;
  let jobText = '';
  let jobData: any = null;

  if (jobId) {
    const { data, error } = await supabase
      .from('job_descriptions')
      .select('clean_text, raw_text, title, parsed_data')
      .eq('id', jobId)
      .maybeSingle();
    if (error) {
      console.error('WARN [handleTipImplementation] Failed to fetch job description:', error);
    } else {
      jobDesc = data;
      jobText = resolveJobDescriptionText({
        raw_text: jobDesc?.raw_text,
        clean_text: jobDesc?.clean_text,
        parsed_data: jobDesc?.parsed_data,
        jd_text: optimization.jd_text,
      });
      if (jobText && jobDesc?.parsed_data) {
        jobData = buildJobDataFromExtractedJson(jobDesc.parsed_data, jobText);
      }
    }
  }

  if (resumeId) {
    const { data, error } = await supabase
      .from('resumes')
      .select('raw_text')
      .eq('id', resumeId)
      .maybeSingle();
    if (error) {
      console.error('WARN [handleTipImplementation] Failed to fetch original resume:', error);
    } else {
      resumeData = data;
    }
  }

  // 5. Apply suggestions to resume with modification tracking (Phase 3, T019)
  try {
    console.log('💡 [handleTipImplementation] Applying suggestions:', suggestions.map(s => s.text));
    const suggestionResult = await applySuggestionsWithTracking(
      optimization.rewrite_data,
      suggestions,
      {
        jobDescriptionText: jobText || undefined,
        jobData: jobData || undefined,
        resumeOriginalText: resumeData?.raw_text,
      }
    );
    const updatedResume = suggestionResult.resume;
    const modifications = suggestionResult.modifications;
    console.log('💡 [handleTipImplementation] Resume updated successfully');
    console.log(`💡 [handleTipImplementation] Tracked ${modifications.length} field modifications`);

    // 6. RE-SCORE using actual ATS engine (CRITICAL FIX)
    console.log('🔍 [handleTipImplementation] Re-scoring resume with ATS engine...');

    if (!optimization.jd_id || !optimization.resume_id || !jobDesc || !resumeData || !jobText) {
      console.error('❌ [handleTipImplementation] Failed to fetch JD/resume for re-scoring');
      // Fall back to estimated scoring
      const rawGain = suggestions.reduce((sum, s) => sum + s.estimated_gain, 0);
      const scoreAfter = Math.min(100, scoreBefore + Math.min(15, Math.round(rawGain * 0.7)));

      // Log modifications even in fallback path (Phase 3, T019)
      if (modifications.length > 0 && optimization.user_id) {
        try {
          const modificationRecords = modifications.map((modification) => ({
            user_id: optimization.user_id,
            optimization_id: optimizationId,
            operation_type: modification.operation,
            field_path: modification.field_path,
            old_value: modification.old_value !== undefined ? JSON.stringify(modification.old_value) : null,
            new_value: modification.new_value !== undefined ? JSON.stringify(modification.new_value) : null,
            ats_score_before: scoreBefore,
            ats_score_after: scoreAfter,
          }));
          await supabase.from('content_modifications').insert(modificationRecords);
        } catch (logError) {
          console.error('⚠️ Failed to log modifications:', logError);
        }
      }

      const updatePayload = {
        rewrite_data: updatedResume,
        match_score: scoreAfter,
        ats_score_optimized: scoreAfter,
        ai_modification_count: (optimization.ai_modification_count || 0) + modifications.length,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('optimizations')
        .update(updatePayload)
        .eq('id', optimizationId);

      return {
        intent: 'tip_implementation',
        success: true,
        tips_applied: {
          tip_numbers: tipNumbers,
          score_change: scoreAfter - scoreBefore,
          new_ats_score: scoreAfter,
        },
        message: `✅ Applied tips! Score updated to ${scoreAfter}% (estimated).`,
      };
    }

    // Import the re-scoring function
    const { rescoreAfterTipImplementation } = await import('@/lib/ats/integration');

    // Run real ATS scoring with correct job title
    const jobTitle = jobDesc?.title || 'Position';
    console.log('💡 [handleTipImplementation] Re-scoring with job title:', jobTitle);

    const atsResult = await rescoreAfterTipImplementation({
      resumeOriginalText: resumeData.raw_text,
      resumeOptimizedJson: updatedResume,
      jobDescriptionText: jobText,
      jobTitle: jobTitle,
      jobExtractedJson: jobDesc?.parsed_data || undefined,
      previousOriginalScore: optimization.ats_score_original,
      previousSubscoresOriginal: optimization.ats_subscores_original,
    });

    const scoreAfter = atsResult.ats_score_optimized;
    const actualIncrease = scoreAfter - scoreBefore;

    console.log('💡 [handleTipImplementation] Real ATS score calculated:', {
      scoreBefore,
      scoreAfter,
      actualIncrease,
      subscores: atsResult.subscores,
    });

    // 7. Log modifications to content_modifications table (Phase 3, T019)
    if (modifications.length > 0 && optimization.user_id) {
      console.log(`💡 [handleTipImplementation] Logging ${modifications.length} modifications to database...`);

      try {
        const modificationRecords = modifications.map((modification) => ({
          user_id: optimization.user_id,
          optimization_id: optimizationId,
          operation_type: modification.operation,
          field_path: modification.field_path,
          old_value: modification.old_value !== undefined ? JSON.stringify(modification.old_value) : null,
          new_value: modification.new_value !== undefined ? JSON.stringify(modification.new_value) : null,
          ats_score_before: scoreBefore,
          ats_score_after: scoreAfter,
          suggestion_text: suggestions.find((s) =>
            modification.field_path.includes('achievements') && s.text.includes(String(modification.new_value))
          )?.text || null,
        }));

        await supabase.from('content_modifications').insert(modificationRecords);

        console.log(`✅ [handleTipImplementation] Successfully logged ${modifications.length} modifications`);
      } catch (logError) {
        console.error('⚠️ [handleTipImplementation] Failed to log modifications (non-critical):', logError);
        // Continue execution - logging failure shouldn't block the tip implementation
      }
    }

    // 8. Update database with REAL scores and modification count
    const updatePayload = {
      rewrite_data: updatedResume,
      match_score: scoreAfter,
      ats_score_optimized: scoreAfter,
      ats_subscores: atsResult.subscores,
      ats_suggestions: atsResult.suggestions,
      ats_confidence: atsResult.confidence,
      ...(optimization.jd_text ? {} : { jd_text: jobText }),
      ai_modification_count: (optimization.ai_modification_count || 0) + modifications.length,
      updated_at: new Date().toISOString(),
    };
    console.log('💡 [handleTipImplementation] Updating optimization in database with real scores and modification count');

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

    console.log('✅ [handleTipImplementation] Database updated successfully with real ATS scores!');

    // 8. Return success
    const tipList = tipNumbers.length === 1
      ? `tip ${tipNumbers[0]}`
      : `tips ${tipNumbers.join(', ')}`;

    const result = {
      intent: 'tip_implementation',
      success: true,
      tips_applied: {
        tip_numbers: tipNumbers,
        score_change: actualIncrease,
        new_ats_score: scoreAfter,
      },
      message: actualIncrease > 0
        ? `✅ Applied ${tipList}! Your ATS score increased from ${scoreBefore}% to ${scoreAfter}% (+${actualIncrease} points).`
        : `✅ Applied ${tipList}! Your ATS score is ${scoreAfter}% (changes applied successfully).`,
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














