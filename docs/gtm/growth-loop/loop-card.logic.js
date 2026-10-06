/*
 * Growth-loop experiment card — decision logic.
 *
 * WHY THIS FILE IS SEPARATE FROM THE HTML
 * ---------------------------------------
 * The card's gates are the only part of it that can be wrong in a way that
 * matters: a gate that lets a real publication through without founder
 * approval, or lets a rate be quoted off an immature cohort, produces a bad
 * decision that looks like a good one. Those gates therefore live in a plain
 * module that Jest can require directly, and the HTML is only a shell that
 * renders their output.
 *
 * The numeric rules are NOT invented here. They are the ones already pinned by
 * `scripts/measurement_contract.py` in the Resumely iOS repo (D7 = 168h,
 * n >= 10 for any rate, exact build, person-level internal exclusion). This
 * file restates the two the card needs and defers everything else to that
 * command. If the contract moves, this file is wrong and must follow it.
 *
 * Loads in a browser as `window.GrowthLoopCard` and in Jest as a CommonJS
 * module. No dependencies, no network, no storage access in here.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GrowthLoopCard = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var D7_HOURS = 168;
  var MIN_N_FOR_A_RATE = 10;
  var HOUR_MS = 3600 * 1000;

  var STAGES = [
    { key: 'frame', title: '1. Frame' },
    { key: 'prepare', title: '2. Prepare' },
    { key: 'review_approve', title: '3. Review and approve' },
    { key: 'publication_record', title: '4. Manual publication record' },
    { key: 'evidence_readout', title: '5. Evidence readout' },
    { key: 'decision', title: '6. Decision' },
  ];

  // Only fields whose absence makes the stage's output dishonest are required.
  var REQUIRED = {
    frame: [
      ['campaign_id', 'Campaign ID'],
      ['channel', 'Channel'],
      ['positioning', 'Positioning under test'],
      ['question', 'The question this cycle answers'],
      ['destination', 'Destination URL'],
    ],
    prepare: [
      ['asset_ref', 'Asset reference (the draft being used)'],
      ['locale', 'Locale'],
      ['baseline_source', 'Pre-action baseline: how it was read'],
      ['baseline_value', 'Pre-action baseline: the value at read time'],
      ['baseline_read_at', 'Pre-action baseline: read timestamp (UTC)'],
      ['tracking_status', 'Tracking status'],
    ],
    review_approve: [
      ['claims_checked', 'Claim check against the avoid-list'],
      ['founder_approval', 'Founder approval'],
    ],
    publication_record: [
      ['published_at', 'Actual publication timestamp (UTC)'],
      ['published_url', 'Direct link to the published item'],
      ['operating_minutes', 'Operating time (minutes)'],
      ['correction_rounds', 'Correction rounds'],
    ],
    evidence_readout: [
      ['channel_evidence', 'Channel evidence (replies, not impressions)'],
      ['posthog_evidence', 'PostHog read output'],
    ],
    decision: [
      ['decision', 'Decision'],
      ['next_action', 'Next action'],
      ['next_review_at', 'Next review date'],
    ],
  };

  function isBlank(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return value === false;
    return String(value).trim() === '';
  }

  /** Names every missing required field for a stage. Never a bare "invalid". */
  function missingFields(stage, state) {
    var spec = REQUIRED[stage] || [];
    var s = state || {};
    return spec
      .filter(function (pair) {
        return isBlank(s[pair[0]]);
      })
      .map(function (pair) {
        return pair[1];
      });
  }

  /**
   * Apple's campaign token and our own campaign id share one spelling so a
   * store-side row and a PostHog row can be matched by eye. Lowercase, ASCII,
   * hyphen-separated; anything else is dropped rather than transliterated,
   * because a silently rewritten id is worse than a rejected one.
   */
  function sanitizeCampaignToken(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  function validateCampaignId(value) {
    var token = sanitizeCampaignToken(value);
    if (!token) {
      return { ok: false, token: '', reason: 'Campaign ID is empty after sanitising.' };
    }
    if (token !== String(value == null ? '' : value).trim().toLowerCase()) {
      return {
        ok: false,
        token: token,
        reason: 'Campaign ID contains characters the store token cannot carry. Use "' + token + '".',
      };
    }
    return { ok: true, token: token, reason: '' };
  }

  /**
   * The publication gate. Three independent blocks, reported together so the
   * operator fixes them in one pass instead of discovering them one at a time.
   *
   * Order matters for one of them: unverified tracking blocks a real
   * publication EVEN WHEN the founder has approved. Approval is permission to
   * act; it is not evidence that the action will be measurable. WP-32 and
   * rb-he-aso-001 both published with approval and no verified link and are
   * permanently unreadable as a result.
   */
  function publicationGate(state) {
    var s = state || {};
    var blockers = [];
    var mode = s.mode === 'real' ? 'real' : 'rehearsal';

    missingFields('frame', s).forEach(function (label) {
      blockers.push('Frame is incomplete: ' + label);
    });
    missingFields('prepare', s).forEach(function (label) {
      blockers.push('Prepare is incomplete: ' + label);
    });

    if (!isBlank(s.campaign_id)) {
      var check = validateCampaignId(s.campaign_id);
      if (!check.ok) blockers.push('Campaign ID is not usable: ' + check.reason);
    }

    if (s.tracking_status !== 'verified') {
      blockers.push(
        'Tracking is not verified. Founder approval cannot override this: an ' +
          'unattributable publication produces no evidence, only activity.'
      );
    }

    if (s.founder_approval !== true) {
      blockers.push('Founder approval is missing. Only the founder releases an external action.');
    }

    return {
      mode: mode,
      // Rehearsal never publishes, so it is never "allowed" — it is not asked.
      allowedToPublish: mode === 'real' && blockers.length === 0,
      publishes: false,
      blockers: blockers,
    };
  }

  /** A rehearsal runs the whole card and stops short of the external action. */
  function rehearse(state) {
    var gate = publicationGate(Object.assign({}, state || {}, { mode: 'rehearsal' }));
    return {
      mode: 'rehearsal',
      completed: true,
      published: false,
      wouldBlockInRealMode: gate.blockers,
      note: 'Rehearsal complete. Nothing was published and no event was sent.',
    };
  }

  function hoursBetween(fromIso, toIso) {
    var from = Date.parse(fromIso);
    var to = Date.parse(toIso);
    if (isNaN(from) || isNaN(to)) return null;
    return (to - from) / HOUR_MS;
  }

  function addHours(iso, hours) {
    var t = Date.parse(iso);
    if (isNaN(t)) return null;
    return new Date(t + hours * HOUR_MS).toISOString();
  }

  /**
   * The readout verdict. "not yet measurable" is a first-class outcome, and it
   * is only ever returned with a reason and the condition that ends it. A
   * partial figure is never returned: below n=10 the counts stand alone and no
   * rate is computed.
   */
  function evidenceVerdict(state, nowIso) {
    var s = state || {};
    var now = nowIso || new Date().toISOString();

    if (s.tracking_status !== 'verified') {
      return {
        measurable: false,
        state: 'not_yet_measurable',
        reason: 'Tracking was never verified for this campaign, so arrivals cannot be attributed to it.',
        reread_when: 'Verify the campaign link end to end, then re-run the cycle. This cohort cannot be recovered.',
      };
    }

    if (isBlank(s.published_at)) {
      return {
        measurable: false,
        state: 'not_yet_measurable',
        reason: 'No publication timestamp recorded, so the cohort has no start.',
        reread_when: 'Record the actual publication timestamp in stage 4.',
      };
    }

    var age = hoursBetween(s.published_at, now);
    if (age === null) {
      return {
        measurable: false,
        state: 'not_yet_measurable',
        reason: 'Publication timestamp is not a readable ISO 8601 UTC instant.',
        reread_when: 'Correct the timestamp in stage 4.',
      };
    }
    if (age < D7_HOURS) {
      return {
        measurable: false,
        state: 'not_yet_measurable',
        reason:
          'Cohort is ' +
          age.toFixed(1) +
          'h old; the activation metric needs ' +
          D7_HOURS +
          'h per user.',
        reread_when: 'Earliest valid D7 read: ' + addHours(s.published_at, D7_HOURS) + '.',
      };
    }

    var denominator = Number(s.n_denominator);
    var activations = Number(s.n_activations);
    if (!isFinite(denominator) || !isFinite(activations)) {
      return {
        measurable: false,
        state: 'not_yet_measurable',
        reason: 'The measurement command has not been run, so there are no counts to read.',
        reread_when: 'Run the command in the operating guide and paste its output into stage 5.',
      };
    }

    if (denominator < MIN_N_FOR_A_RATE) {
      return {
        measurable: false,
        state: 'counts_only',
        reason:
          'n = ' +
          denominator +
          ' at the denominator step, below the n=' +
          MIN_N_FOR_A_RATE +
          ' floor. Counts stand; no rate is computed.',
        reread_when: 'Re-read when the denominator reaches ' + MIN_N_FOR_A_RATE + ' mature users.',
        counts: { denominator: denominator, activations: activations },
      };
    }

    return {
      measurable: true,
      state: 'measurable',
      counts: { denominator: denominator, activations: activations },
      rate: activations / denominator,
      rate_label: ((activations / denominator) * 100).toFixed(1) + '% (' + activations + '/' + denominator + ')',
      caveat:
        'One post cannot establish a positioning winner. This is execution and attribution evidence for one cycle.',
    };
  }

  /**
   * Bounded handoffs. Every role gets its brief from this one card, and each
   * brief carries an explicit must-not list, because the failure mode in this
   * portfolio has been a role quietly taking the next step for you.
   */
  function handoffs(state) {
    var s = state || {};
    var id = s.campaign_id || '(campaign id not set)';
    return {
      marketing: {
        owns: 'Adapt the approved draft to the channel and hand back copy only.',
        brief:
          'Campaign ' + id + ' on ' + (s.channel || '(channel not set)') + ', locale ' +
          (s.locale || '(locale not set)') + ', positioning "' + (s.positioning || '(not set)') +
          '". Use the existing draft at ' + (s.asset_ref || '(asset not set)') + '. Body carries no link.',
        must_not: [
          'Publish, schedule, or open a platform session.',
          'Introduce any claim absent from .agents/product-marketing.md.',
          'Quote a number that is not in this card.',
        ],
      },
      grok: {
        owns: 'Caption drafting and a drift check (P1-P6 / D1-D6) on the asset before it publishes.',
        brief: 'Draft the caption for ' + id + ' and return a drift table. Drafts only.',
        must_not: [
          'Post, schedule, or touch the content calendar.',
          'Own monitoring, follower counts, or performance numbers.',
          'State a product claim without a dated source.',
        ],
      },
      codex: {
        owns: 'Local repository work named in this card, on a branch.',
        brief:
          'For ' + id + ': implement only what stage 2 lists, on a branch. Return a diff. ' +
          'The campaign id is the one identity the card, the store token and the analytics ' +
          'session must all spell the same way.',
        must_not: [
          'Deploy, release, merge, or publish.',
          'Change governed activation-event meanings.',
          'Touch credentials, schemas, or production data.',
        ],
      },
      claude_code: {
        owns: 'Run the measurement command, paste its verbatim output into stage 5, and write the decision record.',
        brief:
          'Run the aggregate read for ' + id + '. Report the command output as given, including a ' +
          '"not yet measurable" verdict.',
        must_not: [
          'Estimate, interpolate, or round a count.',
          'Quote a rate below the n=' + MIN_N_FOR_A_RATE + ' floor.',
          'Re-run a check that already produced a false pass.',
        ],
      },
    };
  }

  /** 0 is a real answer for a count; `||` would silently turn it into "unknown". */
  function orNull(value) {
    return isBlank(value) && value !== 0 && value !== '0' ? null : value;
  }

  /** The exported record. One object, complete enough to reconstruct the cycle. */
  function buildRecord(state, nowIso) {
    var s = state || {};
    var now = nowIso || new Date().toISOString();
    var gate = publicationGate(s);
    var verdict = evidenceVerdict(s, now);
    return {
      schema: 'resumely.growth-loop.card/1',
      exported_at: now,
      mode: gate.mode,
      cycle: {
        campaign_id: s.campaign_id || null,
        channel: s.channel || null,
        locale: s.locale || null,
        positioning: s.positioning || null,
        question: s.question || null,
        destination: s.destination || null,
        asset_ref: s.asset_ref || null,
      },
      baseline: {
        source: s.baseline_source || null,
        value: s.baseline_value || null,
        read_at: s.baseline_read_at || null,
      },
      tracking: {
        status: s.tracking_status || 'unverified',
        note: s.tracking_note || null,
      },
      approval: {
        claims_checked: s.claims_checked || null,
        founder_approval: s.founder_approval === true,
        approved_at: s.approved_at || null,
      },
      publication: {
        published_at: s.published_at || null,
        published_url: s.published_url || null,
        operating_minutes: orNull(s.operating_minutes),
        correction_rounds: orNull(s.correction_rounds),
      },
      evidence: {
        channel: s.channel_evidence || null,
        posthog: s.posthog_evidence || null,
        supporting: s.supporting_evidence || null,
        verdict: verdict,
      },
      decision: {
        decision: s.decision || null,
        next_action: s.next_action || null,
        next_review_at: s.next_review_at || null,
      },
      gate: gate,
      handoffs: handoffs(s),
      incomplete_stages: STAGES.filter(function (stage) {
        return missingFields(stage.key, s).length > 0;
      }).map(function (stage) {
        return { stage: stage.key, missing: missingFields(stage.key, s) };
      }),
    };
  }

  function toMarkdown(record) {
    var r = record || {};
    var lines = [];
    lines.push('### Growth loop — ' + (r.cycle && r.cycle.campaign_id ? r.cycle.campaign_id : 'unnamed cycle'));
    lines.push('');
    lines.push('- Mode: **' + r.mode + '**' + (r.mode === 'rehearsal' ? ' (nothing was published)' : ''));
    lines.push('- Channel / locale: ' + (r.cycle.channel || '—') + ' / ' + (r.cycle.locale || '—'));
    lines.push('- Positioning under test: ' + (r.cycle.positioning || '—'));
    lines.push('- Question: ' + (r.cycle.question || '—'));
    lines.push('- Destination: ' + (r.cycle.destination || '—'));
    lines.push('- Asset: ' + (r.cycle.asset_ref || '—'));
    lines.push(
      '- Pre-action baseline: ' + (r.baseline.value || '—') + ' (' + (r.baseline.source || '—') + ', read ' + (r.baseline.read_at || '—') + ')'
    );
    lines.push('- Tracking: **' + r.tracking.status + '**' + (r.tracking.note ? ' — ' + r.tracking.note : ''));
    lines.push('- Founder approval: ' + (r.approval.founder_approval ? 'yes' : 'no'));
    lines.push('- Published: ' + (r.publication.published_at || 'not published') + (r.publication.published_url ? ' — ' + r.publication.published_url : ''));
    var minutes = r.publication.operating_minutes;
    var rounds = r.publication.correction_rounds;
    lines.push(
      '- Operating time: ' + (minutes === null || minutes === undefined ? '—' : minutes) +
        ' min, correction rounds: ' + (rounds === null || rounds === undefined ? '—' : rounds)
    );
    lines.push('- Channel evidence: ' + (r.evidence.channel || '—'));
    lines.push('- PostHog: ' + (r.evidence.posthog || '—'));
    lines.push('- Supporting (Supabase, secondary only): ' + (r.evidence.supporting || '—'));
    var v = r.evidence.verdict || {};
    if (v.measurable) {
      lines.push('- **Result: ' + v.rate_label + '** — ' + v.caveat);
    } else {
      lines.push('- **Result: ' + v.state.replace(/_/g, ' ') + '** — ' + v.reason);
      lines.push('- Re-read when: ' + v.reread_when);
    }
    lines.push('- Decision: ' + (r.decision.decision || '—'));
    lines.push('- Next action: ' + (r.decision.next_action || '—') + ' (review ' + (r.decision.next_review_at || '—') + ')');
    if (r.gate.blockers.length) {
      lines.push('');
      lines.push('**Blockers standing at export:**');
      r.gate.blockers.forEach(function (b) {
        lines.push('- ' + b);
      });
    }
    if (r.incomplete_stages.length) {
      lines.push('');
      lines.push('**Incomplete stages:**');
      r.incomplete_stages.forEach(function (row) {
        lines.push('- ' + row.stage + ': ' + row.missing.join(', '));
      });
    }
    return lines.join('\n') + '\n';
  }

  return {
    D7_HOURS: D7_HOURS,
    MIN_N_FOR_A_RATE: MIN_N_FOR_A_RATE,
    STAGES: STAGES,
    REQUIRED: REQUIRED,
    missingFields: missingFields,
    sanitizeCampaignToken: sanitizeCampaignToken,
    validateCampaignId: validateCampaignId,
    publicationGate: publicationGate,
    rehearse: rehearse,
    evidenceVerdict: evidenceVerdict,
    handoffs: handoffs,
    buildRecord: buildRecord,
    toMarkdown: toMarkdown,
  };
});
