# Archived migrations

These 45 files built the Resumely database until 2026-10-13. They are kept for
history only. The Supabase CLI reads `supabase/migrations/`, not this folder,
so they are never replayed again.

`supabase/migrations/20261012000000_production_baseline.sql` replaced them. It
is a schema dump of production (plus the auth trigger, storage buckets and
policies, catalog rows and privilege lock-downs the dump leaves out).

## Why they were retired

- `20250915000002_advanced_functions.sql` used `CREATE POLICY IF NOT EXISTS`,
  which Postgres rejects.
- `20251025080000_fix_function_search_paths.sql` changed the return type of two
  existing functions, which Postgres rejects. Production never had those
  versions.
- `20260104145415_remote_schema.sql` (a generated dump) fails on replay at
  `beta_signups.email`.
- The repo and production histories had drifted. Several files here carry a
  different version than production recorded, for example
  `20260922000000_revoke_client_definer_exec.sql` is `20260923061119` on
  production.

## Production history before the baseline (snapshot 2026-10-13)

`supabase_migrations.schema_migrations` on project `brtdyamysfmctrhuankn` held
these 43 versions:

```
20231027110000 20231027115959 20231027120000 20231027120001 20231027120002
20231027120003 20250123999998 20250123999999 20250124000000 20250124000001
20250128000000 20250915000000 20250915000001 20250915000002 20251006000000
20251012999999 20251013000000 20251023000100 20251023000300 20251023000400
20251025080000 20251027000000 20251224999999 20251225000000 20251225000001
20251228000000 20260104000000 20260104144852 20260104145415 20260104150134
20260104195347 20260301000000 20260302000000 20260506081439 20260506081457
20260506081502 20260616075334 20260709102900 20260709110422 20260720000000
20260811094958 20260811100912 20260923061119
```

## After the baseline PR merges (founder runs, or approves)

Repair production's history so the CLI sees one applied baseline. This writes
only to `supabase_migrations.schema_migrations`; no schema changes run.

```bash
supabase migration repair --linked --status reverted 20231027110000 20231027115959 20231027120000 20231027120001 20231027120002 20231027120003 20250123999998 20250123999999 20250124000000 20250124000001 20250128000000 20250915000000 20250915000001 20250915000002 20251006000000 20251012999999 20251013000000 20251023000100 20251023000300 20251023000400 20251025080000 20251027000000 20251224999999 20251225000000 20251225000001 20251228000000 20260104000000 20260104144852 20260104145415 20260104150134 20260104195347 20260301000000 20260302000000 20260506081439 20260506081457 20260506081502 20260616075334 20260709102900 20260709110422 20260720000000 20260811094958 20260811100912 20260923061119
supabase migration repair --linked --status applied 20261012000000
supabase migration list --linked
```

`migration list` should then show one row, `20261012000000`, applied on both
sides.

To undo, mark the baseline reverted and the 43 versions above applied again
(`--status reverted 20261012000000`, then `--status applied <the 43>`).
