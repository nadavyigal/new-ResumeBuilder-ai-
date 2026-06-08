# Resumely Plan 4: Ambassador Flow — "I Got Hired"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the in-app "Did you land the interview?" ambassador flow: trigger 2–3 weeks after a user's last export, show a success screen, prompt LinkedIn share (pre-drafted post with score data) and App Store review, and grant a free export credit reward.

**Architecture:**
- Trigger: scheduled local notification (iOS `UNUserNotificationCenter`) set when an export completes
- In-app banner: shown on next app open if the notification window has passed and no hired response yet
- Success screen: SwiftUI sheet with "Share on LinkedIn" + "Leave a review" CTAs
- LinkedIn share: iOS `UIActivityViewController` with pre-drafted text and App Store link
- Review prompt: `SKStoreReviewController.requestReview()` (iOS native)
- Credit reward: Supabase edge function call to grant 1 free export credit
- State: `ambassador_status` column on `user_exports` table (pending / yes_hired / not_yet / dismissed)

**Tech Stack:** SwiftUI, UNUserNotificationCenter, UIActivityViewController, StoreKit (review prompt), Supabase Swift client

**Status gate:** GATED — do not start until:
1. Plan 3 (StoreKit Paywall) is live — the credit reward is only meaningful once there's a paywall
2. The first cohort has been using the app for at least 3 weeks (need real export data to trigger from)

**This plan is a skeleton.** Architecture and data model documented here. Full Swift code written when the gate opens.

---

## Supabase Schema Addition

```sql
-- Add ambassador state to exports
alter table user_exports
  add column if not exists ambassador_status text
    check (ambassador_status in ('pending', 'yes_hired', 'not_yet', 'dismissed'))
    default 'pending',
  add column if not exists ambassador_notified_at timestamptz,
  add column if not exists ambassador_responded_at timestamptz;

-- Track notification scheduling
create table if not exists ambassador_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  export_id uuid references user_exports(id) not null,
  scheduled_for timestamptz not null,
  triggered_at timestamptz,
  response text check (response in ('yes_hired', 'not_yet', 'dismissed'))
);
```

---

## File Structure (iOS App)

| File | Action | Contents |
|---|---|---|
| `ResumelyApp/Ambassador/AmbassadorManager.swift` | Create | Trigger logic, notification scheduling, state management |
| `ResumelyApp/Ambassador/AmbassadorBanner.swift` | Create | In-app banner shown at top of home screen |
| `ResumelyApp/Ambassador/AmbassadorSuccessView.swift` | Create | Full success screen with two CTAs |
| `ResumelyApp/Ambassador/LinkedInShareComposer.swift` | Create | Builds pre-drafted post text with user's ATS score data |
| `supabase/functions/ambassador-reward/index.ts` | Create | Edge function: grants 1 free export credit on "got hired" |

---

### Task 1: Ambassador Manager

**Files:**
- Create: `ResumelyApp/Ambassador/AmbassadorManager.swift`

> **Placeholder — complete with full Swift code when gate opens.**

The AmbassadorManager should:
- Be called from the export success handler with `(userID, exportID, atsScoreBefore, atsScoreAfter, jobTitle)`
- Schedule a local `UNUserNotificationCenter` notification 18 days after export
- Notification copy: "Did you land the interview? 🎯"
- On notification tap: navigate to the success screen
- On app open: check if any pending ambassador notification is past due — show in-app banner
- Expose `markHired(exportID:)`, `markNotYet(exportID:)`, `markDismissed(exportID:)` methods that update Supabase

---

### Task 2: Ambassador Banner

**Files:**
- Create: `ResumelyApp/Ambassador/AmbassadorBanner.swift`

> **Placeholder — complete with full SwiftUI code when gate opens.**

The banner should:
- Appear at the top of the home screen (not a modal, so it's dismissible without full commitment)
- Show: "Did you land the interview? 🎯 [Yes!] [Not yet]"
- "Yes!" → opens `AmbassadorSuccessView`
- "Not yet" → dismisses banner, marks `not_yet`, no follow-up for 7 days

---

### Task 3: Success Screen

**Files:**
- Create: `ResumelyApp/Ambassador/AmbassadorSuccessView.swift`

> **Placeholder — complete with full SwiftUI code when gate opens.**

The success screen should:
- Show: "Congrats! 🎉 One step closer to the job."
- Primary CTA (filled button): "Share on LinkedIn" → calls `LinkedInShareComposer`
- Secondary CTA (outlined button): "Leave a review" → `SKStoreReviewController.requestReview()`
- Below both CTAs: "Here's a free export for your next application" — triggers credit grant
- Dismiss: X button top right
- Mark `yes_hired` in Supabase when the screen is shown

---

### Task 4: LinkedIn Share Composer

**Files:**
- Create: `ResumelyApp/Ambassador/LinkedInShareComposer.swift`

> **Placeholder — complete with full Swift code when gate opens.**

The composer should:
- Accept `(atsScoreBefore: Int, atsScoreAfter: Int, jobTitle: String?, locale: String)`
- Return a `UIActivityViewController` with pre-drafted text
- English template (from spec Section 5):

```
Excited to share that I just landed an interview at [Company] 🎉

Used Resumely to tailor my resume to the job description — ATS score jumped
from [atsScoreBefore] → [atsScoreAfter]. The optimisation took 5 minutes on my phone.

If you're job hunting, give it a try 👇
[App Store link]

#JobSearch #Resume #CareerTips
```

- Hebrew template (from spec Section 5):

```
שמח לשתף שנקראתי לראיון ב-[חברה] 🎉

השתמשתי ב-Resumely כדי להתאים את קורות החיים שלי למשרה —
הציון ATS קפץ מ-[atsScoreBefore] ל-[atsScoreAfter]. לקח 5 דקות בנייד.

למי שמחפש עבודה, שווה לנסות 👇
[App Store link]

#חיפוש_עבודה #קורות_חיים
```

- Locale detected from device locale or user preference
- ATS scores substituted from actual data stored at export time
- User can edit the text before sharing (standard UIActivityViewController behaviour)

---

### Task 5: Ambassador Reward Edge Function

**Files:**
- Create: `supabase/functions/ambassador-reward/index.ts`

> **Placeholder — complete with full TypeScript code when gate opens.**

The edge function should:
- Accept `{ userID, exportID }` POST body with auth header
- Verify the export belongs to the calling user
- Verify `ambassador_status` is `yes_hired` (prevent double-grant)
- Grant 1 export credit via `user_credits` upsert
- Mark `ambassador_rewarded_at` on the notification record
- Return `{ success: true, creditsGranted: 1 }`

---

## Self-Review

This plan is intentionally skeletal. The architecture (notification scheduling, UIActivityViewController, StoreKit review prompt, edge function credit grant) is confirmed. Full implementation deferred to gate.

Gate conditions (from spec Section 8):
- Plan 3 (paywall) live so credits have value
- First export cohort is 3+ weeks old (real trigger data exists)
