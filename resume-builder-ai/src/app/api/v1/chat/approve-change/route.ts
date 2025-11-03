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
    const { optimization_id, suggestion_id, affected_fields } = body;

    if (!optimization_id || !suggestion_id) {
      return NextResponse.json(
        { error: 'Missing required fields: optimization_id and suggestion_id are required.' },
        { status: 400 }
      );
    }

    // Get optimization data
    const { data: optimization, error: fetchError } = await supabase
      .from('optimizations')
      .select('rewrite_data, resume_id, job_description_id, ats_suggestions')
      .eq('id', optimization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !optimization) {
      return NextResponse.json(
        { error: 'Optimization not found or access denied.' },
        { status: 404 }
      );
    }

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
      // Get job description for scoring
      const { data: jobDescription } = await supabase
        .from('job_descriptions')
        .select('parsed_data, embeddings')
        .eq('id', optimization.job_description_id)
        .maybeSingle();

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
          score_improvement: scoreResult.optimizedScore - (optimization.ats_score_optimized || 0),
        }, { status: 200 });
      }
    } catch (scoreError) {
      console.error('⚠️ Error recalculating ATS score:', scoreError);
      // Don't fail the request if score calculation fails
    }

    // Return success even if scoring failed
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
    // Extract keywords or terms to add from the suggestion text
    const suggestionText = suggestion.text.toLowerCase();
    const category = suggestion.category || 'keywords';

    // Handle different suggestion categories
    if (category === 'keywords' && suggestionText.includes('add')) {
      // Extract terms to add (simple pattern matching with fallback)
      const termsMatch = suggestionText.match(/add\s+(?:exact\s+term\s+)?['"]?([^'"]+)['"]?/i);

      if (termsMatch) {
        const terms = termsMatch[1]
          .split(/[,;]|\band\b/)
          .map(t => t.trim().replace(/['"`]/g, ''))
          .filter(Boolean);

        // Add to skills section
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

        console.log('✅ Applied ATS suggestion (keywords):', {
          category: suggestion.category,
          termsAdded: terms,
          text: suggestion.text.substring(0, 100)
        });
      } else {
        // Fallback: If pattern matching fails, log warning and try to extract quoted terms
        console.warn('⚠️ Regex pattern matching failed for suggestion:', suggestion.text);

        const quotedTermsMatch = suggestionText.match(/["']([^"']+)["']/g);
        if (quotedTermsMatch) {
          const terms = quotedTermsMatch.map(t => t.replace(/["']/g, ''));

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

          console.log('✅ Applied ATS suggestion (fallback - quoted terms):', {
            category: suggestion.category,
            termsAdded: terms,
            text: suggestion.text.substring(0, 100)
          });
        } else {
          console.error('❌ Could not parse suggestion text. No terms extracted.', {
            text: suggestion.text,
            explanation: 'Pattern matching failed and no quoted terms found. Consider improving suggestion format.'
          });
        }
      }
    } else if (category === 'content' && Array.isArray(updated.experience)) {
      // Add to experience section achievements
      const experiences = updated.experience as any[];
      if (experiences.length > 0 && experiences[0].achievements) {
        const achievementText = suggestion.explanation || suggestion.text;
        if (!experiences[0].achievements.includes(achievementText)) {
          experiences[0].achievements.push(achievementText);

          console.log('✅ Applied ATS suggestion (content):', {
            category: suggestion.category,
            achievementAdded: achievementText.substring(0, 100)
          });
        }
      } else {
        console.warn('⚠️ Cannot apply content suggestion: No experience entries or achievements array found.');
      }
    } else {
      console.warn('⚠️ Unsupported suggestion category or format:', {
        category,
        text: suggestion.text.substring(0, 100)
      });
    }

  } catch (error) {
    console.error('❌ Error applying ATS suggestion:', error);
    console.error('Suggestion that failed:', {
      text: suggestion.text,
      category: suggestion.category,
      explanation: suggestion.explanation
    });
    // Return original data if application fails
    return resumeData;
  }

  return updated;
}
