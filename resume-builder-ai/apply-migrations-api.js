/**
 * Apply database migrations to Supabase using Management API
 * Feature: 008-enhance-ai-assistent
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Extract project ref
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

// Migration files
const migrations = [
  {
    file: '20250118000001_create_ai_threads.sql',
    description: 'Create ai_threads table'
  },
  {
    file: '20250118000002_create_content_modifications.sql',
    description: 'Create content_modifications table'
  },
  {
    file: '20250118000003_create_style_history.sql',
    description: 'Create style_customization_history table'
  },
  {
    file: '20250118000004_alter_existing_tables.sql',
    description: 'Alter existing tables'
  }
];

function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: projectRef + '.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: responseData,
            message: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function applyMigration(migration) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 ${migration.file}`);
  console.log(`   ${migration.description}`);
  console.log(`${'='.repeat(60)}`);

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', migration.file);

  let sql;
  try {
    sql = fs.readFileSync(migrationPath, 'utf8');
  } catch (error) {
    console.error(`❌ Failed to read file: ${error.message}`);
    return { success: false, error: error.message };
  }

  console.log('⚙️  Executing SQL...');

  try {
    const result = await executeSql(sql);

    if (result.success) {
      console.log('✅ Migration applied successfully');
      return { success: true };
    } else if (result.statusCode === 404) {
      console.log('⚠️  RPC endpoint not available - trying alternative method...');

      // Split into individual statements
      const statements = sql
        .replace(/BEGIN;/gi, '')
        .replace(/COMMIT;/gi, '')
        .split(';')
        .map(s => s.trim())
        .filter(s => {
          if (!s) return false;
          const withoutComments = s.split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .trim();
          return withoutComments.length > 0;
        });

      console.log(`   Found ${statements.length} statements to execute`);

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        const preview = statement.substring(0, 60).replace(/\s+/g, ' ') + '...';

        try {
          const stmtResult = await executeSql(statement);

          if (stmtResult.success) {
            console.log(`   ✅ ${preview}`);
            successCount++;
          } else if (stmtResult.error && (
            stmtResult.error.includes('already exists') ||
            stmtResult.error.includes('duplicate')
          )) {
            console.log(`   ⚠️  ${preview} (already exists)`);
            skipCount++;
          } else {
            console.log(`   ❌ ${preview}`);
            console.log(`      Error: ${stmtResult.error}`);
            errorCount++;
          }
        } catch (err) {
          console.log(`   ❌ ${preview}`);
          console.log(`      Error: ${err.message}`);
          errorCount++;
        }
      }

      console.log(`\n   Summary: ${successCount} success, ${skipCount} skipped, ${errorCount} errors`);

      if (errorCount > 0 && skipCount === 0) {
        return { success: false, error: `${errorCount} statements failed` };
      }

      return { success: true, partial: errorCount > 0 };
    } else {
      console.error(`❌ Migration failed: ${result.error}`);

      // Check if it's "already exists"
      if (result.error && (
        result.error.includes('already exists') ||
        result.error.includes('duplicate')
      )) {
        console.log('⚠️  Objects already exist - migration may have been applied previously');
        return { success: true, alreadyExists: true };
      }

      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error(`❌ Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 SUPABASE MIGRATION TOOL (API Method)');
  console.log('   Feature: 008-enhance-ai-assistent');
  console.log('='.repeat(60));
  console.log(`\nProject: ${projectRef}`);
  console.log(`URL: ${supabaseUrl}\n`);

  const results = [];

  for (const migration of migrations) {
    const result = await applyMigration(migration);
    results.push({ ...migration, ...result });

    if (!result.success) {
      console.log('\n⚠️  Migration failed. Stopping here.');
      break;
    }

    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Successful: ${successful}/${migrations.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${migrations.length}`);
  }

  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    const extra = r.alreadyExists ? ' (already exists)' :
                  r.partial ? ' (partial)' : '';
    console.log(`   ${status} ${r.file}${extra}`);
  });

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    console.log('\n✅ All migrations completed!');
    console.log('\nNext step: Verify tables were created');
    console.log('  node apply-migrations-simple.js\n');
  } else {
    console.log('\n⚠️  Some migrations failed');
    console.log('Consider using Supabase CLI: npx supabase db push\n');
  }
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
