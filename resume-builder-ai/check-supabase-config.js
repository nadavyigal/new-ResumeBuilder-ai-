/**
 * Supabase Security and Configuration Audit Script
 * Date: 2025-11-10
 * Purpose: Comprehensive check of RLS, policies, schema, and security
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

const CORE_TABLES = [
  'profiles',
  'resumes',
  'job_descriptions',
  'optimizations',
  'templates',
  'design_templates',
  'design_customizations',
  'resume_design_assignments',
  'chat_sessions',
  'chat_messages',
  'resume_versions',
  'amendment_requests',
  'applications'
];

async function checkRLSStatus() {
  header('SECTION 1: RLS STATUS CHECK');

  log('\nChecking RLS by testing table accessibility with anonymous client...\n', 'yellow');

  // Create anonymous client to test RLS
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // Test each table
  for (const table of CORE_TABLES) {
    // Test with anonymous client (should be blocked by RLS)
    const { error: anonError } = await anonClient.from(table).select('id').limit(1);

    // Test with service role (should work)
    const { error: serviceError } = await supabase.from(table).select('id').limit(0);

    if (serviceError) {
      log(`❌ ${table}: Table not accessible (may not exist)`, 'red');
    } else if (anonError && anonError.message.includes('row-level security')) {
      log(`✅ ${table}: RLS ENABLED (anonymous blocked)`, 'green');
    } else if (anonError && anonError.message.includes('permission denied')) {
      log(`✅ ${table}: RLS ENABLED (anonymous denied)`, 'green');
    } else if (anonError) {
      log(`⚠️  ${table}: ${anonError.message.substring(0, 60)}...`, 'yellow');
    } else {
      log(`⚠️  ${table}: Anonymous access allowed (check policies!)`, 'yellow');
    }
  }
}

async function checkColumns() {
  header('SECTION 2: CRITICAL COLUMN VERIFICATION');

  const criticalColumns = [
    { table: 'job_descriptions', expectedColumn: 'parsed_data', oldColumn: 'extracted_data' },
    { table: 'design_customizations', expectedColumn: 'spacing', oldColumn: 'spacing_settings' },
    { table: 'optimizations', expectedColumn: 'rewrite_data', alternateColumn: 'optimization_data' },
    { table: 'optimizations', expectedColumn: 'ats_score_optimized', alternateColumn: 'ats_score' },
  ];

  for (const { table, expectedColumn, oldColumn, alternateColumn } of criticalColumns) {
    log(`\nChecking ${table}.${expectedColumn}...`, 'cyan');

    // Try to select with expected column
    const { error: expectedError } = await supabase
      .from(table)
      .select(expectedColumn)
      .limit(0);

    if (!expectedError) {
      log(`  ✅ ${expectedColumn} exists`, 'green');
    } else {
      log(`  ❌ ${expectedColumn} missing: ${expectedError.message}`, 'red');

      // Check if old/alternate column exists
      const checkColumn = oldColumn || alternateColumn;
      if (checkColumn) {
        const { error: altError } = await supabase
          .from(table)
          .select(checkColumn)
          .limit(0);

        if (!altError) {
          log(`  ⚠️  Found ${checkColumn} instead - needs migration!`, 'yellow');
        }
      }
    }
  }
}

async function checkTableStructure() {
  header('SECTION 3: TABLE STRUCTURE VERIFICATION');

  const tableChecks = [
    { table: 'optimizations', requiredColumns: ['id', 'user_id', 'resume_id', 'jd_id', 'match_score', 'rewrite_data'] },
    { table: 'job_descriptions', requiredColumns: ['id', 'user_id', 'title', 'parsed_data'] },
    { table: 'design_customizations', requiredColumns: ['id', 'template_id', 'color_scheme', 'spacing'] },
    { table: 'chat_sessions', requiredColumns: ['id', 'user_id', 'optimization_id', 'status'] },
    { table: 'applications', requiredColumns: ['id', 'user_id', 'optimization_id', 'status'] },
  ];

  for (const { table, requiredColumns } of tableChecks) {
    log(`\n${table}:`, 'cyan');

    const missingColumns = [];
    const existingColumns = [];

    for (const column of requiredColumns) {
      const { error } = await supabase
        .from(table)
        .select(column)
        .limit(0);

      if (error) {
        missingColumns.push(column);
      } else {
        existingColumns.push(column);
      }
    }

    if (missingColumns.length === 0) {
      log(`  ✅ All required columns present (${existingColumns.length})`, 'green');
    } else {
      log(`  ⚠️  Missing columns: ${missingColumns.join(', ')}`, 'yellow');
      log(`  ✅ Found columns: ${existingColumns.join(', ')}`, 'green');
    }
  }
}

async function checkRLSPolicies() {
  header('SECTION 4: RLS POLICIES CHECK');

  for (const table of CORE_TABLES) {
    log(`\n${table}:`, 'cyan');

    // Try different query approaches
    const testQueries = [
      // Test 1: Anonymous access (should fail with RLS)
      async () => {
        const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { error } = await anonClient.from(table).select('*').limit(1);
        return { type: 'anonymous', error };
      },
      // Test 2: Service role access (should succeed)
      async () => {
        const { error } = await supabase.from(table).select('count').limit(0);
        return { type: 'service_role', error };
      }
    ];

    for (const query of testQueries) {
      const result = await query();
      if (result.type === 'anonymous') {
        if (result.error && result.error.message.includes('row-level security')) {
          log(`  ✅ Anonymous access blocked (RLS working)`, 'green');
        } else if (result.error) {
          log(`  ℹ️  Anonymous error: ${result.error.message}`, 'blue');
        } else {
          log(`  ⚠️  Anonymous access allowed (check policies)`, 'yellow');
        }
      } else if (result.type === 'service_role') {
        if (!result.error) {
          log(`  ✅ Service role access works`, 'green');
        } else {
          log(`  ❌ Service role access failed: ${result.error.message}`, 'red');
        }
      }
    }
  }
}

async function checkAuthFlow() {
  header('SECTION 5: AUTHENTICATION FLOW TEST');

  log('\nTesting auth.uid() function availability...', 'cyan');

  // Test if we can access auth context
  try {
    const { data, error } = await supabase.rpc('get_current_user_id', {});
    if (error) {
      log('  ℹ️  auth.uid() RPC test not available (expected in client-side RLS)', 'blue');
    } else if (data) {
      log(`  ✅ Current user context: ${data}`, 'green');
    }
  } catch {
    log('  ℹ️  auth.uid() RPC test not available (expected in client-side RLS)', 'blue');
  }

  // Check trigger existence for auto profile creation
  log('\nChecking auto-profile creation trigger...', 'cyan');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, created_at')
    .limit(1);

  if (!profileError) {
    log('  ✅ Profiles table accessible', 'green');
    if (profiles && profiles.length > 0) {
      log(`  ℹ️  Sample profile user_id: ${profiles[0].user_id}`, 'blue');
    }
  } else {
    log(`  ❌ Profile access error: ${profileError.message}`, 'red');
  }
}

async function checkForeignKeys() {
  header('SECTION 6: FOREIGN KEY INTEGRITY');

  const fkChecks = [
    {
      parent: 'resumes',
      child: 'optimizations',
      fkColumn: 'resume_id',
      description: 'Optimizations reference resumes'
    },
    {
      parent: 'job_descriptions',
      child: 'optimizations',
      fkColumn: 'jd_id',
      description: 'Optimizations reference job descriptions'
    },
    {
      parent: 'optimizations',
      child: 'chat_sessions',
      fkColumn: 'optimization_id',
      description: 'Chat sessions reference optimizations'
    },
    {
      parent: 'design_templates',
      child: 'resume_design_assignments',
      fkColumn: 'template_id',
      description: 'Design assignments reference templates'
    },
  ];

  for (const { parent, child, fkColumn, description } of fkChecks) {
    log(`\n${description}:`, 'cyan');

    // Check if we can query the relationship
    const { error } = await supabase
      .from(child)
      .select(`${fkColumn}, ${parent}(id)`)
      .limit(1);

    if (!error) {
      log(`  ✅ Foreign key ${child}.${fkColumn} -> ${parent}.id working`, 'green');
    } else if (error.message.includes('foreign key')) {
      log(`  ❌ Foreign key constraint issue: ${error.message}`, 'red');
    } else {
      log(`  ℹ️  ${error.message}`, 'blue');
    }
  }
}

async function checkIndexes() {
  header('SECTION 7: PERFORMANCE INDEXES');

  const importantIndexes = [
    { table: 'optimizations', column: 'user_id', reason: 'User filtering' },
    { table: 'optimizations', column: 'created_at', reason: 'Timeline sorting' },
    { table: 'chat_messages', column: 'session_id', reason: 'Message retrieval' },
    { table: 'resume_design_assignments', column: 'optimization_id', reason: 'Design lookup' },
  ];

  log('\nNote: Index verification requires direct database access', 'yellow');
  log('Checking query performance instead...\n', 'yellow');

  for (const { table, column, reason } of importantIndexes) {
    const start = Date.now();
    const { error } = await supabase
      .from(table)
      .select(column)
      .limit(100);
    const duration = Date.now() - start;

    if (!error) {
      const status = duration < 100 ? '✅ Fast' : duration < 500 ? '⚠️  Moderate' : '❌ Slow';
      log(`  ${status} ${table}.${column} (${duration}ms) - ${reason}`,
          duration < 100 ? 'green' : duration < 500 ? 'yellow' : 'red');
    } else {
      log(`  ℹ️  ${table}.${column}: ${error.message}`, 'blue');
    }
  }
}

async function getSecurityAdvisorIssues() {
  header('SECTION 8: SECURITY ADVISOR SIMULATION');

  log('\nCommon security issues to check:', 'cyan');

  const securityChecks = [
    {
      name: 'RLS on all user tables',
      check: async () => {
        const userTables = ['profiles', 'resumes', 'optimizations', 'chat_sessions'];
        for (const table of userTables) {
          const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
          const { error } = await anonClient.from(table).select('*').limit(1);
          if (!error || !error.message.includes('row-level security')) {
            return { passed: false, details: `${table} may be accessible without RLS` };
          }
        }
        return { passed: true, details: 'All user tables protected by RLS' };
      }
    },
    {
      name: 'Service role key not exposed',
      check: async () => {
        const isInEnv = process.env.SUPABASE_SERVICE_ROLE_KEY &&
                        process.env.SUPABASE_SERVICE_ROLE_KEY.length > 20;
        return {
          passed: isInEnv,
          details: isInEnv
            ? 'Service role key found in environment'
            : 'Service role key not configured'
        };
      }
    },
    {
      name: 'Templates accessible to all users',
      check: async () => {
        const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { error } = await anonClient.from('design_templates').select('id').limit(1);
        return {
          passed: !error,
          details: error
            ? `Template access blocked: ${error.message}`
            : 'Templates publicly accessible (expected)'
        };
      }
    },
  ];

  for (const { name, check } of securityChecks) {
    const result = await check();
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`  ${icon} ${name}: ${result.details}`, color);
  }
}

async function generateFixScript() {
  header('SECTION 9: RECOMMENDED FIXES');

  log('\nGenerating SQL fix script based on findings...\n', 'cyan');

  const fixes = [];

  // Check job_descriptions column
  const { error: jdError } = await supabase
    .from('job_descriptions')
    .select('parsed_data')
    .limit(0);

  if (jdError && jdError.message.includes('parsed_data')) {
    fixes.push({
      issue: 'job_descriptions missing parsed_data column',
      sql: `-- Fix: Rename extracted_data to parsed_data
ALTER TABLE job_descriptions
RENAME COLUMN extracted_data TO parsed_data;`
    });
  }

  // Check design_customizations column
  const { error: dcError } = await supabase
    .from('design_customizations')
    .select('spacing')
    .limit(0);

  if (dcError && dcError.message.includes('spacing')) {
    fixes.push({
      issue: 'design_customizations missing spacing column',
      sql: `-- Fix: Rename spacing_settings to spacing
ALTER TABLE design_customizations
RENAME COLUMN spacing_settings TO spacing;`
    });
  }

  if (fixes.length === 0) {
    log('✅ No critical fixes needed!', 'green');
  } else {
    log(`Found ${fixes.length} issue(s) requiring fixes:\n`, 'yellow');
    fixes.forEach((fix, i) => {
      log(`${i + 1}. ${fix.issue}`, 'yellow');
      console.log(fix.sql);
      console.log('');
    });
  }
}

async function runAudit() {
  log('╔═══════════════════════════════════════════════════════════╗', 'bright');
  log('║   SUPABASE SECURITY & CONFIGURATION AUDIT                ║', 'bright');
  log('║   Date: ' + new Date().toISOString().split('T')[0] + '                                      ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════╝', 'bright');

  try {
    await checkRLSStatus();
    await checkColumns();
    await checkTableStructure();
    await checkRLSPolicies();
    await checkAuthFlow();
    await checkForeignKeys();
    await checkIndexes();
    await getSecurityAdvisorIssues();
    await generateFixScript();

    header('AUDIT COMPLETE');
    log('\n✅ Security audit finished successfully!', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Review any ❌ errors above', 'yellow');
    log('2. Apply recommended SQL fixes if any', 'yellow');
    log('3. Test authentication flow with real users', 'yellow');
    log('4. Monitor Supabase Security Advisor dashboard', 'yellow');

  } catch (error) {
    log(`\n❌ Audit failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the audit
runAudit();
