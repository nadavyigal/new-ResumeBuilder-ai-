/** Local-only integration test. Uses a cached image; never pulls or contacts Supabase.
 * Run: node scripts/tests/security-definer-grants-local-db.mjs
 *
 * Replays the checked-in baseline and every later migration, in filename order,
 * into a disposable Postgres, then asserts that no SECURITY DEFINER function in
 * public is executable by PUBLIC, anon or authenticated, except ALLOWLIST.
 * It also proves the trigger functions still fire for real roles after their
 * EXECUTE grants are gone.
 *
 * Same scaffold as the export-credits test: the image has auth.users/uid(), but
 * not current GoTrue jwt() or Storage migrations, so only those are stubbed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// SECURITY DEFINER functions in public that a client role may call directly,
// as 'public.name(argtypes)'. Each entry needs a reason: the function must check
// auth.uid() itself, because it bypasses RLS. Empty on purpose.
const ALLOWLIST = [];
const CLIENT_ROLES = ['PUBLIC', 'anon', 'authenticated'];
// Called by the app on a service-role client (see the migration header).
const SERVICE_ROLE_RPCS = [
  'public.consume_credit(uuid, text)',
  'public.grant_apple_credits(uuid, integer, text, text, text)',
  'public.increment_rate_limit(text, text, bigint)',
];
const BASELINE = '20261012000000_production_baseline.sql';
const HARDENING = '20261022120000_harden_security_definer_grants.sql';

const root = new URL('../../', import.meta.url);
const migrationsDir = new URL('supabase/migrations/', root);
const image = 'public.ecr.aws/supabase/postgres:17.6.1.158';
const name = `resumely-secdef-test-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
let admin;
let pool;
let checks = 0;
const check = (label) => { checks++; console.log(`PASS ${label}`); };

// Every grantee of EXECUTE on each SECURITY DEFINER function in public.
const OPEN_GRANTS_SQL = `
  select n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as signature,
         coalesce(r.rolname, 'PUBLIC') as grantee
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_roles r on r.oid = a.grantee
  where n.nspname = 'public' and p.prosecdef and a.privilege_type = 'EXECUTE'`;

async function openToClients() {
  const rows = (await admin.query(OPEN_GRANTS_SQL)).rows;
  return rows
    .filter(r => CLIENT_ROLES.includes(r.grantee) && !ALLOWLIST.includes(r.signature))
    .map(r => `${r.signature} -> ${r.grantee}`)
    .sort();
}

try {
  docker('run', '--pull=never', '--name', name, '-e', 'POSTGRES_PASSWORD=local-test-only', '-p', '127.0.0.1::5432', '-d', image);
  const port = Number(docker('port', name, '5432/tcp').split(':').at(-1));
  const config = { host: '127.0.0.1', port, user: 'postgres', password: 'local-test-only', database: 'postgres', connectionTimeoutMillis: 2000 };
  for (let i = 0; i < 40; i++) {
    admin = new pg.Client(config);
    try { await admin.connect(); break; } catch (e) {
      await admin.end().catch(() => {});
      if (i === 39) throw e;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  pool = new pg.Pool({ ...config, max: 5 });
  execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: `
    create or replace function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    alter table storage.buckets owner to postgres;
    alter table storage.objects owner to postgres;
  `, stdio: ['pipe', 'pipe', 'pipe'] });

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  assert.equal(files[0], BASELINE, 'baseline must be the first migration');
  assert.ok(files.includes(HARDENING), `${HARDENING} is missing`);
  const read = (file) => readFileSync(new URL(file, migrationsDir), 'utf8');

  await admin.query(read(BASELINE));
  // The bug this migration fixes: default privileges grant every new public
  // function to anon and authenticated, and the baseline only revokes PUBLIC.
  const openAfterBaseline = await openToClients();
  assert.ok(openAfterBaseline.some(g => g.startsWith('public.get_ats_improvement(uuid) -> anon')),
    `expected the baseline alone to leave get_ats_improvement open; got ${JSON.stringify(openAfterBaseline)}`);
  console.log(`INFO baseline alone leaves ${new Set(openAfterBaseline.map(g => g.split(' -> ')[0])).size} SECURITY DEFINER functions open to clients`);

  for (const file of files.slice(1)) {
    await admin.query('reset all');
    await admin.query(read(file));
  }
  await admin.query('reset all');
  await admin.query('set search_path to public');
  check(`verbatim replay of ${files.length} migrations`);

  const openAfterAll = await openToClients();
  assert.deepEqual(openAfterAll, [], `client roles can execute SECURITY DEFINER functions:\n${openAfterAll.join('\n')}`);
  check('no PUBLIC/anon/authenticated EXECUTE on any public SECURITY DEFINER function (allowlist empty)');

  for (const signature of SERVICE_ROLE_RPCS) {
    const ok = (await admin.query("select has_function_privilege('service_role', $1, 'EXECUTE') ok", [signature])).rows[0].ok;
    assert.equal(ok, true, `service_role cannot execute ${signature}`);
  }
  check('service_role keeps EXECUTE on the RPCs the app calls');

  async function asRole(role, sql, params = [], uid) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`set local role ${role}`); // fixed test role names only
      if (uid) {
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role })]);
      }
      const result = await client.query(sql, params);
      await client.query('commit');
      return result;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  // Signup as GoTrue does it: the on_auth_user_created trigger runs handle_new_user.
  const user = randomUUID();
  // postgres cannot SET ROLE to supabase_auth_admin; the superuser can.
  execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: `set role supabase_auth_admin; insert into auth.users(id, raw_user_meta_data) values ('${user}', '{"full_name": "Test User"}');`, // random UUID, no user input
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const profile = (await admin.query('select full_name from profiles where user_id = $1', [user])).rows;
  assert.equal(profile.length, 1, 'signup did not create a profile');
  assert.equal(profile[0].full_name, 'Test User');
  check('signup trigger (handle_new_user) still creates the profile');

  const opt = randomUUID();
  await asRole('authenticated', "insert into optimizations(id, user_id, match_score, template_key, ats_score_original, ats_score_optimized) values ($1, $2, 50, 'test', 40, 70)", [opt, user], user);
  const templates = Number((await admin.query('select count(*) n from design_templates')).rows[0].n);
  assert.ok(templates > 0, 'baseline should seed design_templates');
  const assigned = (await admin.query('select count(*)::int n from resume_design_assignments where optimization_id = $1', [opt])).rows[0].n;
  assert.equal(assigned, 1, 'assign_default_template did not run');
  check('optimization insert as authenticated still runs assign_default_template');

  const app = randomUUID();
  await asRole('authenticated', "insert into applications(id, user_id, job_title, company_name) values ($1, $2, 'Data Analyst', 'Acme')", [app, user], user);
  assert.equal((await admin.query("select search::text s from applications where id = $1", [app])).rows[0].s, "'acme':3 'analyst':2 'data':1");
  await admin.query("update applications set updated_at = '2020-01-01' where id = $1", [app]);
  await asRole('authenticated', "update applications set notes = 'x' where id = $1", [app], user);
  const appRow = (await admin.query('select updated_at > now() - interval \'1 minute\' fresh from applications where id = $1', [app])).rows[0];
  assert.equal(appRow.fresh, true, 'update_applications_updated_at did not run');
  check('application insert/update as authenticated still runs search and updated_at triggers');

  const session = randomUUID();
  await asRole('authenticated', 'insert into chat_sessions(id, user_id, optimization_id) values ($1, $2, $3)', [session, user, opt], user);
  await admin.query("update chat_sessions set last_activity_at = '2020-01-01' where id = $1", [session]);
  await asRole('authenticated', "insert into chat_messages(session_id, sender, content) values ($1, 'user', 'hi')", [session], user);
  const sessionRow = (await admin.query('select last_activity_at > now() - interval \'1 minute\' fresh from chat_sessions where id = $1', [session])).rows[0];
  assert.equal(sessionRow.fresh, true, 'update_session_activity did not run');
  check('chat message insert as authenticated still runs update_session_activity');

  for (const role of ['anon', 'authenticated']) {
    for (const [sql, params] of [
      ['select public.get_ats_improvement($1)', [opt]],
      ['select public.is_ats_v2($1)', [opt]],
      ['select public.increment_optimizations_used($1, 1000)', [user]],
      ['select public.check_subscription_limit($1)', [user]],
      ["select public.generate_file_path($1, 'a.pdf')", [user]],
      ["select public.cleanup_old_files('resumes')", []],
      ['select public.increment_optimization_usage($1)', [user]],
      ["select * from public.increment_rate_limit('ip', 'ep', 60000)", []],
      ["select public.consume_credit($1, 'x')", [user]],
      ["select public.grant_apple_credits($1, 10, 'x', 'apple_iap', 'txn-1')", [user]],
    ]) {
      await assert.rejects(asRole(role, sql, params, user), { code: '42501' }, `${role}: ${sql}`);
    }
  }
  check('real anon/authenticated calls to every RPC function are denied (42501)');

  const improvement = (await asRole('service_role', 'select public.get_ats_improvement($1) d', [opt])).rows[0].d;
  assert.equal(improvement, 30);
  const limited = (await asRole('service_role', "select * from public.increment_rate_limit('ip', 'ep', 60000)")).rows[0];
  assert.equal(limited.requests_count, 1);
  check('service_role calls still work');

  await admin.query(read(HARDENING));
  assert.deepEqual(await openToClients(), []);
  check('hardening migration replays without error');

  console.log(`SUCCESS ${checks} checks; local Postgres ${(await admin.query('show server_version')).rows[0].server_version}; no hosted resources touched.`);
} finally {
  await pool?.end(); await admin?.end().catch(() => {});
  try { docker('rm', '-f', '-v', name); } catch { /* preserve original test failure */ }
}
