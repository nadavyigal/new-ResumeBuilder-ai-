# Contract Tests — Plan

Overall Progress: `100%`

## Tasks:

- [x] 🟩 Step 1: Contracts test harness
  - [x] 🟩 Create `tests/contracts` folder structure
  - [x] 🟩 Add npm script `test:contracts` (Jest filter)
  - [x] 🟩 Reuse existing Jest setup and path aliases

- [x] 🟩 Step 2: Legacy endpoints contract test
  - [x] 🟩 Add `tests/contracts/legacy-endpoints.test.ts`
  - [x] 🟩 Use representative sample payload for shape assertion
  - [x] 🟩 Assert legacy shape; allow optional `meta.agentResult`

- [x] 🟩 Step 3: AgentResult schema contract test
  - [x] 🟩 Add `tests/contracts/agent-result-schema.test.ts`
  - [x] 🟩 Invoke runtime with acceptance command
  - [x] 🟩 Validate response against Zod `AgentResultSchema`

- [x] 🟩 Step 4: Diff safety guarantees
  - [x] 🟩 Add `tests/contracts/diff-safety.test.ts`
  - [x] 🟩 Ensure no deletion diffs emitted by default (no after=="" with before present)
  - [x] 🟩 V1 emits no explicit delete ops

- [x] 🟩 Step 5: Execution
  - [x] 🟩 Add run command `npm run test:contracts`
  - [x] 🟩 Tests are hermetic and schema-focused

