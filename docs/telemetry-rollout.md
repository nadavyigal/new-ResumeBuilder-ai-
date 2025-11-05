# Telemetry Rollout Plan

This document explains how to activate the new instrumentation safely, moving from
shadow collection to limited enablement while maintaining observability.

## Feature Flags

Telemetry is guarded by environment variables consumed in `src/lib/telemetry/index.ts`:

- `TELEMETRY_ENABLED` – when `true`, events are written to `public.events`.
- `TELEMETRY_SHADOW` – when `true`, events are collected but annotated as
  `shadow: true` in the payload while keeping the user experience unchanged.
- `TELEMETRY_NAMESPACE` – optional, defaults to `resume_builder_ai`; useful for
  segregating events when multiple environments share a Supabase project.

`TELEMETRY_ENABLED` has priority. If it is `false` and `TELEMETRY_SHADOW` is
`true`, telemetry runs in shadow mode. When both are `false`, all telemetry calls
become no-ops and API handlers continue without failure.

## Rollout Steps

1. **Shadow mode (safe observation)**
   - Deploy with `TELEMETRY_ENABLED=false` and `TELEMETRY_SHADOW=true`.
   - Verify payloads contain `shadow: true` inside `payload_data`.
   - Attach a monitor (see below) to confirm handlers are being invoked without
     adding user-facing latency or errors.

2. **Limited enablement (partial traffic)**
   - Flip `TELEMETRY_ENABLED=true` for a small percentage of traffic or a single
     environment (e.g., staging or a subset of production pods).
   - Keep `TELEMETRY_SHADOW=true` during this phase so payloads retain the
     rollout metadata.
   - Watch Supabase row counts, latency metrics, and API error rates. Roll back
     by setting `TELEMETRY_ENABLED=false` if anomalies appear.

3. **General availability**
   - Once metrics look healthy, disable shadow mode with
     `TELEMETRY_SHADOW=false`. Continue monitoring to ensure sustained health.

## Monitoring Hooks

`recordTelemetryEvent` accepts an optional monitor callback via
`setTelemetryMonitor`:

```ts
import { setTelemetryMonitor } from '@/lib/telemetry';

setTelemetryMonitor((result) => {
  if (!result.recorded) {
    console.warn('Telemetry skipped', result);
  }
});
```

Use this to export metrics to Datadog, Prometheus, or console logs during the
rollout. The monitor fires for both successes and failures, and any exceptions
thrown by the monitor are caught so that API handlers stay resilient.

## Event Coverage

- **proposal_acceptance** – triggered after successful application of proposed
  resume changes.
- **ats_delta** – captures baseline vs. post-change ATS scores plus keyword
  counts.
- **language_distribution** – records detected language metadata for optimized
  resumes.
- **undo_usage** – emitted whenever the undo history endpoint successfully
  restores a previous revision.

These events all respect the feature flags above and fail open when telemetry is
disabled, ensuring a safe rollout across environments.
