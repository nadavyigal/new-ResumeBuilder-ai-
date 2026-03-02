import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

type CleanupContext = {
  userId?: string;
  resumeId?: string;
  jdId?: string;
  optimizationId?: string;
  applicationId?: string;
  runId?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const { applyExpertWorkflowRun, listApplicationExpertReports, saveAppliedRunToApplication } =
    await import('../src/lib/expert-workflows/orchestrator');

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();
  const cleanup: CleanupContext = {};

  try {
    const email = `expert-e2e-${stamp}@example.com`;
    const password = `E2e-${stamp}-Pass!`;

    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createUser.error || !createUser.data.user) {
      throw new Error(createUser.error?.message || 'Failed to create test user');
    }

    cleanup.userId = createUser.data.user.id;

    const resumeInsert = await supabase
      .from('resumes')
      .insert({
        user_id: cleanup.userId,
        filename: 'expert-e2e-resume.txt',
        storage_path: `local/expert-e2e-resume-${stamp}.txt`,
        raw_text: 'Product Manager with 5 years experience in B2B SaaS and analytics.',
        canonical_data: {},
      })
      .select('id')
      .single();
    if (resumeInsert.error) {
      throw new Error(`Failed to insert resume: ${resumeInsert.error.message}`);
    }
    cleanup.resumeId = resumeInsert.data.id;

    const jdInsert = await supabase
      .from('job_descriptions')
      .insert({
        user_id: cleanup.userId,
        title: 'Senior Product Manager',
        company: 'Acme',
        raw_text: 'Looking for PM with roadmap ownership, KPI tracking, SQL, and stakeholder management.',
        clean_text: 'Looking for PM with roadmap ownership KPI tracking SQL and stakeholder management.',
        parsed_data: {},
      })
      .select('id')
      .single();
    if (jdInsert.error) {
      throw new Error(`Failed to insert job description: ${jdInsert.error.message}`);
    }
    cleanup.jdId = jdInsert.data.id;

    const optimizationInsert = await supabase
      .from('optimizations')
      .insert({
        user_id: cleanup.userId,
        resume_id: cleanup.resumeId,
        jd_id: cleanup.jdId,
        match_score: 62,
        gaps_data: {},
        rewrite_data: {
          summary: 'Product manager with experience leading cross-functional delivery.',
          contact: {
            name: 'E2E User',
            email,
            phone: '050-0000000',
            location: 'Tel Aviv',
          },
          skills: {
            technical: ['Roadmapping', 'Analytics'],
            soft: ['Leadership'],
          },
          experience: [
            {
              title: 'Product Manager',
              company: 'Demo Co',
              location: 'Tel Aviv',
              startDate: '2021-01',
              endDate: '2025-01',
              achievements: ['Led roadmap execution across 3 product lines'],
            },
          ],
          education: [],
          matchScore: 62,
          keyImprovements: [],
          missingKeywords: [],
        },
        template_key: 'ats',
        status: 'completed',
        ats_score_original: 55,
        ats_score_optimized: 62,
      })
      .select('id')
      .single();
    if (optimizationInsert.error) {
      throw new Error(`Failed to insert optimization: ${optimizationInsert.error.message}`);
    }
    cleanup.optimizationId = optimizationInsert.data.id;

    const appInsert = await supabase
      .from('applications')
      .insert({
        user_id: cleanup.userId,
        optimization_id: cleanup.optimizationId,
        job_title: 'Senior Product Manager',
        company_name: 'Acme',
        status: 'saved',
        ats_score: 62,
      })
      .select('id')
      .single();
    if (appInsert.error) {
      throw new Error(`Failed to insert application: ${appInsert.error.message}`);
    }
    cleanup.applicationId = appInsert.data.id;

    const runInsert = await supabase
      .from('expert_workflow_runs')
      .insert({
        user_id: cleanup.userId,
        optimization_id: cleanup.optimizationId,
        workflow_type: 'professional_summary_lab',
        status: 'completed',
        input_json: {},
        missing_evidence_json: [],
        output_json: {
          summary_options: [
            {
              summary:
                'Product manager focused on execution and cross-functional collaboration.',
            },
            {
              summary:
                'Data-driven senior product manager with proven KPI ownership and stakeholder leadership.',
            },
          ],
          recommended_index: 1,
          report: {
            headline: 'Professional Summary Upgrade',
            executive_summary:
              'Your summary now highlights measurable ownership and leadership signals recruiters screen for first.',
            priority_actions: [
              'Keep KPI language in the first line of your summary.',
              'Align summary wording with the target job title and requirements.',
            ],
            evidence_gaps: [
              'Add one quantified business outcome tied to roadmap execution.',
            ],
            ats_impact_estimate: {
              before: 62,
              after: 69,
              delta: 7,
              confidence_note: 'Estimated impact before ATS recomputation.',
            },
          },
        },
      })
      .select('id')
      .single();
    if (runInsert.error) {
      throw new Error(`Failed to insert expert run: ${runInsert.error.message}`);
    }
    cleanup.runId = runInsert.data.id;

    const applyResult = await applyExpertWorkflowRun({
      supabase,
      userId: cleanup.userId,
      runId: cleanup.runId,
      applyMode: 'default',
      selectionIndex: 1,
    });

    const savedReport = await saveAppliedRunToApplication({
      supabase,
      userId: cleanup.userId,
      applicationId: cleanup.applicationId,
      runId: cleanup.runId,
    });

    const reports = await listApplicationExpertReports({
      supabase,
      userId: cleanup.userId,
      applicationId: cleanup.applicationId,
    });

    const optimizationAfter = await supabase
      .from('optimizations')
      .select('ats_score_optimized, rewrite_data')
      .eq('id', cleanup.optimizationId)
      .single();
    if (optimizationAfter.error) {
      throw new Error(`Failed to read optimization after apply: ${optimizationAfter.error.message}`);
    }

    const appAfter = await supabase
      .from('applications')
      .select('ats_score')
      .eq('id', cleanup.applicationId)
      .single();
    if (appAfter.error) {
      throw new Error(`Failed to read application after apply: ${appAfter.error.message}`);
    }

    const appliedSummary =
      (optimizationAfter.data.rewrite_data as any)?.summary || null;

    console.log(
      JSON.stringify(
        {
          success: true,
          apply_result: applyResult,
          saved_report_id: savedReport.id,
          listed_reports_count: reports.length,
          listed_report_delta: reports[0]?.ats_score_delta ?? null,
          optimization_ats_after: optimizationAfter.data.ats_score_optimized,
          application_ats_after: appAfter.data.ats_score,
          summary_after_apply: appliedSummary,
        },
        null,
        2
      )
    );
  } finally {
    if (cleanup.applicationId) {
      await supabase.from('application_expert_reports').delete().eq('application_id', cleanup.applicationId);
      await supabase.from('applications').delete().eq('id', cleanup.applicationId);
    }
    if (cleanup.runId) {
      await supabase.from('expert_workflow_artifacts').delete().eq('run_id', cleanup.runId);
      await supabase.from('expert_workflow_runs').delete().eq('id', cleanup.runId);
    }
    if (cleanup.optimizationId) {
      await supabase.from('optimizations').delete().eq('id', cleanup.optimizationId);
    }
    if (cleanup.resumeId) {
      await supabase.from('resumes').delete().eq('id', cleanup.resumeId);
    }
    if (cleanup.jdId) {
      await supabase.from('job_descriptions').delete().eq('id', cleanup.jdId);
    }
    if (cleanup.userId) {
      await supabase.auth.admin.deleteUser(cleanup.userId);
    }
  }
}

main().catch((error) => {
  console.error('[expert-e2e] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
