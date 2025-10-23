# Controlled Activation & Observation — Rollout Plan

Overall Progress: `0%`

## Tasks:

- [ ] 🟥 Step 1: Shadow enablement (staging, 48h)
  - [ ] 🟥 Set `AGENT_SDK_SHADOW=true`, keep `AGENT_SDK_ENABLED=false`
  - [ ] 🟥 Announce freeze window and scope to team

- [ ] 🟥 Step 2: Shadow telemetry monitoring
  - [ ] 🟥 Track `agent_shadow_logs` (intent[], ats_before/after, diff_count, warnings[])
  - [ ] 🟥 Verify median `ats_after > ats_before` and stable `diff_count`

- [ ] 🟥 Step 3: Nightly quality gates
  - [ ] 🟥 Run `npm run test:contracts` (schema stability)
  - [ ] 🟥 Run `node scripts/bench-agent.mjs --ci` (SLA p95, ATS lift)
  - [ ] 🟥 Alert on failures; file follow-ups

- [ ] 🟥 Step 4: Controlled activation
  - [ ] 🟥 Flip `AGENT_SDK_ENABLED=true`, `AGENT_SDK_SHADOW=false` if all gates pass
  - [ ] 🟥 Confirm routes respond with `AgentResult` and no shape drift

- [ ] 🟥 Step 5: Post‑enable monitoring
  - [ ] 🟥 Track error rate (< 0.5%) and p95 latency
  - [ ] 🟥 Monitor ATS lift stability and warnings rate

- [ ] 🟥 Step 6: Instant rollback path
  - [ ] 🟥 If regression: toggle `AGENT_SDK_ENABLED=false`, `AGENT_SDK_SHADOW=true`
  - [ ] 🟥 Restore legacy optimizer response; keep telemetry running

- [ ] 🟥 Step 7: Report and sign‑off
  - [ ] 🟥 Summarize metrics (ATS lift, p95, error %, warnings)
  - [ ] 🟥 Capture lessons and follow‑ups before broader rollout

