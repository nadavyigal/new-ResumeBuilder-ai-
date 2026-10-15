import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// P2 of the market play: no route may charge a credit before the StoreKit gate
// opens. With MONETIZATION_ENABLED off (the default) the two pre-gate charges,
// `ats_score` and `refine_section`, are skipped: no credit is consumed and no
// `insufficient_credits` 402 is returned. With it on, today's charge stays.

type CreditResult =
  | { ok: true; remaining: number | null }
  | { ok: false; status: 402; error: 'insufficient_credits' }
  | { ok: false; status: 500; error: 'credit_consume_failed'; details?: string };

const EMPTY_BALANCE: CreditResult = { ok: false, status: 402, error: 'insufficient_credits' };

function mockNextServer() {
  jest.doMock('next/server', () => ({
    __esModule: true,
    NextResponse: class {
      status: number;
      private body: unknown;

      constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
      }

      static json(body: unknown, init?: { status?: number }) {
        return new this(body, init);
      }

      async json() {
        return this.body;
      }
    },
  }));
}

function mockAuthAndCredits(creditResult: CreditResult) {
  const routeClient = {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
  };
  jest.doMock('@/lib/supabase-server', () => ({
    __esModule: true,
    createRouteHandlerClient: jest.fn(async () => routeClient),
  }));

  const consumeCredit = jest.fn(async (...args: unknown[]) => {
    void args;
    return creditResult;
  });
  jest.doMock('@/lib/credits', () => ({ __esModule: true, consumeCredit }));
  return consumeCredit;
}

function jsonRequest(body: Record<string, unknown>) {
  return { headers: { get: () => null }, json: async () => body } as any;
}

function loadAtsScoreRoute(creditResult: CreditResult) {
  jest.resetModules();
  mockNextServer();
  const consumeCredit = mockAuthAndCredits(creditResult);
  const scoreResume = jest.fn(async () => ({ ats_score_optimized: 80 }));
  jest.doMock('@/lib/ats', () => ({ __esModule: true, scoreResume }));
  jest.doMock('@/lib/ats/quick-wins/generator', () => ({
    __esModule: true,
    generateQuickWins: jest.fn(),
  }));

  const { POST } = require('@/app/api/ats/score/route');
  return { POST, consumeCredit, scoreResume };
}

function loadRefineSectionRoute(creditResult: CreditResult) {
  jest.resetModules();
  mockNextServer();
  const consumeCredit = mockAuthAndCredits(creditResult);
  jest.doMock('openai', () => ({ __esModule: true, default: class {} }));
  const trackedChatCompletion = jest.fn(async () => ({
    choices: [{ message: { content: JSON.stringify({ suggestion: 'Led a team of five.' }) } }],
  }));
  jest.doMock('@/lib/posthog-ai', () => ({ __esModule: true, trackedChatCompletion }));
  jest.doMock('@/lib/ai/prompt-builders/refineSectionPrompt', () => ({
    __esModule: true,
    buildRefineSectionPrompt: () => ({ system: 'system', user: 'user' }),
  }));

  const { POST } = require('@/app/api/v1/refine-section/route');
  return { POST, consumeCredit, trackedChatCompletion };
}

const atsScoreBody = {
  resume_original: 'Original resume text',
  resume_optimized: 'Optimized resume text',
  job_description: 'Job description text',
};

const refineSectionBody = {
  resumeId: 'resume-1',
  selection: { text: 'Managed a team.' },
  instruction: 'Make it stronger',
};

describe('pre-gate credit charges', () => {
  const previous = process.env.MONETIZATION_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MONETIZATION_ENABLED;
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.MONETIZATION_ENABLED;
    } else {
      process.env.MONETIZATION_ENABLED = previous;
    }
  });

  describe('POST /api/ats/score', () => {
    it('scores without consuming a credit while monetization is off', async () => {
      const { POST, consumeCredit, scoreResume } = loadAtsScoreRoute(EMPTY_BALANCE);

      const response = await POST(jsonRequest(atsScoreBody));

      expect(response.status).toBe(200);
      expect(consumeCredit).not.toHaveBeenCalled();
      expect(scoreResume).toHaveBeenCalled();
    });

    it('treats any value other than "true" as off', async () => {
      process.env.MONETIZATION_ENABLED = 'false';
      const { POST, consumeCredit } = loadAtsScoreRoute(EMPTY_BALANCE);

      const response = await POST(jsonRequest(atsScoreBody));

      expect(response.status).toBe(200);
      expect(consumeCredit).not.toHaveBeenCalled();
    });

    it('charges one ats_score credit once monetization is on', async () => {
      process.env.MONETIZATION_ENABLED = 'true';
      const { POST, consumeCredit, scoreResume } = loadAtsScoreRoute({ ok: true, remaining: 2 });

      const response = await POST(jsonRequest(atsScoreBody));

      expect(response.status).toBe(200);
      expect(consumeCredit).toHaveBeenCalledWith('user-1', 'ats_score');
      expect(scoreResume).toHaveBeenCalled();
    });

    it('limits a user to 20 scores a minute once the credit no longer caps it', async () => {
      const { POST, scoreResume } = loadAtsScoreRoute(EMPTY_BALANCE);

      for (let i = 0; i < 20; i += 1) {
        expect((await POST(jsonRequest(atsScoreBody))).status).toBe(200);
      }
      const limited = await POST(jsonRequest(atsScoreBody));

      expect(limited.status).toBe(429);
      expect(scoreResume).toHaveBeenCalledTimes(20);
    });

    it('returns 402 insufficient_credits on an empty balance once monetization is on', async () => {
      process.env.MONETIZATION_ENABLED = 'true';
      const { POST, scoreResume } = loadAtsScoreRoute(EMPTY_BALANCE);

      const response = await POST(jsonRequest(atsScoreBody));

      expect(response.status).toBe(402);
      expect(await response.json()).toEqual({ error: 'insufficient_credits' });
      expect(scoreResume).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/refine-section', () => {
    it('refines without consuming a credit while monetization is off', async () => {
      const { POST, consumeCredit, trackedChatCompletion } = loadRefineSectionRoute(EMPTY_BALANCE);

      const response = await POST(jsonRequest(refineSectionBody));

      expect(response.status).toBe(200);
      expect(consumeCredit).not.toHaveBeenCalled();
      expect(trackedChatCompletion).toHaveBeenCalled();
    });

    it('limits a user to 20 refinements a minute once the credit no longer caps it', async () => {
      const { POST, trackedChatCompletion } = loadRefineSectionRoute(EMPTY_BALANCE);

      for (let i = 0; i < 20; i += 1) {
        expect((await POST(jsonRequest(refineSectionBody))).status).toBe(200);
      }
      const limited = await POST(jsonRequest(refineSectionBody));

      expect(limited.status).toBe(429);
      expect(trackedChatCompletion).toHaveBeenCalledTimes(20);
    });

    it('charges one refine_section credit once monetization is on', async () => {
      process.env.MONETIZATION_ENABLED = 'true';
      const { POST, consumeCredit, trackedChatCompletion } = loadRefineSectionRoute({
        ok: true,
        remaining: 2,
      });

      const response = await POST(jsonRequest(refineSectionBody));

      expect(response.status).toBe(200);
      expect(consumeCredit).toHaveBeenCalledWith('user-1', 'refine_section');
      expect(trackedChatCompletion).toHaveBeenCalled();
    });

    it('returns 402 insufficient_credits on an empty balance once monetization is on', async () => {
      process.env.MONETIZATION_ENABLED = 'true';
      const { POST, trackedChatCompletion } = loadRefineSectionRoute(EMPTY_BALANCE);

      const response = await POST(jsonRequest(refineSectionBody));

      expect(response.status).toBe(402);
      expect(await response.json()).toEqual({ error: 'insufficient_credits' });
      expect(trackedChatCompletion).not.toHaveBeenCalled();
    });
  });
});
