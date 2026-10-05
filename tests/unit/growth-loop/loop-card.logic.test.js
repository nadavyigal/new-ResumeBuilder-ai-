/**
 * Growth-loop card gates.
 *
 * Only the four behaviours that can produce a wrong decision are covered here:
 * the approval gate, the unverified-tracking block that approval cannot lift,
 * the missing-data path, and the rehearsal that must not publish. Layout and
 * styling are deliberately untested.
 */
const card = require('../../../docs/gtm/growth-loop/loop-card.logic.js');

/** A cycle that is complete and correct, so each test can spoil exactly one thing. */
function readyState(overrides) {
  return Object.assign(
    {
      mode: 'real',
      campaign_id: 'rb-li-20260910-trusted-workspace',
      channel: 'LinkedIn (personal profile)',
      positioning: 'Trusted application workspace',
      question: 'Does one Hebrew LinkedIn post produce attributable arrivals?',
      destination: 'https://resumelybuilderai.com/he/ats-checker',
      asset_ref: 'vault 2026-08-16-resumely-linkedin-posts.md — post 2',
      locale: 'he',
      baseline_source: 'scripts/measurement_contract.py (iOS repo)',
      baseline_value: '0 external activations, 1.5.1 (29)',
      baseline_read_at: '2026-09-10T00:00:00Z',
      tracking_status: 'verified',
      claims_checked: 'Checked against .agents/product-marketing.md avoid-list',
      founder_approval: true,
      published_at: '2026-09-10T09:00:00Z',
      published_url: 'https://www.linkedin.com/posts/example',
      operating_minutes: 25,
      correction_rounds: 1,
      channel_evidence: '3 replies, 0 DMs',
      posthog_evidence: 'contract output pasted verbatim',
      decision: 'continue',
      next_action: 'Second post in 3 days',
      next_review_at: '2026-09-17',
    },
    overrides || {}
  );
}

describe('publication gate', () => {
  test('a complete, approved, tracked cycle may publish for real', () => {
    const gate = card.publicationGate(readyState());
    expect(gate.blockers).toEqual([]);
    expect(gate.allowedToPublish).toBe(true);
  });

  test('real publication is blocked without founder approval, and says so', () => {
    const gate = card.publicationGate(readyState({ founder_approval: false }));
    expect(gate.allowedToPublish).toBe(false);
    expect(gate.blockers.join(' ')).toMatch(/Founder approval is missing/);
  });

  test('founder approval cannot override unverified tracking', () => {
    const gate = card.publicationGate(
      readyState({ founder_approval: true, tracking_status: 'unverified' })
    );
    expect(gate.allowedToPublish).toBe(false);
    expect(gate.blockers.join(' ')).toMatch(/Tracking is not verified/);
    expect(gate.blockers.join(' ')).toMatch(/cannot override/);
  });

  test('missing required inputs block progress and are each named', () => {
    const gate = card.publicationGate(readyState({ destination: '', baseline_value: '   ' }));
    expect(gate.allowedToPublish).toBe(false);
    expect(gate.blockers).toEqual(
      expect.arrayContaining([
        'Frame is incomplete: Destination URL',
        'Prepare is incomplete: Pre-action baseline: the value at read time',
      ])
    );
  });

  test('a campaign id the store token cannot carry is rejected with the usable form', () => {
    const gate = card.publicationGate(readyState({ campaign_id: 'RB LinkedIn קמפיין' }));
    expect(gate.allowedToPublish).toBe(false);
    expect(gate.blockers.join(' ')).toMatch(/Campaign ID is not usable/);
  });

  test('the gate never itself publishes', () => {
    expect(card.publicationGate(readyState()).publishes).toBe(false);
  });
});

describe('rehearsal', () => {
  test('completes without publishing, even when every input is valid', () => {
    const result = card.rehearse(readyState());
    expect(result.completed).toBe(true);
    expect(result.published).toBe(false);
    expect(result.wouldBlockInRealMode).toEqual([]);
  });

  test('reports what would have blocked a real run, without acting', () => {
    const result = card.rehearse(readyState({ tracking_status: 'unverified' }));
    expect(result.published).toBe(false);
    expect(result.wouldBlockInRealMode.join(' ')).toMatch(/Tracking is not verified/);
  });
});

describe('evidence verdict', () => {
  const now = '2026-09-30T00:00:00Z';

  test('an immature cohort is not yet measurable and names its earliest read', () => {
    const v = card.evidenceVerdict(readyState(), '2026-09-11T00:00:00Z');
    expect(v.measurable).toBe(false);
    expect(v.state).toBe('not_yet_measurable');
    expect(v.reason).toMatch(/168h per user/);
    expect(v.reread_when).toMatch(/2026-09-17T09:00:00\.000Z/);
  });

  test('missing counts are a stated gap, never an estimate', () => {
    const v = card.evidenceVerdict(readyState(), now);
    expect(v.measurable).toBe(false);
    expect(v.reason).toMatch(/measurement command has not been run/);
    expect(v.reread_when).toMatch(/operating guide/);
    expect(v).not.toHaveProperty('rate');
  });

  test('below n=10 the counts stand and no rate is computed', () => {
    const v = card.evidenceVerdict(readyState({ n_denominator: 4, n_activations: 1 }), now);
    expect(v.state).toBe('counts_only');
    expect(v.counts).toEqual({ denominator: 4, activations: 1 });
    expect(v).not.toHaveProperty('rate');
    expect(v.reread_when).toMatch(/reaches 10/);
  });

  test('at or above n=10 a rate is produced, carrying the single-post caveat', () => {
    const v = card.evidenceVerdict(readyState({ n_denominator: 20, n_activations: 6 }), now);
    expect(v.measurable).toBe(true);
    expect(v.rate_label).toBe('30.0% (6/20)');
    expect(v.caveat).toMatch(/One post cannot establish a positioning winner/);
  });

  test('unverified tracking makes the cohort unreadable, not merely early', () => {
    const v = card.evidenceVerdict(
      readyState({ tracking_status: 'unverified', n_denominator: 40, n_activations: 12 }),
      now
    );
    expect(v.measurable).toBe(false);
    expect(v.reason).toMatch(/cannot be attributed/);
    expect(v.reread_when).toMatch(/cannot be recovered/);
  });

  test('every not-measurable verdict carries both a reason and a re-read condition', () => {
    const cases = [
      card.evidenceVerdict(readyState({ tracking_status: 'unverified' }), now),
      card.evidenceVerdict(readyState({ published_at: '' }), now),
      card.evidenceVerdict(readyState({ published_at: 'not-a-date' }), now),
      card.evidenceVerdict(readyState(), '2026-09-11T00:00:00Z'),
      card.evidenceVerdict(readyState(), now),
      card.evidenceVerdict(readyState({ n_denominator: 2, n_activations: 0 }), now),
    ];
    cases.forEach((v) => {
      expect(v.measurable).toBe(false);
      expect(typeof v.reason).toBe('string');
      expect(v.reason.length).toBeGreaterThan(0);
      expect(typeof v.reread_when).toBe('string');
      expect(v.reread_when.length).toBeGreaterThan(0);
    });
  });
});

describe('handoffs', () => {
  test('every role gets a bounded brief from the same card', () => {
    const h = card.handoffs(readyState());
    ['marketing', 'grok', 'codex', 'claude_code'].forEach((role) => {
      expect(h[role].owns).toEqual(expect.any(String));
      expect(h[role].brief).toContain('rb-li-20260910-trusted-workspace');
      expect(h[role].must_not.length).toBeGreaterThan(0);
    });
  });

  test('no role is handed the publish action', () => {
    const h = card.handoffs(readyState());
    const allMustNot = Object.values(h)
      .map((role) => role.must_not.join(' '))
      .join(' ');
    expect(allMustNot).toMatch(/Publish|Post|Deploy/);
  });
});

describe('export', () => {
  test('the record is complete and round-trips through markdown', () => {
    const record = card.buildRecord(
      readyState({ n_denominator: 20, n_activations: 6 }),
      '2026-09-30T00:00:00Z'
    );
    expect(record.schema).toBe('resumely.growth-loop.card/1');
    expect(record.incomplete_stages).toEqual([]);
    expect(record.cycle.campaign_id).toBe('rb-li-20260910-trusted-workspace');
    expect(record.baseline.value).toBeTruthy();
    expect(record.approval.founder_approval).toBe(true);
    expect(record.publication.published_url).toBeTruthy();
    expect(record.evidence.verdict.measurable).toBe(true);
    expect(record.decision.next_review_at).toBe('2026-09-17');
    expect(Object.keys(record.handoffs)).toHaveLength(4);

    const md = card.toMarkdown(record);
    expect(md).toContain('rb-li-20260910-trusted-workspace');
    expect(md).toContain('30.0% (6/20)');
    expect(md).toContain('Founder approval: yes');
  });

  test('an incomplete export names what is missing rather than omitting it', () => {
    const record = card.buildRecord(
      readyState({ decision: '', next_action: '', mode: 'rehearsal' }),
      '2026-09-30T00:00:00Z'
    );
    expect(record.incomplete_stages).toEqual([
      { stage: 'decision', missing: ['Decision', 'Next action'] },
    ]);
    expect(card.toMarkdown(record)).toContain('Incomplete stages');
  });
});
