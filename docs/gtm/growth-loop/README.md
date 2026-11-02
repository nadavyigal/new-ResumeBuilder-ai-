# Growth loop — operating guide

One weekly cycle, one card, six stages. The card is
[`experiment-card.html`](./experiment-card.html): open it from disk, no server and no
build. Its gates live in [`loop-card.logic.js`](./loop-card.logic.js) and are covered by
`tests/unit/growth-loop/loop-card.logic.test.js`.

This guide is the connective tissue: which existing command produces each number, what
the card cannot know, and how to undo the code change that carries campaign identity.

## Why this exists at all

Four channel rankings, a GTM packet and a weekly checklist already exist in `docs/gtm/`.
None of them was the missing piece. The missing piece, named in the vault's
`Distribution` living page, is that **every plan terminated in a founder-only publish
action with no output path**, so nothing was published and nothing was measured. The
card is the output path: it forces the campaign identity and the pre-action baseline to
exist *before* the post goes out, and it refuses to turn an unattributable publication
into a number afterwards.

## The one thing to understand before using it

**A web arrival and an in-app activation are not joined, and this loop does not join
them.**

Resumely's governed activation funnel is iOS-only. `resume_file_selected`,
`optimization_started` and `optimization_completed` are emitted by the Swift client
(`$lib = resumely-ios-urlsession`); `resume_file_selected` does not exist anywhere in
this repository. A campaign link lands on the web, and the next hop is the App Store,
which does not forward query parameters into the installed app.

So a cycle produces two separate pieces of evidence:

| Evidence | What it can support | What it cannot support |
|---|---|---|
| Web arrivals + `campaign_store_handoff`, filtered by `campaign_id` | "This campaign moved N people to the store" | Anything about what they did in the app |
| The measurement contract's cohort read | "This build produced N external activations" | Attributing any of them to a campaign |

Closing that join needs Apple's attribution APIs or a deferred-deep-link vendor. Both are
out of scope. Until one exists, **say the gap out loud in the readout.** Do not present
an activation count next to a campaign id in a way that implies causation.

## Stage by stage, and the command behind each number

### 1. Frame
Campaign ID, channel, locale, positioning, the question, destination URL.

Campaign ID convention: `product-channel-yyyymmdd-slug`, lowercase ASCII with hyphens,
e.g. `rb-li-20260910-trusted-workspace`. The card rejects anything the App Store `ct`
token cannot carry, and tells you the usable spelling. Before marking tracking verified,
run the registry preflight below. The same campaign ID must appear as
`utm_campaign` in the destination URL — that is what makes the arrival attributable.

### 2. Prepare
The asset is an **existing** draft, referenced not rewritten. For cycle 1 the drafts are
in the vault at `02-Products/ResumeBuilder/2026-08-16-resumely-linkedin-posts.md`, and
the claim avoid-list they were checked against is the Resumely iOS repo's
`.agents/product-marketing.md`.

**The pre-action baseline is read before publishing, from the pinned command.** In the
Resumely iOS repo:

```bash
AGENTIC_OS_POSTHOG_API_KEY=… python3 scripts/measurement_contract.py
```

That command *is* the aggregate read. It is not reimplemented here and must not be:
it pins PostHog project 270848, `$lib = resumely-ios-urlsession`, the exact
`app_version` + `build_number` cohort, person-level internal-tester exclusion, the
168-hour D7 window, the n≥10 floor, and the pre-release integrity check that catches a
cohort with no public users. Paste its headline into the baseline field with the
timestamp of the read. Add `--write` only when you intend it to update `tasks/progress.md`.

Tracking status starts at `unverified`. Setting it to `verified` means you opened the
destination link yourself and saw the campaign id arrive. Nothing else counts.

### 3. Review and approve
Claim check, then the founder approval checkbox. Two rules the card enforces:

- Real publication is blocked without founder approval.
- **Founder approval cannot lift the unverified-tracking block.** Approval is permission
  to act; it is not evidence the action will be measurable. `rb-he-comm-001` and
  `rb-he-aso-001` were both approved, both published, and both are permanently
  unreadable, because no unique link existed at publish time.

### 4. Manual publication record
You publish, by hand, from the identity that owns the channel. The card records the
timestamp, the direct URL, operating time and correction rounds. It has no publishing
capability and no platform credentials, by design.

Rehearsal mode runs every stage, reports what *would* have blocked a real run, and
publishes nothing.

### 5. Evidence readout
Channel evidence is **replies, not impressions** — the standing rule for the first three
weeks. PostHog evidence is the verbatim output of the command above.

The card returns one of four states, and never a partial figure:

| State | When | What it prints |
|---|---|---|
| Not yet measurable | tracking unverified, no publish timestamp, or cohort younger than 168h | reason + the exact re-read condition |
| Not yet measurable | counts not yet read | reason + "run the command" |
| Counts only | denominator below n=10 | the counts, no rate |
| Measurable | n≥10 and 168h elapsed | the rate, plus the single-post caveat |

**One post cannot establish a positioning winner.** Cycle 1 validates execution and
attribution. A `trusted application workspace` vs `AI resume optimizer` comparison needs
its own cycle, with both arms carrying their own campaign ids.

Supabase is supporting evidence only. The primary read stays the governed PostHog
definition.

### 6. Decision
Continue, adjust, hold, or stop; one next action with an owner and a date; the next
review date. Then export.

Export the Markdown and append the four-line row to Agentic OS
`distribution-os/experiment-log.md`, which is the ledger this loop feeds. Do not create
a second ledger.

## Bounded handoffs

The card generates all four briefs from the same state, each with an explicit must-not
list. Summarised:

| Role | Owns | Must never |
|---|---|---|
| Marketing | Adapt the approved draft to the channel; copy only | Publish, schedule, or introduce a claim not in `.agents/product-marketing.md` |
| Grok (Growth & Communications desk) | Caption drafts and a pre-publish drift check | Post, schedule, own the calendar, or touch performance numbers |
| Codex | Local repo work named in stage 2, on a branch | Deploy, merge, publish, or change governed event meanings |
| Claude Code | Run the measurement command; paste output verbatim; write the record | Estimate a count, or quote a rate below n=10 |

The Grok desk carries a standing rule from its own page: no second job until one draft is
filed or explicitly rejected. Give it captions and drift checks, nothing else.

## The code change that carries campaign identity

Three files in `src/`, all additive:

| File | Change |
|---|---|
| `src/lib/campaign-context.ts` | New. Reads `utm_campaign` (or `campaign_id`) at arrival, sanitises it to one spelling, persists it, and builds the App Store URL with that value as Apple's `ct` token. |
| `src/components/landing/AppStoreCta.tsx` | New. Client CTA that uses the campaign-aware URL and emits `campaign_store_handoff` on click. |
| `src/app/[locale]/ats-checker/page.tsx` | The hard-coded App Store anchor becomes `<AppStoreCta>`. |
| `src/components/providers/posthog-provider.tsx` | Registers `campaign_id` as a super property alongside the UTM set that was already registered. |

`campaign_store_handoff` is a **new, web-only event name**. No governed event is read,
written, renamed, or given a new meaning. The iOS contract read is unaffected — it
filters on `$lib = resumely-ios-urlsession`, which no web event carries.

### Attribution setup and publication preflight

The provider token is the public `pt` value from a campaign link generated for
this app in App Store Connect; verify it against that account, never guess it.
`NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` must be present in the target environment
**before a fresh build**. Next.js embeds `NEXT_PUBLIC_` values in the browser
bundle ([official guidance](https://nextjs.org/docs/app/guides/environment-variables)).
Changing a setting does not change an existing deployment. Build, then deploy
only with separate founder approval. This also applies to the public PostHog key
and host. No production token, analytics configuration or attribution is verified
by a passing local test.

Apple limits `ct` to 30 characters ([campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links)).
IDs up to 30 characters stay intact. Longer canonical IDs (up to 64) use the first
21 characters (without a trailing hyphen), a hyphen and an eight-hex FNV-1a suffix
computed over the entire canonical ID. Full `campaign_id` stays in the web event;
`store_campaign_token` equals the URL's `ct`. Do not match long IDs by eye alone.

A finite hash cannot guarantee uniqueness. Before **every publication**, collect
all historical, active and proposed campaign IDs in a JSON array, then run:

```bash
npx --no-install tsx scripts/check-store-campaigns.ts /absolute/path/complete-registry.json
```

This offline command rejects empty/incomplete spellings, IDs over 64 characters,
noncanonical IDs (including punctuation/case/whitespace rewrites), the reserved
organic token `web-ats`, duplicate IDs and any derived token collision, including
a short ID equal to a hashed token. A passing subset is not a complete registry
check. Do not mark the card's tracking status `verified` until the complete list
passes, its printed ID/token mapping is saved in the card's tracking note, and
URL/event equality is observed in the target deployment. On conflict choose a
new canonical ID and rerun the entire list. No complete production registry has
been checked in this repair. The experiment card is a manual publication record;
it does not run this command or publish anything itself.

### Rollback and long-ID compatibility decision

With the provider configured, the URL is
`…id6776752349?pt=<token>&ct=<mapped-token>&mt=8`. Without it, the URL uses
`?ct=<mapped-token>&at=organic`; this is not verified Apple campaign attribution.
The exact old organic URL (`?ct=web-ats&at=organic`) is preserved when no campaign
is present, as asserted by `ROLLBACK` in the unit test.

**Intentional migration:** long-ID tokens use the new bounded mapping on both
paths, including when the provider is absent. We do not restore the former
64-character fallback. Removing the provider disables the configured attribution
format; it does not restore old long-ID token names or repair historical rows.
Record old/new mappings separately if a campaign was already published; live
campaign history has not been checked. Short canonical IDs remain unchanged.

To disable the configured provider: remove/unset it in the target environment,
make a **fresh build**, then perform a separately approved deployment. Inspect
both organic and campaign CTAs and compare `ct` with the handoff event afterward.
Unsetting alone, restarting a server or promoting the same built artifact leaves
the embedded value unchanged. An approved rollback to a known earlier deployment
can restore that deployment's embedded configuration; check its source and public
values first. Full source reverts likewise require a new build and approved deploy.

To revert entirely:

```bash
git revert <commit>
```

or, by hand: restore the `APP_STORE_URL` constant and inline `<a>` in
`src/app/[locale]/ats-checker/page.tsx`, drop the `resolveCampaign` block in
`src/components/providers/posthog-provider.tsx`, and delete
`src/lib/campaign-context.ts` and `src/components/landing/AppStoreCta.tsx`. Nothing else
imports them. No migration, no stored data to clean up beyond one `localStorage` key
(`resumely_campaign_context`) that becomes inert.

## Tests

```bash
npx jest tests/unit/growth-loop tests/unit/campaign-context.test.ts
```

Covers only what can produce a wrong decision: the approval gate, the
unverified-tracking block that approval cannot lift, the missing-data path, campaign
propagation, and the rollback equality.
