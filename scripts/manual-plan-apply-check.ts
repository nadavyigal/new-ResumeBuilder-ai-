import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';

// Stub server-only module for Node execution outside Next.js runtime
const require = Module.createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve('server-only');
  const stub = new Module(serverOnlyPath);
  stub.exports = {};
  require.cache[serverOnlyPath] = stub;
} catch {
  // ignore if module resolution fails
}

let AgentRuntime: typeof import('../src/lib/agent').AgentRuntime;
let ATS: typeof import('../src/lib/agent/tools/ats').ATS;

async function ensureDeps() {
  if (!AgentRuntime || !ATS) {
    const [{ AgentRuntime: Runtime }, { ATS: AtsTool }] = await Promise.all([
      import('../src/lib/agent'),
      import('../src/lib/agent/tools/ats'),
    ]);
    AgentRuntime = Runtime;
    ATS = AtsTool;
  }
}

async function runCycle(sample: string) {
  await ensureDeps();
  const dir = path.join('tests/fixtures', sample);
  const resume = JSON.parse(fs.readFileSync(path.join(dir, 'resume.json'), 'utf8'));
  const job = fs.readFileSync(path.join(dir, 'job.txt'), 'utf8');
  const AtsTool = ATS!;
  const Runtime = AgentRuntime!;
  const before = AtsTool.score({ resume_json: resume, job_text: job }).score ?? 0;
  const runtime = new Runtime();
  const started = Date.now();
  const result = await runtime.run({
    userId: 'manual-check',
    command: 'Analyze resume and apply improvements',
    resume_json: resume,
    job_text: job,
  });
  const elapsed = Date.now() - started;
  const after = result.ats_report?.score ?? 0;
  return {
    sample,
    language: sample === 'sample-11' ? 'hebrew' : 'english',
    elapsed_ms: elapsed,
    ats_before: before,
    ats_after: after,
    ats_delta: after - before,
    actions: result.actions?.map((a) => a.tool) ?? [],
    diffs: result.diffs?.length ?? 0,
  };
}

async function main() {
  const results = await Promise.all(['sample-01', 'sample-11'].map(runCycle));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
