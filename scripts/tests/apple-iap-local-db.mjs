/** Local-only integration test. Uses a cached image; never pulls or contacts Supabase.
 * Run: node scripts/tests/apple-iap-local-db.mjs
 *
 * Replays the checked-in baseline and every later migration, in filename order,
 * into a disposable Postgres, then proves grant_apple_purchase and
 * apply_iap_refund (20261023120000_apple_iap_verification.sql) against the
 * StoreKit spec sections 7.2 and 8 and the database tests in section 12.
 * Same scaffold as the export-credits test: only GoTrue jwt() and Storage are stubbed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const MIGRATION = '20261023120000_apple_iap_verification.sql';
const root = new URL('../../', import.meta.url);
const migrationsDir = new URL('supabase/migrations/', root);
const image = 'public.ecr.aws/supabase/postgres:17.6.1.158';
const name = `resumely-iap-test-${process.pid}`;
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
  const grant = (user, txn, product, credits, env = 'Sandbox') => asRole('service_role',
    'select public.grant_apple_purchase($1,$2,$3,$4,$5) r', [user, txn, product, credits, env]).then(r => r.rows[0].r);
  const refund = (txn, uuid, reversed) => asRole('service_role',
    'select public.apply_iap_refund($1,$2,$3) r', [txn, uuid, reversed]).then(r => r.rows[0].r);
  const balance = async (user) => (await admin.query('select credit_balance b from profiles where user_id=$1', [user])).rows[0].b;
  const setBalance = (user, b) => admin.query('update profiles set credit_balance=$2 where user_id=$1', [user, b]);

  const userA = randomUUID(), userB = randomUUID();
  await admin.query('insert into auth.users(id) values ($1), ($2)', [userA, userB]);
  assert.equal(await balance(userA), 1, 'signup starts with the free export');

  // Privileges: both functions trust their arguments.
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(asRole(role, "select public.grant_apple_purchase($1,'t','resumely.exports.10',10,'Sandbox')", [userA]), { code: '42501' });
    await assert.rejects(asRole(role, "select public.apply_iap_refund('t','n',false)"), { code: '42501' });
  }
  for (const fn of ['public.grant_apple_purchase(uuid,text,text,integer,text)', 'public.apply_iap_refund(text,text,boolean)']) {
    const grantees = (await admin.query(`select coalesce(r.rolname,'PUBLIC') g from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee
      where p.oid=$1::regprocedure and a.privilege_type='EXECUTE'`, [fn])).rows.map(r => r.g);
    for (const role of ['PUBLIC', 'anon', 'authenticated']) assert.ok(!grantees.includes(role), `${role} can execute ${fn}`);
    assert.ok(grantees.includes('service_role'), `service_role cannot execute ${fn}`);
  }
  check('real anon/authenticated calls denied (42501); no PUBLIC grant; service_role can execute');

  // Grant: once per transaction, product and environment on the ledger row.
  assert.deepEqual(await grant(userA, 'txn-1', 'resumely.exports.5', 5), { status: 'granted', credits_granted: 5, balance: 6 });
  assert.deepEqual(await grant(userA, 'txn-1', 'resumely.exports.5', 5), { status: 'already_granted', credits_granted: 5, balance: 6 });
  assert.deepEqual(await grant(userA, ' txn-1 ', 'resumely.exports.10', 10), { status: 'already_granted', credits_granted: 5, balance: 6 });
  const row = (await admin.query("select delta, reason, source, product_id, environment from credit_transactions where apple_transaction_id='txn-1'")).rows;
  assert.deepEqual(row, [{ delta: 5, reason: 'iap_purchase', source: 'apple_iap', product_id: 'resumely.exports.5', environment: 'Sandbox' }]);
  check('same transaction twice grants once; ledger row stores product_id and environment');

  assert.deepEqual(await grant(userB, 'txn-1', 'resumely.exports.5', 5), { status: 'owned_by_other_account' });
  assert.equal(await balance(userB), 1);
  assert.equal(await balance(userA), 6);
  check('the same transaction for a second user is refused and changes nothing');

  const parallel = await Promise.all(Array.from({ length: 20 }, () => grant(userB, 'txn-par', 'resumely.exports.10', 10, 'Production')));
  assert.equal(parallel.filter(r => r.status === 'granted').length, 1);
  assert.equal(parallel.filter(r => r.status === 'already_granted').length, 19);
  assert.equal(await balance(userB), 11);
  check('20 parallel grants of one transaction grant exactly once');

  await assert.rejects(grant(userA, 'txn-x', 'resumely.exports.1', 1, 'Xcode'), /p_environment/);
  await assert.rejects(grant(userA, 'txn-x', 'resumely.exports.1', 0), /p_credits/);
  await assert.rejects(grant(userA, '  ', 'resumely.exports.1', 1), /p_apple_transaction_id/);
  assert.equal(await balance(userA), 6);
  check('bad environment, zero credits and blank transaction ID raise and write nothing');

  // unlock_export (export-credits migration) now sees a paid user.
  const opt = randomUUID();
  await admin.query("insert into optimizations(id, user_id, match_score, template_key, ats_score_original, ats_score_optimized) values ($1,$2,50,'t',40,70)", [opt, userA]);
  const unlocked = (await asRole('service_role', 'select public.unlock_export($1,$2,true) r', [userA, opt])).rows[0].r;
  assert.equal(unlocked.status, 'unlocked');
  assert.equal(unlocked.paid_user, true);
  assert.equal(await balance(userA), 5);
  check('a charged unlock after a purchase spends 1 and reports paid_user');

  // Refund: deducts at most the current balance; idempotent per notification.
  await setBalance(userA, 3); // spent some of the 5 purchased credits
  const refunded = await refund('txn-1', 'notif-1', false);
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.credits_changed, -3);
  assert.equal(refunded.user_id, userA);
  assert.equal(await balance(userA), 0);
  assert.equal((await refund('txn-1', 'notif-1', false)).status, 'duplicate');
  assert.equal(await balance(userA), 0);
  check('REFUND deducts at most the balance (floor 0); the same notificationUUID twice deducts once');

  assert.equal((await admin.query('select count(*)::int n from export_unlocks where user_id=$1 and optimization_id=$2', [userA, opt])).rows[0].n, 1);
  check('exports unlocked before the refund stay unlocked');

  await setBalance(userA, 10);
  const secondRefund = await refund('txn-1', 'notif-2', false);
  assert.equal(secondRefund.credits_changed, -2, 'only the 2 credits not yet taken back remain refundable');
  assert.equal(await balance(userA), 8);
  check('a second REFUND for the same transaction takes only what is still outstanding');

  const reversed = await refund('txn-1', 'notif-3', true);
  assert.equal(reversed.status, 'reversed');
  assert.equal(reversed.credits_changed, 5);
  assert.equal(await balance(userA), 13);
  assert.equal((await refund('txn-1', 'notif-3', true)).status, 'duplicate');
  assert.equal((await refund('txn-1', 'notif-4', true)).credits_changed, 0);
  assert.equal(await balance(userA), 13);
  check('REFUND_REVERSED gives back exactly what refunds took; repeats give nothing more');

  const ledger = (await admin.query("select reason, delta, apple_transaction_id, related_apple_transaction_id, environment from credit_transactions where related_apple_transaction_id='txn-1' order by created_at, delta")).rows;
  assert.ok(ledger.every(r => r.apple_transaction_id === null && r.environment === 'Sandbox'));
  assert.deepEqual(ledger.map(r => r.reason).sort(), ['iap_refund', 'iap_refund', 'iap_refund_reversed', 'iap_refund_reversed']);
  check('refund rows point at the grant, keep apple_transaction_id unique to the grant, carry its environment');

  assert.deepEqual(await refund('txn-unknown', 'notif-9', false), { status: 'no_grant' });
  check('a refund for a transaction with no grant changes nothing');

  // A refund racing unlocks never drives the balance below zero.
  const userC = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [userC]);
  await grant(userC, 'txn-race', 'resumely.exports.5', 5, 'Production');
  const opts = Array.from({ length: 6 }, () => randomUUID());
  for (const id of opts) {
    await admin.query("insert into optimizations(id, user_id, match_score, template_key, ats_score_original, ats_score_optimized) values ($1,$2,50,'t',40,70)", [id, userC]);
  }
  await Promise.all([
    ...opts.map(id => asRole('service_role', 'select public.unlock_export($1,$2,true)', [userC, id])),
    refund('txn-race', 'notif-race', false),
  ]);
  const finalC = await balance(userC);
  const unlocksC = (await admin.query("select count(*)::int n from export_unlocks where user_id=$1 and source='credit'", [userC])).rows[0].n;
  const ledgerSum = (await admin.query('select coalesce(sum(delta),0)::int s from credit_transactions where user_id=$1', [userC])).rows[0].s;
  assert.ok(finalC >= 0, `balance went negative: ${finalC}`);
  assert.equal(finalC, 1 + ledgerSum, 'balance must equal the starting credit plus the ledger');
  assert.ok(unlocksC <= 6);
  check(`refund racing 6 unlocks: balance ${finalC} >= 0 and equals 1 + ledger sum`);

  console.log(`SUCCESS ${checks} checks; local Postgres ${(await admin.query('show server_version')).rows[0].server_version}; no hosted resources touched.`);
} finally {
  await pool?.end(); await admin?.end().catch(() => {});
  try { docker('rm', '-f', '-v', name); } catch { /* preserve original test failure */ }
}
