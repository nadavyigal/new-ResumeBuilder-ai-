/** Local-only integration test. Uses a cached image; never pulls or contacts Supabase.
 * Run: node scripts/tests/export-credits-local-db.mjs
 * The image has auth.users/uid(), but not current GoTrue jwt() or Storage migrations.
 * Only those unrelated managed-schema surfaces are scaffolded below. The entire
 * checked-in production baseline and export-credit migration run verbatim.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const root = new URL('../../', import.meta.url);
const image = 'public.ecr.aws/supabase/postgres:17.6.1.158';
const name = `resumely-credit-test-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
let admin;
let pool;
let checks = 0;
const check = (label) => { checks++; console.log(`PASS ${label}`); };
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
  pool = new pg.Pool({ ...config, max: 20 });
  execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: `
    create or replace function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    alter table storage.buckets owner to postgres;
    alter table storage.objects owner to postgres;
  `, stdio: ['pipe', 'pipe', 'pipe'] });
  await admin.query(readFileSync(new URL('supabase/migrations/20261012000000_production_baseline.sql', root), 'utf8'));
  await admin.query('set search_path to public');
  // The intervening purge migration only installs a cron job, unrelated to credits.
  // It is deliberately not scheduled in this short-lived test database.
  const userA = randomUUID(), userB = randomUUID();
  await admin.query('insert into auth.users(id) values ($1), ($2)', [userA, userB]);
  await admin.query('update profiles set credit_balance=7 where user_id=$1', [userA]);
  const migration = readFileSync(new URL('supabase/migrations/20261021120000_export_credits.sql', root), 'utf8');
  await admin.query(migration);
  assert.equal((await admin.query('select credit_balance from profiles where user_id=$1', [userA])).rows[0].credit_balance, 7);
  const newUser = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [newUser]);
  assert.equal((await admin.query('select credit_balance from profiles where user_id=$1', [newUser])).rows[0].credit_balance, 1);
  check('verbatim baseline + migration; existing balance preserved; signup gets one credit');
  const signature = 'public.unlock_export(uuid,uuid,boolean)';
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await admin.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, signature])).rows[0].allowed, false);
  }
  assert.equal((await admin.query('select has_function_privilege(\'service_role\',$1,\'EXECUTE\') allowed', [signature])).rows[0].allowed, true);
  const acl = (await admin.query(`select exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a where p.oid=$1::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE') allowed`, [signature])).rows[0].allowed;
  assert.equal(acl, false);
  check('PUBLIC/anon/authenticated cannot execute; service_role can');
  // Every SECURITY DEFINER function this migration creates or replaces trusts p_user_id.
  for (const fn of ['public.consume_credit(uuid,text)', 'public.grant_apple_credits(uuid,integer,text,text,text)', signature]) {
    const grantees = (await admin.query(`select coalesce(r.rolname,'PUBLIC') grantee from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee
      where p.oid=$1::regprocedure and a.privilege_type='EXECUTE'`, [fn])).rows.map(r => r.grantee);
    for (const role of ['PUBLIC', 'anon', 'authenticated']) assert.ok(!grantees.includes(role), `${role} can execute ${fn}`);
    assert.ok(grantees.includes('service_role'), `service_role cannot execute ${fn}`);
  }
  check('credit-writing SECURITY DEFINER functions: no PUBLIC/anon/authenticated EXECUTE');
  async function asRole(role, sql, params = [], uid) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`set local role ${role}`); // fixed test role names only
      if (uid) await client.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
      const result = await client.query(sql, params);
      await client.query('commit');
      return result;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }
  async function fixture(balance = 1) {
    const user = randomUUID(), opt = randomUUID();
    await admin.query('insert into auth.users(id) values ($1)', [user]);
    await admin.query('update profiles set credit_balance=$2 where user_id=$1', [user, balance]);
    await admin.query("insert into optimizations(id,user_id,match_score,template_key) values ($1,$2,50,'test')", [opt, user]);
    return { user, opt };
  }
  const call = async (f, charge = true) => (await asRole('service_role', 'select public.unlock_export($1,$2,$3) result', [f.user, f.opt, charge])).rows[0].result;
  const state = async (f) => (await admin.query(`select credit_balance balance,
    (select count(*)::int from export_unlocks where user_id=$1) unlocks,
    (select count(*)::int from credit_transactions where user_id=$1) ledger,
    (select coalesce(sum(delta),0)::int from credit_transactions where user_id=$1) delta
    from profiles where user_id=$1`, [f.user])).rows[0];
  const f = await fixture();
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(asRole(role, 'select public.unlock_export($1,$2,true)', [f.user,f.opt]), { code: '42501' });
    await assert.rejects(asRole(role, "select public.grant_apple_credits($1,10,'x','apple_iap',$2)", [f.user, randomUUID()], f.user), { code: '42501' });
    await assert.rejects(asRole(role, "select public.consume_credit($1,'x')", [f.user], f.user), { code: '42501' });
    for (const sql of [
      "insert into export_unlocks(user_id,optimization_id,source) values ($1,$2,'credit')",
      "update export_unlocks set source='credit' where user_id=$1 and optimization_id=$2",
      'delete from export_unlocks where user_id=$1 and optimization_id=$2',
    ]) await assert.rejects(asRole(role, sql, [f.user,f.opt], f.user), { code: '42501' });
    await assert.rejects(asRole(role, 'truncate export_unlocks'), { code: '42501' });
  }
  check('real role calls deny unlock/grant/consume RPCs and INSERT/UPDATE/DELETE/TRUNCATE');
  const concurrent = await Promise.all(Array.from({ length:20 }, () => call(f)));
  assert.equal(concurrent.filter(r=>r.status==='unlocked').length,1);
  assert.equal(concurrent.filter(r=>r.status==='already_unlocked').length,19);
  assert.deepEqual(await state(f), { balance:0, unlocks:1, ledger:1, delta:-1 });
  check('20 independent parallel unlock transactions spend exactly once');
  const two = await fixture();
  const opt2 = randomUUID();
  await admin.query("insert into optimizations(id,user_id,match_score,template_key) values ($1,$2,50,'test')", [opt2,two.user]);
  const raced = await Promise.all([call(two),call({...two,opt:opt2})]);
  assert.deepEqual(raced.map(r=>r.status).sort(), ['insufficient','unlocked']);
  assert.deepEqual(await state(two), { balance:0, unlocks:1, ledger:1, delta:-1 });
  check('two optimizations racing for one credit unlock exactly one');
  const free = await fixture(0);
  assert.equal((await call(free,false)).status,'ungated');
  assert.equal((await call(free,true)).status,'already_unlocked');
  assert.deepEqual(await state(free), { balance:0, unlocks:1, ledger:0, delta:0 });
  assert.equal((await call(f,false)).source,'credit');
  check('ungated unlock survives gate activation; charged unlock survives ungated retry');
  const empty = await fixture(0);
  assert.equal((await call(empty)).status,'insufficient');
  assert.deepEqual(await state(empty), { balance:0, unlocks:0, ledger:0, delta:0 });
  assert.equal((await call({...empty, user:userA})).status,'not_found');
  assert.equal((await call({...empty, opt:randomUUID()})).status,'not_found');
  assert.deepEqual(await state(empty), { balance:0, unlocks:0, ledger:0, delta:0 });
  check('insufficient, foreign and missing optimizations write nothing');
  const own = await asRole('authenticated','select * from export_unlocks', [], f.user);
  assert.equal(own.rows.length,1); assert.equal(own.rows[0].user_id, f.user);
  assert.equal((await asRole('authenticated','select * from export_unlocks',[], userB)).rows.length,0);
  assert.equal((await asRole('anon','select * from export_unlocks')).rows.length,0);
  check('RLS limits authenticated reads to owner and hides rows from anon');
  const rollback = await fixture();
  // Fail the final ledger insert, after the unlock insert and balance update.
  await admin.query(`create function public.reject_test_ledger() returns trigger language plpgsql as $$ begin raise exception 'injected ledger failure'; end $$;
    create trigger reject_test_ledger before insert on credit_transactions for each row execute function public.reject_test_ledger()`);
  await assert.rejects(call(rollback), /injected ledger failure/);
  assert.deepEqual(await state(rollback), { balance:1, unlocks:0, ledger:0, delta:0 });
  await admin.query('drop trigger reject_test_ledger on credit_transactions; drop function reject_test_ledger()');
  await admin.query('begin');
  await admin.query('select unlock_export($1,$2,true)',[rollback.user,rollback.opt]);
  await admin.query('rollback');
  assert.deepEqual(await state(rollback), { balance:1, unlocks:0, ledger:0, delta:0 });
  assert.equal((await call(rollback)).status,'unlocked');
  check('late ledger failure and explicit rollback undo balance/unlock/ledger together; retry works');
  await admin.query(migration);
  check('migration replays without error');
  // Existing grant function is changed by this migration; pin its current behavior.
  const purchase = await fixture(0), txn = randomUUID();
  const grant = async (user) => (await asRole('service_role','select grant_apple_credits($1,5,\'test\',\'apple_iap\',$2) balance',[user,txn])).rows[0].balance;
  assert.equal(await grant(purchase.user),5); assert.equal(await grant(purchase.user),5);
  assert.deepEqual(await state(purchase), { balance:5, unlocks:0, ledger:1, delta:5 });
  check('duplicate Apple transaction grants only once');
  assert.equal(concurrent.find(r=>r.status==='unlocked').paid_user,false);
  assert.equal((await call(free,false)).paid_user,false);
  const paid = await call(purchase);
  assert.equal(paid.status,'unlocked'); assert.equal(paid.paid_user,true); assert.equal(paid.balance,4);
  assert.equal((await call(purchase,false)).paid_user,true);
  check('paid_user is false without an apple_iap row and true after a purchase');
  const foreignBalance = await grant(userB);
  assert.equal(foreignBalance,3);
  assert.equal((await admin.query('select count(*)::int n from credit_transactions where user_id=$1',[userB])).rows[0].n,0);
  console.log('FOLLOW-UP story 2: foreign Apple transaction grants nothing, but existing function returns balance instead of explicit refusal.');
  console.log(`SUCCESS ${checks} integration checks; local Postgres ${ (await admin.query('show server_version')).rows[0].server_version }; no hosted resources touched.`);
} finally {
  await pool?.end(); await admin?.end().catch(()=>{});
  try { docker('rm','-f','-v',name); } catch { /* preserve original test failure */ }
}
