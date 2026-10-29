/** Local-only integration test. Uses a cached image; never pulls or contacts Supabase.
 * Run: node scripts/tests/pricing-v2-local-db.mjs
 *
 * Replays the baseline and every migration before pricing v2, creates accounts
 * that exist before it, applies 20261029120000_pricing_v2.sql verbatim, then
 * replays anything after it. Proves the welcome grant, the subscription
 * entitlement and fair-use cap, and that packs, refunds and grants still work.
 * Same scaffold as the other credit tests: only GoTrue jwt(), Storage and the
 * auth.users.is_anonymous column (present in hosted Supabase) are stubbed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const MIGRATION = '20261029120000_pricing_v2.sql';
const root = new URL('../../', import.meta.url);
const migrationsDir = new URL('supabase/migrations/', root);
const image = 'public.ecr.aws/supabase/postgres:17.6.1.158';
const name = `resumely-pricing-v2-test-${process.pid}`;
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
    alter table auth.users add column if not exists is_anonymous boolean not null default false;
  `, stdio: ['pipe', 'pipe', 'pipe'] });

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  assert.ok(files.includes(MIGRATION), `${MIGRATION} is missing`);
  const run = async (file) => {
    await admin.query('reset all');
    await admin.query(readFileSync(new URL(file, migrationsDir), 'utf8'));
  };
  for (const file of files.filter(f => f < MIGRATION)) await run(file);
  await admin.query('reset all');
  await admin.query('set search_path to public');

  // Accounts that exist before pricing v2: one untouched (1 free credit), one
  // that bought a pack, one that spent everything.
  const oldFree = randomUUID(), oldBuyer = randomUUID(), oldEmpty = randomUUID();
  await admin.query('insert into auth.users(id) values ($1), ($2), ($3)', [oldFree, oldBuyer, oldEmpty]);
  await admin.query('update profiles set credit_balance=6 where user_id=$1', [oldBuyer]);
  await admin.query('update profiles set credit_balance=0 where user_id=$1', [oldEmpty]);

  for (const file of files.filter(f => f >= MIGRATION)) await run(file);
  await admin.query('reset all');
  await admin.query('set search_path to public');
  check(`verbatim replay of ${files.length} migrations with accounts created before pricing v2`);

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
  const svc = (sql, params) => asRole('service_role', `select ${sql} r`, params).then(r => r.rows[0].r);
  const state = (user) => svc('public.get_credit_state($1)', [user]);
  const unlock = (user, opt, charge = true) => svc('public.unlock_export($1,$2,$3)', [user, opt, charge]);
  const upsert = (user, orig, txn, purchase, expires, revoked = null, product = 'resumely.pro.monthly') =>
    svc('public.upsert_subscription($1,$2,$3,$4,$5,$6,$7,$8)', [user, orig, txn, product, purchase, expires, revoked, 'Sandbox']);
  const revocation = (orig, txn, revokedAt, signedAt) =>
    svc('public.set_subscription_revocation($1,$2,$3,$4)', [orig, txn, revokedAt, signedAt]);
  const renewalUpdate = (orig, autoRenew, graceUntil, signedAt) =>
    svc('public.update_subscription_renewal($1,$2,$3,$4)', [orig, autoRenew, graceUntil, signedAt]);
  const balance = async (user) => (await admin.query('select credit_balance b from profiles where user_id=$1', [user])).rows[0]?.b;
  const newOpt = async (user) => {
    const id = randomUUID();
    await admin.query("insert into optimizations(id, user_id, match_score, template_key, ats_score_original, ats_score_optimized) values ($1,$2,50,'t',40,70)", [id, user]);
    return id;
  };
  const hours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

  // Privileges: every new or replaced function is service_role only.
  const fns = [
    'public.ensure_welcome_grant(uuid)', 'public.subscription_state(uuid)', 'public.get_credit_state(uuid)',
    'public.upsert_subscription(uuid,text,text,text,timestamptz,timestamptz,timestamptz,text)',
    'public.update_subscription_renewal(text,boolean,timestamptz,timestamptz)', 'public.grant_apple_purchase(uuid,text,text,integer,text)',
    'public.set_subscription_revocation(text,text,timestamptz,timestamptz)',
    'public.unlock_export(uuid,uuid,boolean)', 'public.welcome_export_grant()', 'public.subscription_export_cap()',
  ];
  for (const fn of fns) {
    const grantees = (await admin.query(`select coalesce(r.rolname,'PUBLIC') g from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee
      where p.oid=$1::regprocedure and a.privilege_type='EXECUTE'`, [fn])).rows.map(r => r.g);
    for (const role of ['PUBLIC', 'anon', 'authenticated']) assert.ok(!grantees.includes(role), `${role} can execute ${fn}`);
    assert.ok(grantees.includes('service_role'), `service_role cannot execute ${fn}`);
  }
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(asRole(role, 'select public.ensure_welcome_grant($1)', [oldFree]), { code: '42501' });
    await assert.rejects(asRole(role, 'select public.get_credit_state($1)', [oldFree]), { code: '42501' });
    await assert.rejects(asRole(role, "select public.upsert_subscription($1,'o','t','p',now(),now(),null,'Sandbox')", [oldFree]), { code: '42501' });
    await assert.rejects(asRole(role, "select public.update_subscription_renewal('o',false,null,now())"), { code: '42501' });
    await assert.rejects(asRole(role, "select public.set_subscription_revocation('o','t',null,now())"), { code: '42501' });
    for (const table of ['welcome_grants', 'subscriptions', 'subscription_export_usage']) {
      await assert.rejects(asRole(role, `insert into public.${table}(user_id) values ($1)`, [oldFree]), { code: '42501' });
    }
  }
  check('new functions: anon/authenticated denied (42501), no PUBLIC grant, service_role can execute; tables not writable by clients');

  assert.equal(await svc('public.welcome_export_grant()'), 3);
  assert.equal(await svc('public.subscription_export_cap()'), 40);
  check('constants: 3 welcome exports, 40 subscription exports per period');

  // Existing accounts keep their balance and get 3 on top, once (D1).
  assert.equal(await balance(oldFree), 1);
  assert.equal(await balance(oldBuyer), 6);
  assert.deepEqual(await state(oldFree), { balance: 4, subscription: { active: false } });
  assert.equal((await state(oldBuyer)).balance, 9);
  assert.equal((await state(oldEmpty)).balance, 3);
  assert.equal((await state(oldFree)).balance, 4, 'a second read grants nothing');
  check('existing accounts keep their balance and get the 3-export welcome grant once (1->4, 6->9, 0->3)');

  // New accounts start at 0 and get exactly 3.
  const fresh = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [fresh]);
  assert.equal(await balance(fresh), 0, 'new profile starts at 0');
  assert.deepEqual(await svc('public.ensure_welcome_grant($1)', [fresh]), { status: 'granted', exports_granted: 3, balance: 3 });
  assert.deepEqual(await svc('public.ensure_welcome_grant($1)', [fresh]), { status: 'already_granted', balance: 3 });
  const ledger = (await admin.query("select delta, reason, source from credit_transactions where user_id=$1", [fresh])).rows;
  assert.deepEqual(ledger, [{ delta: 3, reason: 'welcome_grant', source: 'welcome_grant' }]);
  check('a new account starts at 0, gets exactly 3 once, with one welcome_grant ledger row');

  const racer = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [racer]);
  const raced = await Promise.all(Array.from({ length: 20 }, () => svc('public.ensure_welcome_grant($1)', [racer])));
  assert.equal(raced.filter(r => r.status === 'granted').length, 1);
  assert.equal(await balance(racer), 3);
  check('20 parallel welcome grants for one account grant exactly once');

  // Anonymous sessions get nothing until the account is real (same user id).
  const anon = randomUUID();
  await admin.query('insert into auth.users(id, is_anonymous) values ($1, true)', [anon]);
  assert.deepEqual(await svc('public.ensure_welcome_grant($1)', [anon]), { status: 'not_eligible' });
  assert.equal((await state(anon)).balance, 0);
  await admin.query('update auth.users set is_anonymous=false where id=$1', [anon]);
  assert.equal((await state(anon)).balance, 3);
  assert.equal((await state(anon)).balance, 3);
  assert.deepEqual(await svc('public.ensure_welcome_grant($1)', [randomUUID()]), { status: 'not_eligible' });
  check('anonymous: not eligible; after linking to a real account the same id gets 3 once; unknown user not eligible');

  // Spending the grant: the third charged export marks it used up, once.
  const spender = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [spender]);
  const s1 = await unlock(spender, await newOpt(spender));
  assert.equal(s1.status, 'unlocked'); assert.equal(s1.balance, 2); assert.equal(s1.free_grant_used, false);
  assert.equal((await unlock(spender, await newOpt(spender))).free_grant_used, false);
  const s3 = await unlock(spender, await newOpt(spender));
  assert.equal(s3.balance, 0); assert.equal(s3.free_grant_used, true); assert.equal(s3.welcome_exports, 3);
  assert.deepEqual(await unlock(spender, await newOpt(spender)), { status: 'insufficient', balance: 0 });
  await svc("public.grant_apple_purchase($1,'txn-spender','resumely.exports.5.v2',5,'Sandbox')", [spender]);
  const s5 = await unlock(spender, await newOpt(spender));
  assert.equal(s5.free_grant_used, false, 'free_grant_used fires once');
  assert.equal(s5.paid_user, true);
  check('the welcome grant is spent by charged exports; the 3rd reports free_grant_used once; the 4th is a 402');

  // The first unlock grants even when ungated (credits wait for the gate).
  const ungated = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [ungated]);
  assert.equal((await unlock(ungated, await newOpt(ungated), false)).status, 'ungated');
  assert.equal(await balance(ungated), 3);
  check('an ungated export also gives the welcome grant and spends nothing');

  // Subscription rows: created, owned, renewed, older ignored, revoked.
  const subUser = randomUUID(), other = randomUUID();
  await admin.query('insert into auth.users(id) values ($1), ($2)', [subUser, other]);
  const startA = hours(-1), endA = hours(24 * 30);
  const created = await upsert(subUser, 'orig-1', 'txn-a', startA, endA);
  assert.equal(created.status, 'created'); assert.equal(created.active, true); assert.equal(created.user_id, subUser);
  assert.deepEqual(await upsert(other, 'orig-1', 'txn-a', startA, endA), { status: 'owned_by_other_account' });
  assert.equal((await upsert(subUser, 'orig-1', 'txn-a', startA, endA)).status, 'unchanged');
  assert.equal((await upsert(null, 'orig-unknown', 'txn-z', hours(-1), hours(1))).status, 'unknown_owner');
  assert.equal((await upsert(randomUUID(), 'orig-unknown', 'txn-z', hours(-1), hours(1))).status, 'unknown_owner', 'deleted account');
  assert.equal((await admin.query("select count(*)::int n from subscriptions where original_transaction_id='orig-unknown'")).rows[0].n, 0);
  const sub = (await state(subUser)).subscription;
  assert.equal(sub.active, true); assert.equal(sub.period_exports, 0); assert.equal(sub.period_cap, 40); assert.equal(sub.auto_renew, true);
  check('subscription: created for the buyer; another account is refused; replay unchanged; no owner, no row');

  // Subscription exports spend no credit, and a re-download stays free.
  const subOpt = await newOpt(subUser);
  const before = await balance(subUser);
  const u1 = await unlock(subUser, subOpt);
  assert.equal(u1.status, 'unlocked'); assert.equal(u1.source, 'subscription'); assert.equal(u1.period_exports, 1); assert.equal(u1.period_cap, 40);
  assert.equal(await balance(subUser), before);
  assert.equal((await unlock(subUser, subOpt)).status, 'already_unlocked');
  assert.equal((await unlock(subUser, subOpt)).source, 'subscription');
  assert.equal((await state(subUser)).subscription.period_exports, 1, 're-download does not count');
  check('an active subscription unlocks without spending credits; re-download is free and not counted');

  // Fair-use cap: 40 per period, then credits, then a 402 that names the cap.
  for (let i = 1; i < 40; i++) {
    assert.equal((await unlock(subUser, await newOpt(subUser))).source, 'subscription');
  }
  assert.equal((await state(subUser)).subscription.period_exports, 40);
  const over = await unlock(subUser, await newOpt(subUser));
  assert.equal(over.source, 'credit', 'the 41st export spends a credit');
  assert.equal(await balance(subUser), before - 1);
  await admin.query('update profiles set credit_balance=0 where user_id=$1', [subUser]);
  const capped = await unlock(subUser, await newOpt(subUser));
  assert.equal(capped.status, 'insufficient'); assert.equal(capped.subscription_cap_reached, true); assert.ok(capped.cap_resets_at);
  check('fair use: 40 subscription exports per period, the 41st spends a credit, then 402 with subscription_cap_reached');

  // Codex P2 on #204: deleting exported CVs does not give the cap back.
  const deleted = await admin.query(
    "delete from optimizations where id in (select optimization_id from export_unlocks where user_id=$1 and source='subscription' limit 10)", [subUser]);
  assert.equal(deleted.rowCount, 10);
  assert.equal((await state(subUser)).subscription.period_exports, 40, 'usage survives deleting the optimizations');
  assert.equal((await unlock(subUser, await newOpt(subUser))).status, 'insufficient');
  check('deleting 10 exported optimizations leaves the period count at 40; the next export is still refused');

  // A renewal starts a new period; an older transaction changes nothing.
  const startB = hours(0), endB = hours(24 * 60);
  const renewed = await upsert(subUser, 'orig-1', 'txn-b', startB, endB);
  assert.equal(renewed.status, 'renewed');
  assert.equal((await upsert(subUser, 'orig-1', 'txn-a', startA, endA)).status, 'unchanged');
  assert.equal((await admin.query("select latest_transaction_id t from subscriptions where original_transaction_id='orig-1'")).rows[0].t, 'txn-b');
  assert.equal((await state(subUser)).subscription.period_exports, 0);
  assert.equal((await unlock(subUser, await newOpt(subUser))).source, 'subscription');
  check('renewal moves the period forward and resets the count; an older transaction is ignored');

  // Auto-renew off is reported once; the plan stays active until it expires.
  const off = await renewalUpdate('orig-1', false, null, hours(-3));
  assert.equal(off.status, 'updated'); assert.equal(off.auto_renew_turned_off, true); assert.equal(off.user_id, subUser);
  assert.equal((await renewalUpdate('orig-1', false, null, hours(-2))).auto_renew_turned_off, false);
  assert.equal((await state(subUser)).subscription.active, true);
  assert.equal((await state(subUser)).subscription.auto_renew, false);
  assert.equal((await renewalUpdate('orig-none', false, null, hours(0))).status, 'not_found');
  check('auto-renew off: reported once, still active until expiry; unknown subscription is not_found');

  // Out-of-order renewal info (Codex P2 on #204): re-enable, then a late copy
  // of the older "disabled" info changes nothing and reports nothing.
  const reenabledAt = hours(-1);
  assert.equal((await renewalUpdate('orig-1', true, null, reenabledAt)).status, 'updated');
  const late = await renewalUpdate('orig-1', false, null, hours(-3));
  assert.equal(late.status, 'stale'); assert.equal(late.auto_renew_turned_off, false);
  assert.equal((await renewalUpdate('orig-1', false, null, reenabledAt)).status, 'stale', 'same signedDate is not newer');
  assert.equal((await state(subUser)).subscription.auto_renew, true);
  check('renewal info is applied only when newer: a late older notification cannot turn auto-renew off again');

  // Expiry, grace period and refund.
  const lapsed = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [lapsed]);
  await upsert(lapsed, 'orig-2', 'txn-c', hours(-24 * 31), hours(-1));
  assert.equal((await state(lapsed)).subscription.active, false);
  assert.equal((await unlock(lapsed, await newOpt(lapsed))).source, 'credit', 'expired: credits are used');
  await renewalUpdate('orig-2', null, hours(24 * 16), hours(-0.5));
  assert.equal((await state(lapsed)).subscription.active, true, 'billing grace period keeps it active');
  assert.equal((await unlock(lapsed, await newOpt(lapsed))).source, 'subscription');
  await renewalUpdate('orig-2', null, hours(24 * 16), hours(-0.7));
  assert.equal((await state(lapsed)).subscription.active, true, 'an older copy cannot end the grace period early or late');
  await renewalUpdate('orig-2', null, null, hours(-0.1));
  assert.equal((await state(lapsed)).subscription.active, false, 'newer renewal info with no grace period ends it');
  check('expired: credits; grace: active; an older copy is ignored; newer info with no grace ends it');

  // Refunds. A refund of an older billing period leaves the current, paid one active.
  const refundT1 = hours(-0.3), reverseT2 = hours(-0.2), refundT3 = hours(-0.1);
  const olderRefund = await revocation('orig-1', 'txn-a', hours(0), refundT1);
  assert.equal(olderRefund.status, 'unchanged'); assert.equal(olderRefund.active, true);
  const refunded = await revocation('orig-1', 'txn-b', hours(0), refundT1);
  assert.equal(refunded.status, 'revoked'); assert.equal(refunded.active, false); assert.equal(refunded.user_id, subUser);
  assert.equal((await state(subUser)).subscription.active, false);
  // Codex P1 on #204: replaying the still-valid pre-refund signed copy (no
  // revocationDate) through /verify's upsert must not switch the plan back on.
  const replayed = await upsert(subUser, 'orig-1', 'txn-b', startB, endB, null);
  assert.equal(replayed.status, 'unchanged'); assert.equal(replayed.active, false);
  assert.equal((await revocation('orig-1', 'txn-b', hours(0), refundT1)).status, 'stale', 'a repeated refund changes nothing');
  check('refund of the current period revokes it; an older period refund does not; a pre-refund replay cannot undo it');

  // Codex P2 on #204: an authoritative REFUND_REVERSED restores the plan, in order.
  const reversed = await revocation('orig-1', 'txn-b', null, reverseT2);
  assert.equal(reversed.status, 'restored'); assert.equal(reversed.active, true);
  assert.equal((await revocation('orig-1', 'txn-b', hours(0), refundT1)).status, 'stale', 'a late copy of the older refund');
  assert.equal((await state(subUser)).subscription.active, true);
  assert.equal((await revocation('orig-1', 'txn-b', hours(0), refundT3)).status, 'revoked', 'a newer second refund applies');
  assert.equal((await revocation('orig-none', 't', null, refundT3)).status, 'not_found');
  // Reversal delivered before its refund: the late refund is stale.
  const early = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [early]);
  await upsert(early, 'orig-3', 'txn-e', hours(-1), hours(24 * 30));
  assert.equal((await revocation('orig-3', 'txn-e', null, reverseT2)).status, 'unchanged');
  assert.equal((await revocation('orig-3', 'txn-e', hours(0), refundT1)).status, 'stale');
  assert.equal((await state(early)).subscription.active, true);
  await admin.query('update profiles set credit_balance=0 where user_id=$1', [subUser]);
  assert.deepEqual(await unlock(subUser, await newOpt(subUser)), { status: 'insufficient', balance: 0 });
  check('REFUND_REVERSED restores the plan; refunds and reversals apply in signedDate order either way round; revoked means a plain 402');

  // Packs and refunds still work after v2; a pack bought by a brand-new
  // profile starts it at 0, not 1.
  // The pre-spec credit functions also start a missing profile at 0.
  const legacy = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [legacy]);
  await admin.query('delete from profiles where user_id=$1', [legacy]);
  assert.equal(await svc("public.grant_apple_credits($1,2,'test','apple_iap','txn-legacy')", [legacy]), 2);
  const legacy2 = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [legacy2]);
  await admin.query('delete from profiles where user_id=$1', [legacy2]);
  assert.equal(await svc("public.consume_credit($1,'test')", [legacy2]), null, 'a new profile has nothing to spend');
  check('consume_credit and grant_apple_credits create a missing profile at 0, not 1');

  const buyer = randomUUID();
  await admin.query('insert into auth.users(id) values ($1)', [buyer]);
  await admin.query('delete from profiles where user_id=$1', [buyer]);
  assert.deepEqual(await svc("public.grant_apple_purchase($1,'txn-pack14','resumely.exports.14',14,'Sandbox')", [buyer]),
    { status: 'granted', credits_granted: 14, balance: 14 });
  assert.deepEqual(await svc("public.grant_apple_purchase($1,'txn-pack14','resumely.exports.14',14,'Sandbox')", [buyer]),
    { status: 'already_granted', credits_granted: 14, balance: 14 });
  assert.equal((await state(buyer)).balance, 17, 'the welcome grant lands on the next read');
  const refund = await svc("public.apply_iap_refund('txn-pack14','notif-pack14',false)");
  assert.equal(refund.status, 'refunded'); assert.equal(refund.credits_changed, -14);
  assert.equal(await balance(buyer), 3);
  check('14-pack grants once, profile created by a grant starts at 0, welcome grant follows, refund deducts the pack only');

  // Ledger stays consistent: every balance equals its ledger plus what it held before v2.
  const drift = (await admin.query(`select p.user_id, p.credit_balance, coalesce(sum(t.delta),0)::int ledger
    from profiles p left join credit_transactions t on t.user_id=p.user_id
    where p.user_id = any($1) group by p.user_id, p.credit_balance having p.credit_balance <> coalesce(sum(t.delta),0)`,
    [[fresh, racer, anon, spender, ungated, buyer]])).rows;
  assert.deepEqual(drift, []);
  check('for accounts created after v2, balance equals the ledger sum');

  console.log(`SUCCESS ${checks} checks; local Postgres ${(await admin.query('show server_version')).rows[0].server_version}; no hosted resources touched.`);
} finally {
  await pool?.end(); await admin?.end().catch(() => {});
  try { docker('rm', '-f', '-v', name); } catch { /* preserve original test failure */ }
}
