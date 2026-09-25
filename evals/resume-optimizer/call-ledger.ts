/**
 * Every model call a repeat-eval run makes, recorded at the HTTP layer.
 *
 * The pipeline builds its own OpenAI clients and the scorer calls embeddings
 * directly, so no single wrapper sees every call. The OpenAI SDK (v5) reads
 * `globalThis.fetch` when a client is constructed; patching it once before the batch
 * captures pipeline passes, the fallback and WP-64 repair calls, scorer embeddings
 * and both judges, without changing a line of production code.
 *
 * Three guards live here because this is the only place that sees every request:
 * 1. Transport retries are capped at one per call. The SDK sends
 *    `X-Stainless-Retry-Count`; a second retry gets a synthetic 503 carrying
 *    `x-should-retry: false`, which the SDK obeys, so it fails instead of looping.
 * 2. A hard cost cap. Once recorded spend reaches it, every further model call is
 *    refused the same way, so a run in flight cannot overshoot by more than the call
 *    already on the wire.
 * 3. Any request to a host that is not a model endpoint is blocked and recorded.
 *    That is how the harness proves a run made no analytics or database writes: the
 *    count must be zero, and an attempt fails loudly instead of leaving the machine.
 */

export type Endpoint = 'chat.completions' | 'embeddings';
export type CallPhase = 'generation' | 'judge' | 'calibration';

export interface Usage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CallRecord {
  runKey: string | null;
  phase: CallPhase | null;
  endpoint: Endpoint;
  requestedModel: string;
  returnedModel: string;
  status: number | 'network-error' | 'retry-cap-blocked' | 'cost-cap-blocked';
  retryCount: number;
  latencyMs: number;
  usage: Usage | null;
  costUsd: number | null;
  /**
   * True when the model had no recorded price and costUsd was charged at the most
   * expensive known rate instead. Keeps an unpriced call from slipping under the cap.
   */
  costEstimated?: boolean;
  error?: string;
}

export interface BlockedRequest {
  runKey: string | null;
  host: string;
  method: string;
}

/**
 * USD per 1M tokens. Read from https://developers.openai.com/api/docs/pricing on
 * 2026-09-24 (Standard tier). Re-check before trusting a cost figure from a later
 * batch; a stale price makes the cap wrong, not the run.
 */
export const PRICES_CHECKED_ON = '2026-09-24';
export const PRICES_PER_MTOK: Record<string, { input: number; cachedInput: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.6 },
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10 },
  'text-embedding-3-small': { input: 0.02, cachedInput: 0.02, output: 0 },
};

/**
 * Exact name or a dated snapshot of it ("gpt-4o-2024-08-06"). Anything else, such as
 * "gpt-4o-audio-preview", is priced differently and comes back null, so it shows up
 * as an unpriced call instead of a wrong number.
 */
export function priceFor(model: string): { input: number; cachedInput: number; output: number } | null {
  const snapshot = /^(.*)-\d{4}-\d{2}-\d{2}$/.exec(model);
  return PRICES_PER_MTOK[model] ?? (snapshot ? PRICES_PER_MTOK[snapshot[1]] ?? null : null);
}

const WORST_PRICE = {
  input: Math.max(...Object.values(PRICES_PER_MTOK).map((p) => p.input)),
  cachedInput: Math.max(...Object.values(PRICES_PER_MTOK).map((p) => p.cachedInput)),
  output: Math.max(...Object.values(PRICES_PER_MTOK).map((p) => p.output)),
};

export function costOf(model: string, usage: Usage | null, fallback: 'none' | 'worst' = 'none'): number | null {
  const price = priceFor(model) ?? (fallback === 'worst' ? WORST_PRICE : null);
  if (!price || !usage) return null;
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (uncached * price.input + usage.cachedInputTokens * price.cachedInput + usage.outputTokens * price.output) / 1_000_000
  );
}

function parseUsage(raw: unknown): Usage | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, any>;
  const input = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const output = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  return {
    inputTokens: input,
    cachedInputTokens: Number(u.prompt_tokens_details?.cached_tokens ?? 0),
    outputTokens: output,
    totalTokens: Number(u.total_tokens ?? input + output),
  };
}

function endpointOf(url: URL): Endpoint | null {
  if (url.pathname.endsWith('/chat/completions')) return 'chat.completions';
  if (url.pathname.endsWith('/embeddings')) return 'embeddings';
  return null;
}

function refusal(message: string): Response {
  return new Response(JSON.stringify({ error: { message, type: 'eval_harness_refusal' } }), {
    status: 503,
    headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
  });
}

type FetchLike = (input: any, init?: any) => Promise<Response>;

export interface LedgerOptions {
  maxTransportRetries?: number;
  hardCapUsd?: number;
  /** Hosts allowed through untouched. Model endpoints are always allowed. */
  allowHosts?: string[];
}

export class CallLedger {
  readonly records: CallRecord[] = [];
  readonly blocked: BlockedRequest[] = [];
  private runKey: string | null = null;
  private phase: CallPhase | null = null;
  private readonly maxTransportRetries: number;
  private readonly hardCapUsd: number;
  private readonly allowHosts: string[];

  constructor(options: LedgerOptions = {}) {
    this.maxTransportRetries = options.maxTransportRetries ?? 1;
    this.hardCapUsd = options.hardCapUsd ?? Number.POSITIVE_INFINITY;
    this.allowHosts = options.allowHosts ?? [];
  }

  setContext(runKey: string | null, phase: CallPhase | null): void {
    this.runKey = runKey;
    this.phase = phase;
  }

  totalCostUsd(): number {
    return this.records.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  }

  forRun(runKey: string): CallRecord[] {
    return this.records.filter((r) => r.runKey === runKey);
  }

  /** Wraps `target.fetch`. Returns a function that restores the original. */
  install(target: { fetch: FetchLike } = globalThis as unknown as { fetch: FetchLike }): () => void {
    const original = target.fetch;
    target.fetch = (input: any, init?: any) => this.intercept(original, input, init);
    return () => {
      target.fetch = original;
    };
  }

  private async intercept(original: FetchLike, input: any, init?: any): Promise<Response> {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input?.url ?? '');
    const url = new URL(href);
    const endpoint = endpointOf(url);

    if (!endpoint) {
      if (this.allowHosts.includes(url.host)) return original(input, init);
      this.blocked.push({ runKey: this.runKey, host: url.host, method: String(init?.method ?? 'GET') });
      throw new Error(`eval harness blocked an outbound request to ${url.host}: only model endpoints are allowed during a run`);
    }

    const headers = new Headers(init?.headers ?? (typeof input === 'object' && input?.headers ? input.headers : undefined));
    const retryCount = Number(headers.get('x-stainless-retry-count') ?? 0) || 0;
    let requestedModel = 'unknown';
    try {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (body?.model) requestedModel = String(body.model);
    } catch {
      // A body we cannot read still gets recorded, with the model as unknown.
    }

    const base = {
      runKey: this.runKey,
      phase: this.phase,
      endpoint,
      requestedModel,
      retryCount,
    };

    if (retryCount > this.maxTransportRetries) {
      this.records.push({ ...base, returnedModel: 'unknown', status: 'retry-cap-blocked', latencyMs: 0, usage: null, costUsd: null });
      return refusal('eval transport retry cap reached');
    }
    if (this.totalCostUsd() >= this.hardCapUsd) {
      this.records.push({ ...base, returnedModel: 'unknown', status: 'cost-cap-blocked', latencyMs: 0, usage: null, costUsd: null });
      return refusal('eval hard cost cap reached');
    }

    const started = performance.now();
    let response: Response;
    try {
      response = await original(input, init);
    } catch (error) {
      this.records.push({
        ...base,
        returnedModel: 'unknown',
        status: 'network-error',
        latencyMs: performance.now() - started,
        usage: null,
        costUsd: null,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    let returnedModel = 'unknown';
    let usage: Usage | null = null;
    try {
      const json = (await response.clone().json()) as Record<string, unknown>;
      if (typeof json.model === 'string') returnedModel = json.model;
      usage = parseUsage(json.usage);
    } catch {
      // Non-JSON bodies (gateway errors) keep model and usage unknown.
    }

    const pricedAs = returnedModel !== 'unknown' ? returnedModel : requestedModel;
    const priced = costOf(pricedAs, usage);
    this.records.push({
      ...base,
      returnedModel,
      status: response.status,
      latencyMs: performance.now() - started,
      usage,
      costUsd: priced ?? costOf(pricedAs, usage, 'worst'),
      costEstimated: priced === null && usage !== null,
    });
    return response;
  }
}

export interface RunCallSummary {
  modelCalls: number;
  logicalChatCalls: number;
  transportRetries: number;
  blockedByCap: number;
  embeddingCalls: number;
  judgeCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpricedCalls: number;
  requestedModels: string[];
  returnedModels: string[];
}

export function summarizeCalls(records: CallRecord[]): RunCallSummary {
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const generationChat = records.filter((r) => r.phase === 'generation' && r.endpoint === 'chat.completions');
  return {
    modelCalls: records.length,
    // One logical call can be several HTTP attempts; count the first attempt only.
    logicalChatCalls: generationChat.filter((r) => r.retryCount === 0).length,
    transportRetries: records.filter((r) => r.retryCount > 0).length,
    blockedByCap: records.filter((r) => r.status === 'retry-cap-blocked' || r.status === 'cost-cap-blocked').length,
    embeddingCalls: records.filter((r) => r.endpoint === 'embeddings').length,
    judgeCalls: records.filter((r) => r.phase === 'judge' && r.retryCount === 0).length,
    inputTokens: records.reduce((n, r) => n + (r.usage?.inputTokens ?? 0), 0),
    outputTokens: records.reduce((n, r) => n + (r.usage?.outputTokens ?? 0), 0),
    costUsd: records.reduce((n, r) => n + (r.costUsd ?? 0), 0),
    unpricedCalls: records.filter((r) => r.costEstimated).length,
    requestedModels: uniq(records.map((r) => r.requestedModel)),
    returnedModels: uniq(records.map((r) => r.returnedModel)),
  };
}
