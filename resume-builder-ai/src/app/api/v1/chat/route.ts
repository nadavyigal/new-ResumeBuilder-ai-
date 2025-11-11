/**
 * POST /api/v1/chat
 *
 * Send a chat message and receive AI response.
 * Creates or resumes session automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { getActiveSession } from '@/lib/supabase/chat-sessions';
import { processUnifiedMessage } from '@/lib/chat-manager/unified-processor';
import type { ChatSendMessageRequest, ChatSendMessageResponse } from '@/types/chat';
import {
  getDesignAssignment,
  updateDesignCustomization
} from '@/lib/supabase/resume-designs';
import {
  createDesignCustomization,
  getDesignCustomizationById
} from '@/lib/supabase/design-customizations';
import { AmendmentRequest } from '@/lib/chat-manager/processor';
import { CHAT_CONFIG, TECHNICAL_KEYWORDS } from '@/lib/constants';
import { detectIntentRegex } from '@/lib/agent/intents';
import { handleTipImplementation } from '@/lib/agent/handlers/handleTipImplementation';
import { handleColorCustomization } from '@/lib/agent/handlers/handleColorCustomization';

/**
 * Apply amendments to resume content
 *
 * Intelligently modifies resume structure based on amendment requests from chat.
 * Supports operations on skills, summary, and experience sections.
 *
 * @param currentContent - Current resume data structure
 * @param amendments - Array of amendment requests to apply
 * @returns Updated resume data with all amendments applied
 *
 * @example
 * ```ts
 * const updated = applyAmendmentsToResume(resumeData, [
 *   { type: 'add', targetSection: 'skills', description: 'add Python and React' }
 * ]);
 * ```
 *
 * @complexity O(n*m) where n is number of amendments and m is average skill array length
 */
function applyAmendmentsToResume(
  currentContent: Record<string, unknown>,
  amendments: AmendmentRequest[]
): Record<string, unknown> {
  const updatedContent = structuredClone(currentContent); // Deep clone (faster and safer than JSON methods)

  for (const amendment of amendments) {
    const section = amendment.targetSection || 'summary';
    const description = amendment.description.toLowerCase();

    try {
      switch (amendment.type) {
        case 'add':
          if (section === 'skills') {
            // Extract one or multiple comma-separated skills after "add" or "include"
            const match = amendment.description.match(/(?:add|include)\s+([^\n]+?)(?:\s+(?:to|in)\s+skills?)?$/i);
            if (match && match[1]) {
              const blob = match[1]
                .replace(/^(?:to|in)\s+skills?$/i, '')
                .trim();
              const candidates = blob
                .split(/[,;]|\band\b|\bor\b/i)
                .map(s => s.trim())
                .filter(Boolean);

              // Initialize skills structure if it doesn't exist
              if (!updatedContent.skills) {
                updatedContent.skills = { technical: [], soft: [] };
              }

              const skills = updatedContent.skills as { technical: string[], soft: string[] };

              for (const candidate of candidates) {
                const lower = candidate.toLowerCase();
                const isTechnical = TECHNICAL_KEYWORDS.some(keyword => lower.includes(keyword));
                if (isTechnical) {
                  if (!skills.technical.includes(candidate)) {
                    skills.technical.push(candidate);
                  }
                } else {
                  if (!skills.soft.includes(candidate)) {
                    skills.soft.push(candidate);
                  }
                }
              }
            }
          } else if (section === 'summary') {
            // Append to summary
            if (typeof updatedContent[section] === 'string') {
              const addition = amendment.description.replace(/^add\s+/i, '').trim();
              updatedContent[section] = `${updatedContent[section]} ${addition}`.trim();
            }
          } else if (section === 'experience' && Array.isArray(updatedContent[section])) {
            // Add achievement to most recent experience
            const experiences = updatedContent[section] as any[];
            if (experiences.length > 0 && experiences[0].achievements) {
              const achievement = amendment.description.replace(/^add\s+/i, '').trim();
              experiences[0].achievements.push(achievement);
            }
          }
          break;

        case 'modify':
          if (section === 'summary' && typeof updatedContent[section] === 'string') {
            // For now, just note the modification request
            // A full implementation would use AI to rewrite the section
            const modification = amendment.description.replace(/^(?:modify|change|update)\s+/i, '').trim();
            updatedContent[section] = modification || updatedContent[section];
          }
          break;

        case 'remove':
          if (section === 'skills') {
            const skillToRemove = amendment.description.match(/remove\s+([^,.]+)/i)?.[1]?.trim();
            if (skillToRemove && updatedContent.skills) {
              const skills = updatedContent.skills as { technical: string[], soft: string[] };
              skills.technical = skills.technical.filter(s => !s.toLowerCase().includes(skillToRemove.toLowerCase()));
              skills.soft = skills.soft.filter(s => !s.toLowerCase().includes(skillToRemove.toLowerCase()));
            }
          } else if (section === 'experience' && Array.isArray(updatedContent[section])) {
            // Remove specific achievement or experience entry
            // This is simplified - would need better parsing
          }
          break;

        default:
          break;
      }
    } catch (error) {
      console.error(`Error applying amendment to ${section}:`, error);
      // Continue with other amendments even if one fails
    }
  }

  return updatedContent;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to use chat.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ChatSendMessageRequest = await request.json();
    const { session_id, optimization_id, message } = body;

    if (!optimization_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: optimization_id and message are required.' },
        { status: 400 }
      );
    }

    if (message.trim().length < CHAT_CONFIG.minMessageLength || message.length > CHAT_CONFIG.maxMessageLength) {
      return NextResponse.json(
        { error: `Message must be between ${CHAT_CONFIG.minMessageLength} and ${CHAT_CONFIG.maxMessageLength} characters.` },
        { status: 400 }
      );
    }

    // Get or create chat session
    let chatSession;
    if (session_id) {
      // Resume existing session
      const { data: existingSession } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingSession) {
        return NextResponse.json(
          { error: 'Session not found or access denied.' },
          { status: 404 }
        );
      }

      chatSession = existingSession;
    } else {
      // Create or get active session for this optimization (use authenticated client for RLS)
      const activeSession = await getActiveSession(user.id, optimization_id, supabase);

      if (activeSession) {
        chatSession = activeSession;
      } else {
        // Verify user owns the optimization
        const { data: optimization } = await supabase
          .from('optimizations')
          .select('id')
          .eq('id', optimization_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!optimization) {
          return NextResponse.json(
            { error: 'Optimization not found or access denied.' },
            { status: 404 }
          );
        }

        // Create new session using authenticated supabase client
        const { data: newSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: user.id,
            optimization_id,
            status: 'active',
          })
          .select()
          .maybeSingle();

        if (sessionError) {
          // Handle unique constraint violation on idx_active_session by returning existing session
          if ((sessionError as any).code === '23505') {
            const existingActive = await getActiveSession(user.id, optimization_id, supabase);
            if (existingActive) {
              chatSession = existingActive;
            } else {
              return NextResponse.json(
                { error: 'Failed to create chat session: active session exists but could not be retrieved.' },
                { status: 500 }
              );
            }
          } else {
            return NextResponse.json(
              { error: `Failed to create chat session: ${sessionError.message}` },
              { status: 500 }
            );
          }
        }

        if (!chatSession) {
          chatSession = newSession;
        }
      }
    }

    // Save user message using authenticated supabase client
    const { data: userMessage, error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: chatSession.id,
        sender: 'user',
        content: message,
      })
      .select()
      .maybeSingle();

    if (userMessageError) {
      return NextResponse.json(
        { error: `Failed to save user message: ${userMessageError.message}` },
        { status: 500 }
      );
    }

    // Update session last activity
    await supabase
      .from('chat_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', chatSession.id);

    // Get current resume content, ATS suggestions, and design configuration for processing
    const { data: optimization } = await supabase
      .from('optimizations')
      .select('rewrite_data, resume_id, ats_suggestions')
      .eq('id', optimization_id)
      .maybeSingle();

    const currentResumeContent = optimization?.rewrite_data || {};
    const atsSuggestions = optimization?.ats_suggestions || [];

    // Get design assignment and customization if exists
    const designAssignment = await getDesignAssignment(supabase, optimization_id, user.id);

    let currentDesignConfig = null;
    let currentTemplateId = null;

    if (designAssignment) {
      currentTemplateId = designAssignment.template_id;

      if (designAssignment.customization_id) {
        currentDesignConfig = await getDesignCustomizationById(
          designAssignment.customization_id,
          user.id
        );
      }
    }

    // NEW: Detect intent and route to appropriate handler (Spec 008 features)
    const intent = detectIntentRegex(message);

    // Handle tip implementation
    if (intent === 'tip_implementation') {
      const tipResult = await handleTipImplementation({
        message,
        optimizationId: optimization_id,
        atsSuggestions,
        supabase
      });

      if (tipResult.success) {
        // Save AI message
        const { data: aiMessage } = await supabase
          .from('chat_messages')
          .insert({
            session_id: chatSession.id,
            sender: 'ai',
            content: tipResult.message || 'Applied tips successfully',
            metadata: {
              intent: 'tip_implementation',
              tip_numbers: tipResult.tips_applied?.tip_numbers,
              score_change: tipResult.tips_applied?.score_change,
            }
          })
          .select()
          .maybeSingle();

        // Return success response with tips_applied
        return NextResponse.json({
          session_id: chatSession.id,
          message_id: aiMessage.id,
          ai_response: tipResult.message,
          tips_applied: tipResult.tips_applied,
        });
      } else {
        // Save error message
        const { data: aiMessage } = await supabase
          .from('chat_messages')
          .insert({
            session_id: chatSession.id,
            sender: 'ai',
            content: tipResult.error || 'Failed to apply tips',
          })
          .select()
          .maybeSingle();

        // Return error response
        return NextResponse.json({
          session_id: chatSession.id,
          message_id: aiMessage.id,
          ai_response: tipResult.error,
        });
      }
    }

    // Handle color customization
    if (intent === 'color_customization') {
      const colorResult = await handleColorCustomization({
        message,
        optimizationId: optimization_id,
        userId: user.id,
      });

      if (colorResult.success) {
        // Save AI message
        const { data: aiMessage } = await supabase
          .from('chat_messages')
          .insert({
            session_id: chatSession.id,
            sender: 'ai',
            content: colorResult.message || 'Color customization applied',
            metadata: {
              intent: 'color_customization',
              colors_changed: colorResult.color_customization,
            }
          })
          .select()
          .maybeSingle();

        // Return success response with design_customization
        return NextResponse.json({
          session_id: chatSession.id,
          message_id: aiMessage.id,
          ai_response: colorResult.message,
          design_customization: colorResult.design_customization,
        });
      } else {
        // Save error message
        const { data: aiMessage } = await supabase
          .from('chat_messages')
          .insert({
            session_id: chatSession.id,
            sender: 'ai',
            content: colorResult.error || 'Failed to apply color customization',
          })
          .select()
          .maybeSingle();

        // Return error response
        return NextResponse.json({
          session_id: chatSession.id,
          message_id: aiMessage.id,
          ai_response: colorResult.error,
        });
      }
    }

    // Otherwise, continue with existing flow (processUnifiedMessage)
    const startTime = Date.now();
    const processResult = await processUnifiedMessage({
      message,
      sessionId: chatSession.id,
      optimizationId: optimization_id,
      currentResumeContent,
      currentDesignConfig,
      currentTemplateId,
      atsSuggestions  // Pass ATS suggestions for tip implementation
    });
    const processingTime = Date.now() - startTime;

    const aiResponseText = processResult.aiResponse;

    // Save AI message using authenticated supabase client
    const { data: aiMessage, error: aiMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: chatSession.id,
        sender: 'ai',
        content: aiResponseText,
        metadata: {
          ai_model_version: 'gpt-4',
          processing_time_ms: processingTime,
          intent: processResult.intent,
          amendment_type: processResult.contentAmendments?.[0]?.type,
          section_affected: processResult.contentAmendments?.[0]?.targetSection || undefined,
        },
      })
      .select()
      .maybeSingle();

    if (aiMessageError) {
      return NextResponse.json(
        { error: `Failed to save AI message: ${aiMessageError.message}` },
        { status: 500 }
      );
    }

    // Apply changes based on intent
    if (processResult.shouldApply) {
      try {
        // Handle content amendments
        if (processResult.intent === 'content' && processResult.contentAmendments && processResult.contentAmendments.length > 0) {
          console.log('💾 Applying content amendments to database...');
          console.log('📝 Amendments:', processResult.contentAmendments.map(a => `${a.type} - ${a.targetSection}`));

          // Apply amendments to current resume content
          const updatedContent = applyAmendmentsToResume(
            currentResumeContent,
            processResult.contentAmendments
          );

          console.log('📊 Updated content sections:', Object.keys(updatedContent));

          // Update the optimization's rewrite_data in database
          const { error: updateError } = await supabase
            .from('optimizations')
            .update({ rewrite_data: updatedContent })
            .eq('id', optimization_id);

          if (updateError) {
            console.error('❌ Failed to update optimization data:', updateError);
          } else {
            console.log('✅ Successfully updated optimization data after chat amendment');
            if (updatedContent.skills) {
              console.log('🔧 Updated skills:', updatedContent.skills);
            }
          }
        }

        // Handle design customization
        if (processResult.intent === 'design' && processResult.designCustomization) {
          // Create new customization record
          const newCustomization = await createDesignCustomization(user.id, {
            color_scheme: processResult.designCustomization.color_scheme,
            font_family: processResult.designCustomization.font_family,
            spacing: processResult.designCustomization.spacing,
            custom_css: processResult.designCustomization.custom_css,
            is_ats_safe: processResult.designCustomization.is_ats_safe
          });

          // Update assignment with new customization (save previous for undo)
          if (designAssignment) {
            await updateDesignCustomization(
              supabase,
              designAssignment.id,
              newCustomization.id,
              designAssignment.customization_id // Save current as previous for undo
            );
          }

          console.log('Successfully applied design customization via chat');
        }
      } catch (error) {
        console.error('Error applying changes:', error);
        // Don't fail the request if application fails
      }
    }

    // Build response
    const response: ChatSendMessageResponse = {
      session_id: chatSession.id,
      message_id: aiMessage.id,
      ai_response: aiResponseText,
      requires_clarification: processResult.requiresClarification,
    };

    // Attach design preview/customization if available
    if (processResult.intent === 'design') {
      if (processResult.designPreview) {
        response.design_preview = processResult.designPreview;
      }
      if (processResult.designCustomization) {
        response.design_customization = processResult.designCustomization;
      }
    }

    // Attach pending changes for ATS tip implementation
    if (processResult.intent === 'ats_tip' && processResult.pendingChanges) {
      response.pending_changes = processResult.pendingChanges;
      response.tip_numbers = processResult.atsTipNumbers;
      response.intent = processResult.intent;
    }

    // Return response
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/v1/chat:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: errorMessage,
        context: 'An error occurred while processing your message. Please try again or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
