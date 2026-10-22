/** Local-only integration test. Uses a cached image; never pulls or contacts Supabase.
 * Run: node scripts/tests/paddle-local-db.mjs
 *
 * Replays the checked-in baseline and every later migration, in filename order,
 * into a disposable Postgres, then proves grant_paddle_credits and
 * apply_paddle_adjustment (20261024120000_paddle_web_checkout.sql) against the
 * StoreKit spec sections 16.4.1, 16.5, 16.6 and the database tests in 16.11.
 * Same scaffold as the export-credits test: only GoTrue jwt() and Storage are stubbed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const MIGRATION = '20261024120000_paddle_web_checkout.sql';
const root = new URL('../../', import.meta.url);
const migrationsDir = new URL('supabase/migrations/', root);
const image = 'public.ecr.aws/supabase/postgres:17.6.1.158';
const name = `resumely-paddle-test-${process.pid}`;
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
  pool = new pg.Pool({ ...config, max: 25 });
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
  assert.ok(files.includes(MIGRATION), `${MIGRATION} is missing`);
  for (const file of files) {
    await admin.query('reset all');
    await admin.query(readFileSync(new URL(file, migrationsDir), 'utf8'));
  }
  await admin.query('reset all');
  await admin.query('set search_path to public');
  check(`verbatim replay of ${files.length} migrations`);

  async function asRole(role, sql, params = []) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`set local role ${role}`); // fixed test role names only
      const result = await client.query(sql, params);
      await client.query('commit');
      return result;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }
  const grant = (user, txn, credits, price = 'pri_5', env = 'Sandbox') => asRole('service_role',
    'select public.grant_paddle_credits($1,$2,$3,$4,$5) r', [user, credits, txn, price, env]).then(r => r.rows[0].r);
  const adjust = (txn, adj, credits, reversed = false) => asRole('service_role',
    'select public.apply_paddle_adjustment($1,$2,$3,$4) r', [txn, adj, credits, reversed]).then(r => r.rows[0].r);
  const balance = async (user) => (await admin.query('select credit_balance b from profiles where user_id=$1', [user])).rows[0].b;
  const setBalance = (user, b) => admin.query('update profiles set credit_balance=$2 where user_id=$1', [user, b]);

  const userA = randomUUID(), userB = randomUUID();
  await admin.query('insert into auth.users(id) values ($1), ($2)', [userA, userB]);
  assert.equal(await balance(userA), 1, 'signup starts with the free export');

  // Privileges: both functions trust their arguments; both tables are server-only.
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(asRole(role, "select public.grant_paddle_credits($1, 10, 'txn_x', 'pri_10', 'Sandbox')", [userA]), { code: '42501' });
    await assert.rejects(asRole(role, "select public.apply_paddle_adjustment('txn_x', 'adj_x', 1, false)"), { code: '42501' });
    await assert.rejects(asRole(role, 'select * from public.paddle_checkouts'), { code: '42501' });
    await assert.rejects(asRole(role, 'select * from public.paddle_events'), { code: '42501' });
    await assert.rejects(asRole(role, "insert into public.paddle_checkouts values ('txn_y', $1, 'pri_1', 'Sandbox')", [userA]), { code: '42501' });
  }
  for (const fn of ['public.grant_paddle_credits(uuid,integer,text,text,text)', 'public.apply_paddle_adjustment(text,text,integer,boolean)']) {
    const grantees = (await admin.query(`select coalesce(r.rolname,'PUBLIC') g from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee
      where p.oid=$1::regprocedure and a.privilege_type='EXECUTE'`, [fn])).rows.map(r => r.g);
    for (const role of ['PUBLIC', 'anon', 'authenticated']) assert.ok(!grantees.includes(role), `${role} can execute ${fn}`);
    assert.ok(grantees.includes('service_role'), `service_role cannot execute ${fn}`);
  }
  check('anon/authenticated cannot execute the two functions or read/write the two tables (42501); service_role can execute');

  // Grant: once per transaction; price and environment on the ledger row.
  assert.deepEqual(await grant(userA, 'txn_1', 5), { status: 'granted', credits_granted: 5, balance: 6 });
  assert.deepEqual(await grant(userA, 'txn_1', 5), { status: 'already_granted', credits_granted: 5, balance: 6 });
  const row = (await admin.query("select delta, reason, source, product_id, environment from credit_transactions where paddle_transaction_id='txn_1'")).rows;
  assert.deepEqual(row, [{ delta: 5, reason: 'paddle_purchase', source: 'paddle', product_id: 'pri_5', environment: 'Sandbox' }]);
  check('the same transaction twice grants once; the ledger row stores the price ID, source paddle and environment');

  assert.deepEqual(await grant(userB, 'txn_1', 5), { status: 'owned_by_other_account' });
  assert.equal(await balance(userB), 1);
  check('the same transaction for a second user is refused and changes nothing');

  const parallel = await Promise.all(Array.from({ length: 20 }, () => grant(userB, 'txn_par', 10, 'pri_10', 'Production')));
  assert.equal(parallel.filter(r => r.status === 'granted').length, 1);
  assert.equal(await balance(userB), 11);
  check('20 parallel grants of one transaction grant exactly once');

  await assert.rejects(grant(userA, 'txn_bad', 1, 'pri_1', 'Live'), /p_environment/);
  await assert.rejects(grant(userA, 'txn_bad', 0), /p_delta/);
  await assert.rejects(grant(userA, ' ', 1), /p_paddle_transaction_id/);
  check('a bad environment, zero credits and a blank transaction ID raise and write nothing');

  // Credits from Paddle spend through unlock_export like Apple credits (one ledger).
  const opt = randomUUID();
  await admin.query("insert into optimizations(id, user_id, match_score, template_key, ats_score_original, ats_score_optimized) values ($1,$2,50,'t',40,70)", [opt, userA]);
  assert.equal((await asRole('service_role', 'select public.unlock_export($1,$2,true) r', [userA, opt])).rows[0].r.status, 'unlocked');
  assert.equal(await balance(userA), 5);
  check('a charged unlock spends a Paddle credit (one ledger for both stores)');

  // Adjustments: approved refund deducts at most the balance; idempotent.
  await setBalance(userA, 3);
  const refunded = await adjust('txn_1', 'adj_1', 5);
  assert.equal(refunded.status, 'deducted');
  assert.equal(refunded.credits_changed, -3);
  assert.equal(refunded.user_id, userA);
  assert.equal(await balance(userA), 0);
  assert.equal((await adjust('txn_1', 'adj_1', 5)).status, 'duplicate');
  assert.equal(await balance(userA), 0);
  check('an approved refund deducts at most the balance (floor 0); the same adjustment twice deducts once');

  await setBalance(userA, 10);
  assert.equal((await adjust('txn_1', 'adj_2', 5)).credits_changed, -2, 'only the 2 credits not yet taken back remain');
  check('a second deduction for the same transaction takes only what is still outstanding');

  const reversed = await adjust('txn_1', 'adj_3', 5, true);
  assert.equal(reversed.status, 'reversed');
  assert.equal(reversed.credits_changed, 5);
  assert.equal((await adjust('txn_1', 'adj_4', 5, true)).credits_changed, 0);
  check('a chargeback reversal gives back exactly what deductions took; a second one gives nothing');

  const partial = await adjust('txn_par', 'adj_p', 3);
  assert.equal(partial.credits_changed, -3, 'a refund of some items deducts only their credits');
  check('a partial refund (3 of 10 credits) deducts only those credits');

  assert.deepEqual(await adjust('txn_unknown', 'adj_9', 5), { status: 'no_grant' });
  assert.equal((await admin.query("select count(*)::int n from credit_transactions where paddle_adjustment_id='adj_9'")).rows[0].n, 0);
  check('an adjustment before its grant changes nothing and is not recorded (the webhook retries it)');

  const ledger = (await admin.query("select reason, paddle_transaction_id, related_paddle_transaction_id, environment from credit_transactions where related_paddle_transaction_id='txn_1'")).rows;
  assert.ok(ledger.length === 4 && ledger.every(r => r.paddle_transaction_id === null && r.environment === 'Sandbox'));
  check('adjustment rows point at the grant, keep paddle_transaction_id unique to it, carry its environment');

  // A refund racing unlocks never drives the balance below zero.
  const userC = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [userC]);
  await grant(userC, 'txn_race', 5, 'pri_5', 'Production');
  const opts = Array.from({ length: 6 }, () => randomUUID());
  for (const id of opts) {
    await admin.query("insert into optimizations(id, user_id, match_score, template_key, ats_score_original, ats_score_optimized) values ($1,$2,50,'t',40,70)", [id, userC]);
  }
  await Promise.all([
    ...opts.map(id => asRole('service_role', 'select public.unlock_export($1,$2,true)', [userC, id])),
    adjust('txn_race', 'adj_race', 5),
  ]);
  const finalC = await balance(userC);
  const ledgerSum = (await admin.query('select coalesce(sum(delta),0)::int s from credit_transactions where user_id=$1', [userC])).rows[0].s;
  assert.ok(finalC >= 0, `balance went negative: ${finalC}`);
  assert.equal(finalC, 1 + ledgerSum, 'balance must equal the starting credit plus the ledger');
  check(`refund racing 6 unlocks: balance ${finalC} >= 0 and equals 1 + ledger sum`);

  console.log(`SUCCESS ${checks} checks; local Postgres ${(await admin.query('show server_version')).rows[0].server_version}; no hosted resources touched.`);
} finally {
  await pool?.end(); await admin?.end().catch(() => {});
  try { docker('rm', '-f', '-v', name); } catch { /* preserve original test failure */ }
}
