import OpenAI from 'openai';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { scoreOptimization } from '@/lib/ats/integration';
import { buildRewritePrompt } from './prompts/rewrite';
import { buildQuantifierPrompt } from './prompts/quantifier';
import { buildATSReportPrompt } from './prompts/ats-report';
import { buildSummaryLabPrompt } from './prompts/summary-lab';
import { safeJsonObjectParse, validateWorkflowOutput } from './validators';
import type {
  ExpertApplyResult,
  ExpertRunResult,
  ExpertWorkflowContext,
  ExpertWorkflowType,
  PromptBundle,
} from './types';

const WORKFLOW_TIMEOUT_MS = 30_000;

type RunWorkflowParams = {
  supabase: any;
  userId: string;
  optimizationId: string;
  workflowType: ExpertWorkflowType;
  options?: Record<string, unknown>;
  evidenceInputs?: Record<string, unknown>;
};

type ApplyWorkflowParams = {
  supabase: any;
  userId: string;
  runId: string;
  applyMode?: string;
  selectionIndex?: number;
};

type RunRow = {
  id: string;
  user_id: string;
  optimization_id: string;
  workflow_type: ExpertWorkflowType;
  status: 'completed' | 'needs_user_input' | 'failed';
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  missing_evidence_json: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function extractPromptBundle(context: ExpertWorkflowContext): PromptBundle {
  switch (context.workflow_type) {
    case 'full_resume_rewrite':
      return buildRewritePrompt(context);
    case 'achievement_quantifier':
      return buildQuantifierPrompt(context);
    case 'ats_optimization_report':
      return buildATSReportPrompt(context);
    case 'professional_summary_lab':
      return buildSummaryLabPrompt(context);
    default:
      return buildRewritePrompt(context);
  }
}

async function loadWorkflowContext(params: RunWorkflowParams): Promise<ExpertWorkflowContext> {
  const { supabase, userId, optimizationId, workflowType } = params;

  const { data: optimization, error: optimizationError } = await supabase
    .from('optimizations')
    .select('id, rewrite_data, resume_id, jd_id, ats_score_optimized, ats_score_original')
    .eq('id', optimizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (optimizationError || !optimization) {
    throw new Error('Optimization not found or access denied.');
  }

  const [resumeResult, jdResult] = await Promise.all([
    supabase.from('resumes').select('raw_text').eq('id', optimization.resume_id).maybeSingle(),
    supabase
      .from('job_descriptions')
      .select('title, company, raw_text, clean_text')
      .eq('id', optimization.jd_id)
      .maybeSingle(),
  ]);

  if (resumeResult.error || !resumeResult.data) {
    throw new Error('Resume not found for optimization.');
  }
  if (jdResult.error || !jdResult.data) {
    throw new Error('Job description not found for optimization.');
  }

  const resumeJson = isRecord(optimization.rewrite_data)
    ? (optimization.rewrite_data as unknown as OptimizedResume)
    : ({
        summary: '',
        contact: { name: '', email: '', phone: '', location: '' },
        skills: { technical: [], soft: [] },
        experience: [],
        education: [],
        matchScore: 0,
        keyImprovements: [],
        missingKeywords: [],
      } as OptimizedResume);

  return {
    user_id: userId,
    optimization_id: optimizationId,
    workflow_type: workflowType,
    options: params.options || {},
    evidence_inputs: params.evidenceInputs || {},
    resume_original_text: resumeResult.data.raw_text || '',
    job_description_text: jdResult.data.clean_text || jdResult.data.raw_text || '',
    job_title: jdResult.data.title || 'Position',
    job_company: jdResult.data.company || 'Company',
    current_resume_json: resumeJson,
    current_ats_score_optimized: optimization.ats_score_optimized,
    current_ats_score_original: optimization.ats_score_original,
  };
}

async function runModelWithRetry(
  prompt: PromptBundle
): Promise<Record<string, unknown>> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completionPromise = client.chat.completions.create({
        model: prompt.model,
        temperature: prompt.temperature,
        max_tokens: prompt.max_tokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Expert workflow request timed out.')), WORKFLOW_TIMEOUT_MS);
      });

      const completion = (await Promise.race([completionPromise, timeoutPromise])) as any;
      const content = completion?.choices?.[0]?.message?.content || '';
      const parsed = safeJsonObjectParse(content);
      if (!parsed) {
        throw new Error('Model returned malformed JSON.');
      }
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown model error');
      const msg = lastError.message.toLowerCase();
      const retryable =
        msg.includes('timeout') ||
        msg.includes('rate limit') ||
        msg.includes('temporarily') ||
        msg.includes('overloaded');
      if (!retryable || attempt === 1) break;
    }
  }

  throw lastError || new Error('Unknown expert workflow model error.');
}

function extractArtifacts(
  workflowType: ExpertWorkflowType,
  output: Record<string, unknown>
): Array<{ artifact_type: string; artifact_json: Record<string, unknown> }> {
  if (workflowType === 'professional_summary_lab' && Array.isArray(output.summary_options)) {
    return output.summary_options
      .filter(isRecord)
      .map((option, index) => ({
        artifact_type: 'summary_option',
        artifact_json: { ...option, index },
      }));
  }

  if (workflowType === 'achievement_quantifier' && Array.isArray(output.bullet_rewrites)) {
    return output.bullet_rewrites
      .filter(isRecord)
      .slice(0, 20)
      .map((rewrite) => ({
        artifact_type: 'quantified_bullet',
        artifact_json: rewrite,
      }));
  }

  if (workflowType === 'ats_optimization_report' && isRecord(output.ats_report)) {
    return [
      {
        artifact_type: 'ats_report',
        artifact_json: output.ats_report,
      },
    ];
  }

  return [];
}

export async function runExpertWorkflow(params: RunWorkflowParams): Promise<ExpertRunResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const context = await loadWorkflowContext(params);
  const prompt = extractPromptBundle(context);
  const parsed = await runModelWithRetry(prompt);
  const validation = validateWorkflowOutput(context.workflow_type, parsed);

  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid expert workflow output.');
  }

  const status = validation.missingEvidence.length > 0 ? 'needs_user_input' : 'completed';

  const input_json = {
    options: context.options,
    evidence_inputs: context.evidence_inputs,
  };

  const db = params.supabase as any;
  const { data: runRow, error: runError } = await db
    .from('expert_workflow_runs')
    .insert({
      user_id: context.user_id,
      optimization_id: context.optimization_id,
      workflow_type: context.workflow_type,
      status,
      input_json,
      output_json: parsed,
      missing_evidence_json: validation.missingEvidence,
    })
    .select('id')
    .maybeSingle();

  if (runError || !runRow) {
    throw new Error(runError?.message || 'Failed to save expert workflow run.');
  }

  const artifacts = extractArtifacts(context.workflow_type, parsed);
  if (artifacts.length > 0) {
    const payload = artifacts.map((artifact) => ({
      run_id: runRow.id,
      artifact_type: artifact.artifact_type,
      artifact_json: artifact.artifact_json,
    }));
    await db.from('expert_workflow_artifacts').insert(payload);
  }

  return {
    run_id: runRow.id,
    status,
    output: parsed,
    needs_user_input: status === 'needs_user_input',
    missing_evidence: validation.missingEvidence,
  };
}

function applyQuantifierOutput(
  currentResume: OptimizedResume,
  output: Record<string, unknown>,
  updatedFields: string[]
) {
  if (!Array.isArray(output.bullet_rewrites)) return;

  const rows = output.bullet_rewrites.filter(isRecord);
  rows.forEach((row) => {
    const expIndex = Number(row.experience_index);
    const bulletIndex = Number(row.bullet_index);
    const original = String(row.original_bullet || '');
    const optimized = String(row.optimized_bullet || '');
    if (!optimized) return;

    if (
      Number.isInteger(expIndex) &&
      Number.isInteger(bulletIndex) &&
      expIndex >= 0 &&
      bulletIndex >= 0 &&
      Array.isArray(currentResume.experience) &&
      currentResume.experience[expIndex] &&
      Array.isArray(currentResume.experience[expIndex].achievements) &&
      currentResume.experience[expIndex].achievements[bulletIndex]
    ) {
      currentResume.experience[expIndex].achievements[bulletIndex] = optimized;
      updatedFields.push(`experience.${expIndex}.achievements.${bulletIndex}`);
      return;
    }

    const target = normalizeText(original);
    if (!target) return;
    for (let i = 0; i < currentResume.experience.length; i += 1) {
      const achievements = currentResume.experience[i].achievements || [];
      for (let j = 0; j < achievements.length; j += 1) {
        if (normalizeText(achievements[j]) === target) {
          currentResume.experience[i].achievements[j] = optimized;
          updatedFields.push(`experience.${i}.achievements.${j}`);
          return;
        }
      }
    }
  });
}

function applySummaryLabOutput(
  currentResume: OptimizedResume,
  output: Record<string, unknown>,
  selectionIndex: number | undefined,
  updatedFields: string[]
) {
  if (!Array.isArray(output.summary_options)) return;
  const options = output.summary_options.filter(isRecord);
  if (options.length === 0) return;

  const defaultIndex = Number.isInteger(Number(output.recommended_index))
    ? Number(output.recommended_index)
    : 0;
  const targetIndex =
    typeof selectionIndex === 'number' && selectionIndex >= 0 && selectionIndex < options.length
      ? selectionIndex
      : defaultIndex;

  const selected = options[targetIndex];
  if (!selected) return;
  const summary = String(selected.summary || '').trim();
  if (!summary) return;
  currentResume.summary = summary;
  updatedFields.push('summary');
}

function applyATSReportOutput(
  currentResume: OptimizedResume,
  output: Record<string, unknown>,
  applyMode: string,
  updatedFields: string[]
) {
  if (applyMode !== 'skills_only') return;
  if (!isRecord(output.ats_report)) return;
  const report = output.ats_report;
  const keywords = Array.isArray(report.recommended_keywords_to_add)
    ? report.recommended_keywords_to_add
        .filter((kw): kw is string => typeof kw === 'string' && kw.trim().length > 0)
        .slice(0, 20)
    : [];
  if (keywords.length === 0) return;

  const set = new Set<string>(currentResume.skills?.technical || []);
  keywords.forEach((kw) => set.add(kw));
  currentResume.skills.technical = Array.from(set);
  updatedFields.push('skills.technical');
}

function resolveCurrentResume(rewriteData: unknown): OptimizedResume {
  if (isRecord(rewriteData)) {
    return rewriteData as unknown as OptimizedResume;
  }
  return {
    summary: '',
    contact: { name: '', email: '', phone: '', location: '' },
    skills: { technical: [], soft: [] },
    experience: [],
    education: [],
    matchScore: 0,
    keyImprovements: [],
    missingKeywords: [],
  };
}

export async function applyExpertWorkflowRun(params: ApplyWorkflowParams): Promise<ExpertApplyResult> {
  const db = params.supabase as any;

  const { data: run, error: runError } = await db
    .from('expert_workflow_runs')
    .select('*')
    .eq('id', params.runId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (runError || !run) {
    throw new Error('Expert workflow run not found.');
  }

  const runRow = run as RunRow;
  const output = isRecord(runRow.output_json) ? runRow.output_json : {};

  const { data: optimization, error: optimizationError } = await params.supabase
    .from('optimizations')
    .select('id, rewrite_data, resume_id, jd_id')
    .eq('id', runRow.optimization_id)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (optimizationError || !optimization) {
    throw new Error('Optimization not found for this workflow run.');
  }

  let updatedResume = resolveCurrentResume(optimization.rewrite_data);
  const updatedFields: string[] = [];
  const applyMode = params.applyMode || 'default';

  if (runRow.workflow_type === 'full_resume_rewrite') {
    if (isRecord(output.rewritten_resume)) {
      updatedResume = output.rewritten_resume as unknown as OptimizedResume;
      updatedFields.push('entire_resume');
    }
  } else if (runRow.workflow_type === 'achievement_quantifier') {
    applyQuantifierOutput(updatedResume, output, updatedFields);
  } else if (runRow.workflow_type === 'professional_summary_lab') {
    applySummaryLabOutput(updatedResume, output, params.selectionIndex, updatedFields);
  } else if (runRow.workflow_type === 'ats_optimization_report') {
    applyATSReportOutput(updatedResume, output, applyMode, updatedFields);
  }

  if (updatedFields.length === 0) {
    return { success: true, updated_fields: [] };
  }

  const { error: updateError } = await params.supabase
    .from('optimizations')
    .update({ rewrite_data: updatedResume })
    .eq('id', optimization.id);

  if (updateError) {
    throw new Error(updateError.message || 'Failed to apply expert workflow output.');
  }

  let newAtsScore: number | null = null;
  try {
    const [resumeResult, jdResult] = await Promise.all([
      params.supabase.from('resumes').select('raw_text').eq('id', optimization.resume_id).maybeSingle(),
      params.supabase.from('job_descriptions').select('raw_text, clean_text, title').eq('id', optimization.jd_id).maybeSingle(),
    ]);

    if (resumeResult.data && jdResult.data) {
      const scoreResult = await scoreOptimization({
        resumeOriginalText: resumeResult.data.raw_text || '',
        resumeOptimizedJson: updatedResume,
        jobDescriptionText: jdResult.data.clean_text || jdResult.data.raw_text || '',
        jobTitle: jdResult.data.title || 'Position',
      });

      newAtsScore = scoreResult.ats_score_optimized;

      await params.supabase
        .from('optimizations')
        .update({
          ats_score_original: scoreResult.ats_score_original,
          ats_score_optimized: scoreResult.ats_score_optimized,
          ats_subscores: scoreResult.subscores,
          ats_subscores_original: scoreResult.subscores_original,
          ats_suggestions: scoreResult.suggestions,
          ats_confidence: scoreResult.confidence,
          match_score: scoreResult.ats_score_optimized,
        })
        .eq('id', optimization.id);
    }
  } catch {
    // Keep successful apply behavior even when ATS recomputation fails.
  }

  await db
    .from('expert_workflow_runs')
    .update({ status: 'completed' })
    .eq('id', runRow.id)
    .eq('user_id', params.userId);

  return {
    success: true,
    updated_fields: updatedFields,
    new_ats_score: newAtsScore,
  };
}
