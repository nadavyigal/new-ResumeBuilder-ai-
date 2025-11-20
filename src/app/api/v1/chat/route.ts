/**
 * POST /api/v1/chat
 *
 * Send a chat message and receive AI response.
 * Creates or resumes session automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
// Ensure Node runtime for dynamic server-only imports in fallback
export const runtime = 'nodejs';
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
import { AmendmentRequest, detectFabrication } from '@/lib/chat-manager/processor';
import { applyModification } from '@/lib/resume/modification-applier';

/**
 * Apply amendments to resume content
 * Intelligently modifies resume structure based on amendment requests
 */
function sanitizeAmendmentValue(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[•▪●■◆▼►]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidStructuredAmendment(amendment: AmendmentRequest): amendment is AmendmentRequest & { section: NonNullable<AmendmentRequest['section']> } {
  return Boolean(amendment.section) && ['add', 'modify', 'remove'].includes(amendment.operation);
}

function parseSkillList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((skill) => sanitizeAmendmentValue(skill))
    .filter(Boolean);
}

function parseTargetField(targetField?: string): { field: string; itemIndex?: number } {
  if (!targetField) {
    return { field: 'achievements' };
  }

  const match = targetField.match(/^(\w+)(?:\[(\d+)\])?$/);
  if (match) {
    const [, field, index] = match;
    return { field, itemIndex: index ? parseInt(index, 10) : undefined };
  }

  return { field: targetField };
}

function applySummaryAmendment(resume: Record<string, any>, amendment: AmendmentRequest) {
  const updated = { ...resume };
  if (typeof updated.summary !== 'string') {
    updated.summary = '';
  }

  switch (amendment.operation) {
    case 'add':
      return applyModification(updated, {
        operation: 'suffix',
        field_path: 'summary',
        new_value: updated.summary ? ` ${amendment.value}` : amendment.value,
      });
    case 'modify':
      return applyModification(updated, {
        operation: 'replace',
        field_path: 'summary',
        new_value: amendment.value,
      });
    case 'remove':
      return applyModification(updated, {
        operation: 'replace',
        field_path: 'summary',
        new_value: '',
      });
    default:
      return updated;
  }
}

function applySkillsAmendment(resume: Record<string, any>, amendment: AmendmentRequest) {
  const updated = JSON.parse(JSON.stringify(resume));
  const targetField = amendment.targetField === 'soft' ? 'soft' : 'technical';
  const pathBase = `skills.${targetField}`;
  const skillsList = parseSkillList(amendment.value);

  updated.skills = updated.skills || {};
  if (!Array.isArray(updated.skills[targetField])) {
    updated.skills[targetField] = [];
  }

  switch (amendment.operation) {
    case 'add': {
      const existing = new Set((updated.skills[targetField] as string[]).map((s) => s.toLowerCase()));
      let result = updated;

      for (const skill of skillsList) {
        if (!existing.has(skill.toLowerCase())) {
          result = applyModification(result, {
            operation: 'append',
            field_path: pathBase,
            new_value: skill,
          });
          existing.add(skill.toLowerCase());
        }
      }

      return result;
    }
    case 'modify': {
      const targetIndex = amendment.targetIndex ?? 0;
      const replacement = skillsList[0] || amendment.value;
      return applyModification(updated, {
        operation: 'replace',
        field_path: `${pathBase}[${targetIndex}]`,
        new_value: replacement,
      });
    }
    case 'remove': {
      const skillsArray: string[] = updated.skills[targetField];
      const targetIndex = amendment.targetIndex ?? skillsArray.findIndex((skill) => skill.toLowerCase() === amendment.value.toLowerCase());

      if (targetIndex < 0 || targetIndex >= skillsArray.length) {
        return updated;
      }

      return applyModification(updated, {
        operation: 'remove',
        field_path: `${pathBase}[${targetIndex}]`,
      });
    }
    default:
      return updated;
  }
}

function applyExperienceAmendment(resume: Record<string, any>, amendment: AmendmentRequest) {
  if (!Array.isArray(resume.experience)) {
    return resume;
  }

  const experienceIndex = amendment.targetIndex ?? 0;
  if (experienceIndex < 0 || experienceIndex >= resume.experience.length) {
    return resume;
  }

  const { field, itemIndex } = parseTargetField(amendment.targetField);
  const basePath = `experience[${experienceIndex}]`;
  const experienceEntry = resume.experience[experienceIndex] || {};

  const titleFields = ['title', 'role', 'position'];
  const bulletFields = ['achievements', 'responsibilities', 'bullets'];

  if (titleFields.includes(field)) {
    if (amendment.operation === 'remove') {
      return applyModification(resume, {
        operation: 'replace',
        field_path: `${basePath}.${field}`,
        new_value: '',
      });
    }

    return applyModification(resume, {
      operation: 'replace',
      field_path: `${basePath}.${field}`,
      new_value: amendment.value,
    });
  }

  if (bulletFields.includes(field)) {
    const path = `${basePath}.${field}`;
    const bullets = experienceEntry[field];

    if (!Array.isArray(bullets)) {
      if (amendment.operation !== 'add') {
        return resume;
      }
    }

    switch (amendment.operation) {
      case 'add':
        return applyModification(resume, {
          operation: 'append',
          field_path: path,
          new_value: amendment.value,
        });
      case 'modify': {
        const target = itemIndex ?? 0;
        return applyModification(resume, {
          operation: 'replace',
          field_path: `${path}[${target}]`,
          new_value: amendment.value,
        });
      }
      case 'remove': {
        const target = itemIndex ?? 0;
        return applyModification(resume, {
          operation: 'remove',
          field_path: `${path}[${target}]`,
        });
      }
      default:
        return resume;
    }
  }

  // Default to replacing the chosen field on the experience entry
  return applyModification(resume, {
    operation: 'replace',
    field_path: `${basePath}.${field}`,
    new_value: amendment.value,
  });
}

function applyAmendmentsToResume(
  currentContent: Record<string, unknown>,
  amendments: AmendmentRequest[]
): Record<string, unknown> {
  let updatedContent = JSON.parse(JSON.stringify(currentContent)); // Deep clone

  for (const amendment of amendments) {
    if (!isValidStructuredAmendment(amendment)) {
      continue;
    }

    if (detectFabrication(`${amendment.operation} ${amendment.value}`, currentContent)) {
      console.warn('Skipping amendment due to fabrication detection', amendment);
      continue;
    }

    const sanitizedValue = sanitizeAmendmentValue(amendment.value);
    if (!sanitizedValue) {
      console.warn('Skipping amendment with empty sanitized value', amendment);
      continue;
    }
    const sanitizedAmendment = { ...amendment, value: sanitizedValue };

    try {
      switch (sanitizedAmendment.section) {
        case 'summary':
          updatedContent = applySummaryAmendment(updatedContent, sanitizedAmendment);
          break;
        case 'skills':
          updatedContent = applySkillsAmendment(updatedContent, sanitizedAmendment);
          break;
        case 'experience':
          updatedContent = applyExperienceAmendment(updatedContent, sanitizedAmendment);
          break;
        default:
          console.warn(`Unsupported amendment section: ${sanitizedAmendment.section}`);
          break;
      }
    } catch (error) {
      console.error(`Error applying amendment to ${sanitizedAmendment.section}:`, error);
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

    console.log('[intent]', { message, detected_intent: intent });

    // Handle tip implementation
    if (intent === 'tip_implementation') {
      console.log('[tip] Handling tip implementation with supabase client:', { hasSupabase: !!supabase, optimizationId: optimization_id, suggestionsCount: optimization?.ats_suggestions?.length || 0 });
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
      console.log('[color] Handling color customization with supabase client:', { hasSupabase: !!supabase, optimizationId: optimization_id, userId: user.id });
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
        threadId: chatSession.thread_id || undefined,
        resumeContext: chatSession.resume_context || undefined,
      });
    } catch (e) {
      // Robust fallback: use local design customization engine for natural-language design requests
      try {
        // Dynamic import to avoid edge-runtime import issues for server-only modules
        const { validateAndApply } = await import('@/lib/design-manager/customization-engine');
        const templateIdFallback = currentTemplateId || 'natural';
        const result = await validateAndApply(
          message,
          templateIdFallback,
          currentDesignConfig || {},
          currentResumeContent
        );

        if ('understood' in (result as any) && (result as any).understood === false) {
          processResult = {
            intent: 'unclear',
            aiResponse: (result as any).clarificationNeeded || 'Unable to process request.',
            shouldApply: false,
            requiresClarification: true,
            updatedContext: chatSession.resume_context || undefined,
            threadId: chatSession.thread_id || undefined,
          };
        } else {
          const custom = result as any;
          processResult = {
            intent: 'design',
            aiResponse: custom.reasoning || 'Applied design customization.',
            designCustomization: custom.customization,
            designPreview: custom.preview,
            shouldApply: true,
            requiresClarification: false,
            updatedContext: chatSession.resume_context || undefined,
            threadId: chatSession.thread_id || undefined,
          };
        }
      } catch (innerErr) {
        // Final minimal fallback on total failure: provide a basic reply instead of 500
        processResult = {
          intent: 'unclear',
          aiResponse: 'I could not process that. For design, try: "change background to navy" or "font to Georgia". For content, try: "add Python to skills".',
          shouldApply: false,
          requiresClarification: true,
          updatedContext: chatSession.resume_context || undefined,
          threadId: chatSession.thread_id || undefined,
        };
      }
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
          amendment_type: processResult.contentAmendments?.[0]?.operation,
          section_affected: processResult.contentAmendments?.[0]?.section || undefined,
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
          console.log('[db] Applying content amendments to database...');
          console.log('[amendments]:', processResult.contentAmendments.map(a => `${a.operation} - ${a.section}`));

          // Apply amendments to current resume content
          const updatedContent = applyAmendmentsToResume(
            currentResumeContent,
            processResult.contentAmendments
          );

          console.log('[sections]:', Object.keys(updatedContent));

          // Update the optimization's rewrite_data in database
          const { error: updateError } = await supabase
            .from('optimizations')
            .update({ rewrite_data: updatedContent })
            .eq('id', optimization_id);

          if (updateError) {
            console.error('[error] Failed to update optimization data:', updateError);
          } else {
            console.log('[ok] Updated optimization data after chat amendment');
            if (updatedContent.skills) {
              console.log('[skills] Updated skills:', updatedContent.skills);
            }
          }
        }

        // Handle design customization from OpenAI Assistant
        if (processResult.intent === 'design' && processResult.designCustomization) {
          // Upsert directly to design_assignments table using JSONB customization column
          const customizationData = {
            color_scheme: processResult.designCustomization.color_scheme,
            font_family: processResult.designCustomization.font_family,
            spacing: processResult.designCustomization.spacing,
            custom_css: processResult.designCustomization.custom_css,
          };

          // Merge with existing customization if present
          const existingCustomization = designAssignment?.customization || {};
          const mergedCustomization = {
            ...existingCustomization,
            ...customizationData,
          };

          // Upsert to design_assignments table
          await supabase
            .from('design_assignments')
            .upsert({
              optimization_id: optimization_id,
              user_id: user.id,
              template_id: designAssignment?.template_id || null,
              customization: mergedCustomization,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'optimization_id'
            });

          console.log('Successfully applied design customization via OpenAI Assistant');
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

