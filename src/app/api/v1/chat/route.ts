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

/**
 * Apply amendments to resume content
 * Intelligently modifies resume structure based on amendment requests
 */
function applyAmendmentsToResume(
  currentContent: Record<string, unknown>,
  amendments: AmendmentRequest[]
): Record<string, unknown> {
  const updatedContent = JSON.parse(JSON.stringify(currentContent)); // Deep clone

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

              const technicalKeywords = ['python', 'javascript', 'java', 'react', 'node', 'sql', 'aws', 'docker', 'git', 'api', 'css', 'html', 'typescript', 'ai', 'automation'];

              for (const candidate of candidates) {
                const lower = candidate.toLowerCase();
                const isTechnical = technicalKeywords.some(keyword => lower.includes(keyword));
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

    if (message.trim().length === 0 || message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be between 1 and 5000 characters.' },
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

    // Get current resume content and design configuration for processing
    const { data: optimization } = await supabase
      .from('optimizations')
      .select('rewrite_data, resume_id, ats_suggestions')
      .eq('id', optimization_id)
      .maybeSingle();

    const currentResumeContent = optimization?.rewrite_data || {};
    
    // Check for special intents first (before unified processor)
    const { detectIntentRegex } = await import('@/lib/agent/intents');
    const intent = detectIntentRegex(message);

    console.log('🎯 Intent Detection:', { message, detected_intent: intent });

    // Handle tip implementation
    if (intent === 'tip_implementation') {
      console.log('✅ Handling tip implementation with supabase client:', { hasSupabase: !!supabase, optimizationId: optimization_id, suggestionsCount: optimization?.ats_suggestions?.length || 0 });
      const { handleTipImplementation } = await import('@/lib/agent/handlers/handleTipImplementation');
      const tipResult = await handleTipImplementation({
        message,
        optimizationId: optimization_id,
        atsSuggestions: optimization?.ats_suggestions || [],
        supabase,
      });
      
      // Save AI response
      const aiResponseText = tipResult.message || (tipResult.success 
        ? 'Applied the requested tips successfully!' 
        : tipResult.error || 'Failed to apply tips');
      
      const { data: aiMessage } = await supabase
        .from('chat_messages')
        .insert({
          session_id: chatSession.id,
          sender: 'ai',
          content: aiResponseText,
          metadata: {
            intent: 'tip_implementation',
            tips_applied: tipResult.tips_applied,
          },
        })
        .select()
        .maybeSingle();
      
      // Build response
      const response: any = {
        session_id: chatSession.id,
        message_id: aiMessage?.id,
        ai_response: aiResponseText,
        requires_clarification: false,
      };
      
      if (tipResult.tips_applied) {
        response.tips_applied = tipResult.tips_applied;
      }
      
      return NextResponse.json(response, { status: tipResult.success ? 200 : 400 });
    }
    
    // Handle color customization
    if (intent === 'color_customization') {
      console.log('🎨 Handling color customization with supabase client:', { hasSupabase: !!supabase, optimizationId: optimization_id, userId: user.id });
      const { handleColorCustomization } = await import('@/lib/agent/handlers/handleColorCustomization');
      const colorResult = await handleColorCustomization({
        message,
        optimizationId: optimization_id,
        userId: user.id,
        supabase,
      });
      
      // Save AI response
      const aiResponseText = colorResult.message || (colorResult.success 
        ? 'Applied color changes successfully!' 
        : colorResult.error || 'Failed to apply colors');
      
      const { data: aiMessage } = await supabase
        .from('chat_messages')
        .insert({
          session_id: chatSession.id,
          sender: 'ai',
          content: aiResponseText,
          metadata: {
            intent: 'color_customization',
            color_customization: colorResult.color_customization,
          },
        })
        .select()
        .maybeSingle();
      
      // Build response
      const response: any = {
        session_id: chatSession.id,
        message_id: aiMessage?.id,
        ai_response: aiResponseText,
        requires_clarification: false,
      };
      
      if (colorResult.color_customization) {
        response.color_customization = colorResult.color_customization;
      }
      
      if (colorResult.design_customization) {
        response.design_customization = colorResult.design_customization;
      }
      
      return NextResponse.json(response, { status: colorResult.success ? 200 : 400 });
    }

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

    // Process message through unified processor with OpenAI Assistants API
    const startTime = Date.now();
    let processResult: any;
    try {
      processResult = await processUnifiedMessage({
        message,
        sessionId: chatSession.id,
        optimizationId: optimization_id,
        currentResumeContent,
        currentDesignConfig,
        currentTemplateId: currentTemplateId || undefined,
        threadId: (chatSession as any).openai_thread_id || undefined,
        resumeContext: chatSession.resume_context || undefined,
      });
    } catch (e) {
      // Fallback: simple local parsing for basic design intents
      const lower = message.toLowerCase();
      let designCustomization: any = null;
      if (/background\s+color|background/i.test(lower)) {
        const m = lower.match(/#?[0-9a-f]{3,6}|blue|green|red|yellow|orange|purple|pink|teal|navy|indigo|slate|zinc|brown/);
        const color = m ? m[0] : 'blue';
        designCustomization = { custom_css: `.resume-container { background-color: ${color}; }` };
      } else {
        const m = lower.match(/font\s+(?:to\s+)?([a-zA-Z\s-]+)/);
        if (m && m[1]) {
          const font = m[1].trim();
          designCustomization = { custom_css: `.resume-container { font-family: '${font}', sans-serif; }` };
        }
      }
      processResult = {
        intent: designCustomization ? 'design' : 'unclear',
        aiResponse: designCustomization ? 'Applied design update.' : 'Assistant offline. Try again later.',
        designCustomization,
        shouldApply: !!designCustomization,
        requiresClarification: false,
        updatedContext: chatSession.resume_context || undefined,
        threadId: (chatSession as any).openai_thread_id || undefined,
      };
    }
    const processingTime = Date.now() - startTime;

    // Save thread_id and resume_context back to session
    if (processResult.threadId || processResult.updatedContext) {
      await supabase
        .from('chat_sessions')
        .update({
          thread_id: processResult.threadId,
          resume_context: processResult.updatedContext,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatSession.id);
    }

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
        (response as any).design_preview = processResult.designPreview;
      }
      if (processResult.designCustomization) {
        (response as any).design_customization = processResult.designCustomization;
      }
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

