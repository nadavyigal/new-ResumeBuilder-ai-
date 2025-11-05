/**
 * POST /api/v1/chat/approve-change
 *
 * Apply approved ATS tip changes to resume and recalculate ATS score
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { scoreResume } from '@/lib/ats/scorer';
import { TECHNICAL_KEYWORDS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Support both optimization_id and optimizationId (flexible parsing)
    const optimization_id = body.optimization_id || body.optimizationId;
    const suggestion_id = body.suggestion_id || body.suggestionId;
    const affected_fields = body.affected_fields || body.affectedFields;

    console.log('🔍 DEBUG - Approve Change Request:', {
      optimization_id,
      suggestion_id,
      affected_fields_count: affected_fields?.length || 0,
      user_id: user.id,
      user_email: user.email,
      body_keys: Object.keys(body)
    });

    if (!optimization_id || !suggestion_id) {
      console.error('❌ Missing required fields:', {
        has_optimization_id: !!optimization_id,
        has_suggestion_id: !!suggestion_id,
        body
      });
      return NextResponse.json(
        {
          error: 'Missing required fields: optimization_id and suggestion_id are required.',
          received: {
            optimization_id: !!optimization_id,
            suggestion_id: !!suggestion_id
          }
        },
        { status: 400 }
      );
    }

    // Get optimization data
    console.log('🔍 DEBUG - Querying database for optimization:', {
      optimization_id,
      user_id: user.id
    });

    const { data: optimization, error: fetchError } = await supabase
      .from('optimizations')
      .select('rewrite_data, resume_id, jd_id, ats_suggestions, ats_score_optimized')
      .eq('id', optimization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('🔍 DEBUG - Query Result:', {
      found: !!optimization,
      has_error: !!fetchError,
      error_message: fetchError?.message,
      error_details: fetchError?.details,
      error_hint: fetchError?.hint,
      error_code: (fetchError as any)?.code,
      optimization_id,
      user_id: user.id
    });

    if (fetchError) {
      console.error('❌ Database error fetching optimization:', fetchError);
      return NextResponse.json(
        {
          error: 'Database error',
          details: fetchError.message,
          hint: fetchError.hint,
          optimization_id,
          user_id: user.id
        },
        { status: 500 }
      );
    }

    if (!optimization) {
      console.error('❌ Optimization not found:', {
        optimization_id,
        user_id: user.id,
        message: 'The optimization ID does not exist or does not belong to this user'
      });
      return NextResponse.json(
        {
          error: 'Optimization not found',
          details: `No optimization found with ID "${optimization_id}" for user "${user.id}"`,
          optimization_id,
          user_id: user.id,
          hint: 'Check that the optimization ID is correct and belongs to the authenticated user'
        },
        { status: 404 }
      );
    }

    console.log('✅ Optimization found:', {
      optimization_id,
      has_rewrite_data: !!optimization.rewrite_data,
      has_ats_suggestions: !!optimization.ats_suggestions,
      ats_suggestions_count: optimization.ats_suggestions?.length || 0
    });

    const currentResumeData = optimization.rewrite_data || {};
    const atsSuggestions = optimization.ats_suggestions || [];

    // Find the suggestion
    const suggestion = atsSuggestions.find((s: any) => s.id === suggestion_id);
    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found.' },
        { status: 404 }
      );
    }

    // TODO: Implement version history/rollback mechanism
    // Before applying changes, we should:
    // 1. Create a snapshot in the resume_versions table with:
    //    - optimization_id
    //    - version_number (auto-incremented)
    //    - content (currentResumeData before changes)
    //    - change_summary (description of what's being changed)
    // 2. This allows users to undo changes if needed
    // 3. Could also implement a version history UI to browse/restore old versions
    //
    // Example implementation:
    // const { data: latestVersion } = await supabase
    //   .from('resume_versions')
    //   .select('version_number')
    //   .eq('optimization_id', optimization_id)
    //   .order('version_number', { ascending: false })
    //   .limit(1)
    //   .maybeSingle();
    //
    // const nextVersion = (latestVersion?.version_number || 0) + 1;
    //
    // await supabase
    //   .from('resume_versions')
    //   .insert({
    //     optimization_id,
    //     version_number: nextVersion,
    //     content: currentResumeData,
    //     change_summary: `Applied ATS Tip #${suggestion.number || '?'}: ${suggestion.text.substring(0, 100)}`
    //   });

    // Apply changes based on suggestion
    const updatedResumeData = applyATSSuggestion(
      currentResumeData,
      suggestion,
      affected_fields
    );

    // Update the optimization's rewrite_data
    const { error: updateError } = await supabase
      .from('optimizations')
      .update({ rewrite_data: updatedResumeData })
      .eq('id', optimization_id);

    if (updateError) {
      console.error('❌ Failed to update optimization:', updateError);
      return NextResponse.json(
        { error: 'Failed to apply changes to resume.' },
        { status: 500 }
      );
    }

    // Recalculate ATS score with the updated resume
    try {
      console.log('🔄 Starting ATS score recalculation...', {
        optimization_id,
        has_jd_id: !!optimization.jd_id,
        jd_id: optimization.jd_id,
        current_score: optimization.ats_score_optimized
      });

      // Get job description for scoring
      const { data: jobDescription, error: jdError } = await supabase
        .from('job_descriptions')
        .select('parsed_data, embeddings')
        .eq('id', optimization.jd_id)
        .maybeSingle();

      console.log('📊 Job description fetch result:', {
        found: !!jobDescription,
        has_error: !!jdError,
        error: jdError?.message,
        has_parsed_data: !!jobDescription?.parsed_data,
        has_embeddings: !!jobDescription?.embeddings,
        parsed_data_keys: jobDescription?.parsed_data ? Object.keys(jobDescription.parsed_data) : []
      });

      if (jdError) {
        console.error('❌ Failed to fetch job description:', jdError);
        throw new Error(`Job description fetch failed: ${jdError.message}`);
      }

      if (!jobDescription) {
        console.error('❌ Job description not found for id:', optimization.jd_id);
        throw new Error('Job description not found');
      }

      if (!jobDescription.parsed_data) {
        console.error('❌ Job description has no parsed_data');
        throw new Error('Job description missing parsed_data');
      }

      if (jobDescription) {
        // Calculate new ATS score
        const scoreResult = await scoreResume(
          updatedResumeData,
          {},  // original resume (not needed for optimized score)
          jobDescription.parsed_data,
          jobDescription.embeddings || null
        );

        // Update ATS score in database
        const { error: scoreUpdateError } = await supabase
          .from('optimizations')
          .update({
            ats_score_optimized: scoreResult.optimizedScore,
            ats_subscores: scoreResult.subscores,
          })
          .eq('id', optimization_id);

        if (scoreUpdateError) {
          console.error('❌ Failed to update ATS score:', scoreUpdateError);
          // Don't fail the request, just log the error
        }

        console.log('✅ ATS score recalculated:', {
          previous: optimization.ats_score_optimized,
          new: scoreResult.optimizedScore,
          improvement: scoreResult.optimizedScore - (optimization.ats_score_optimized || 0)
        });

        return NextResponse.json({
          success: true,
          message: `Applied changes from Tip #${suggestion.number || '?'}`,
          updated_resume: updatedResumeData,
          new_ats_score: scoreResult.optimizedScore,
          previous_ats_score: optimization.ats_score_optimized,
          score_improvement: scoreResult.optimizedScore - (optimization.ats_score_optimized || 0),
        }, { status: 200 });
      }
    } catch (scoreError) {
      console.error('⚠️ Error recalculating ATS score:', scoreError);
      console.error('❌ SCORE CALCULATION FAILED - Detailed Error:', {
        error_message: scoreError instanceof Error ? scoreError.message : String(scoreError),
        error_name: scoreError instanceof Error ? scoreError.name : typeof scoreError,
        error_stack: scoreError instanceof Error ? scoreError.stack : undefined,
        optimization_id,
        user_id: user.id,
        has_job_description: !!optimization.jd_id,
        job_desc_id: optimization.jd_id,
        resume_updated: !!updatedResumeData,
        suggestion_id: suggestion.id
      });

      // Return error response so frontend knows score update failed
      return NextResponse.json({
        success: false,
        error: 'Changes applied but ATS score calculation failed',
        details: scoreError instanceof Error ? scoreError.message : 'Unknown error',
        updated_resume: updatedResumeData,
      }, { status: 500 });
    }

    // This should not be reached anymore (score calculation always returns inside try/catch)
    return NextResponse.json({
      success: true,
      message: `Applied changes from Tip #${suggestion.number || '?'}`,
      updated_resume: updatedResumeData,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/v1/chat/approve-change:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to approve change',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Apply ATS suggestion changes to resume data
 *
 * Parses ATS suggestions and modifies resume structure accordingly.
 * Supports keyword additions and content enhancements.
 *
 * @param resumeData - Current resume data structure
 * @param suggestion - ATS suggestion object with text, category, and explanation
 * @param affectedFields - Optional array of fields affected by this change (for preview)
 * @returns Updated resume data with suggestion applied
 *
 * @remarks
 * This function uses pattern matching and fallback strategies to extract terms:
 * 1. Primary: Regex pattern matching for "add [term]" format
 * 2. Fallback: Quoted terms extraction if pattern fails
 * 3. Auto-categorizes skills as technical/soft based on keyword matching
 *
 * Known limitations:
 * - Pattern matching may fail for non-standard suggestion formats
 * - Technical keyword list is static (see TECHNICAL_KEYWORDS constant)
 *
 * @throws Returns original resumeData if parsing/application fails
 *
 * @complexity O(n) where n is number of terms to add
 */
function applyATSSuggestion(
  resumeData: Record<string, unknown>,
  suggestion: any,
  affectedFields?: any[]
): Record<string, unknown> {
  const updated = structuredClone(resumeData); // Deep clone (faster and safer than JSON methods)

  try {
    // NEW: Use affectedFields if provided (the proper way!)
    if (affectedFields && affectedFields.length > 0) {
      console.log('✅ Applying changes using affectedFields:', {
        suggestion_id: suggestion.id,
        fields_count: affectedFields.length,
        suggestion_text: suggestion.text.substring(0, 100)
      });

      affectedFields.forEach((affectedField: any) => {
        // Map field names from amendment generator to expected names
        // Amendment generator uses 'field' and 'newValue', we need 'fieldPath' and 'after'
        const sectionId = affectedField.sectionId;
        const fieldPath = affectedField.field || affectedField.fieldPath;  // Support both naming conventions
        const after = affectedField.newValue !== undefined ? affectedField.newValue : affectedField.after;  // Support both naming conventions
        const changeType = affectedField.changeType;

        // CRITICAL: Check for missing fieldPath before proceeding
        if (!fieldPath) {
          console.warn('⚠️ Missing fieldPath for affectedField - skipping:', {
            sectionId,
            changeType,
            affectedFieldKeys: Object.keys(affectedField),
            fullField: affectedField
          });
          return; // Skip this field safely
        }

        console.log('🔧 Applying field change:', {
          sectionId,
          fieldPath,
          changeType,
          after: typeof after === 'string' ? after.substring(0, 50) : after,
          affectedFieldKeys: Object.keys(affectedField)  // Debug: see what keys are available
        });

        // Parse sectionId to get section name and index
        // Format: "skills", "experience-0", "education-1", etc.
        const match = sectionId.match(/^([a-z]+)(?:-(\d+))?$/);
        if (!match) {
          console.warn('⚠️ Invalid sectionId format:', sectionId);
          return;
        }

        const [, sectionName, indexStr] = match;
        const sectionIndex = indexStr ? parseInt(indexStr, 10) : null;

        // Get the section
        let section = updated[sectionName];
        if (!section) {
          console.warn('⚠️ Section not found:', sectionName);
          return;
        }

        // If section is an array and we have an index, get that item
        if (Array.isArray(section) && sectionIndex !== null) {
          if (sectionIndex >= section.length) {
            console.warn('⚠️ Section index out of bounds:', { sectionName, index: sectionIndex, length: section.length });
            return;
          }
          section = section[sectionIndex];
        }

        // Navigate to the field using fieldPath
        const pathParts = fieldPath.split('.');
        let target: any = section;

        // Navigate to parent of final field
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!target[pathParts[i]]) {
            console.warn('⚠️ Field path not found:', { path: pathParts.slice(0, i + 1).join('.') });
            return;
          }
          target = target[pathParts[i]];
        }

        const finalFieldName = pathParts[pathParts.length - 1];

        // Apply the change based on changeType
        if (changeType === 'replace' || changeType === 'modify') {
          // 'modify' and 'replace' both mean replace the entire value
          target[finalFieldName] = after;
          console.log('✅ Replaced field:', { field: finalFieldName, newValue: after, changeType });
        } else if (changeType === 'add' || changeType === 'append') {
          // Ensure field is an array
          if (!Array.isArray(target[finalFieldName])) {
            target[finalFieldName] = [];
          }

          // Add new items
          const items = Array.isArray(after) ? after : [after];
          items.forEach(item => {
            if (!target[finalFieldName].includes(item)) {
              target[finalFieldName].push(item);
            }
          });
          console.log('✅ Added to array field:', { field: finalFieldName, added: items });
        } else {
          console.warn('⚠️ Unknown changeType:', changeType);
        }
      });

      console.log('✅ Applied all field changes successfully');
      return updated;
    }

    // FALLBACK: Old regex-based parsing (kept for backward compatibility)
    console.warn('⚠️ No affectedFields provided, falling back to regex parsing');

    const suggestionText = suggestion.text.toLowerCase();
    const category = suggestion.category || 'keywords';

    if (category === 'keywords' && suggestionText.includes('add')) {
      const termsMatch = suggestionText.match(/add\s+(?:exact\s+term\s+)?['"]?([^'"]+)['"]?/i);

      if (termsMatch) {
        const terms = termsMatch[1]
          .split(/[,;]|\band\b/)
          .map(t => t.trim().replace(/['"`]/g, ''))
          .filter(Boolean);

        if (!updated.skills) {
          updated.skills = { technical: [], soft: [] };
        }

        const skills = updated.skills as { technical: string[], soft: string[] };

        terms.forEach(term => {
          const isTechnical = TECHNICAL_KEYWORDS.some(kw => term.toLowerCase().includes(kw));
          if (isTechnical && !skills.technical.includes(term)) {
            skills.technical.push(term);
          } else if (!isTechnical && !skills.soft.includes(term)) {
            skills.soft.push(term);
          }
        });

        console.log('✅ Applied ATS suggestion (fallback - keywords):', {
          termsAdded: terms
        });
      }
    } else if (category === 'content' && Array.isArray(updated.experience)) {
      const experiences = updated.experience as any[];
      if (experiences.length > 0 && experiences[0].achievements) {
        const achievementText = suggestion.explanation || suggestion.text;
        if (!experiences[0].achievements.includes(achievementText)) {
          experiences[0].achievements.push(achievementText);

          console.log('✅ Applied ATS suggestion (fallback - content):', {
            achievementAdded: achievementText.substring(0, 100)
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Error applying ATS suggestion:', error);
    console.error('Suggestion that failed:', {
      text: suggestion.text,
      category: suggestion.category
    });
    return resumeData;
  }

  return updated;
}
