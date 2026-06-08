// supabase/functions/ambassador-reward/index.ts
// Plan 4: Ambassador Flow — grant 1 free export credit on "Got Hired"
//
// GATED: Skeleton only. Complete implementation when gate opens:
//   1. Plan 3 (StoreKit paywall) is live so credits have real value
//   2. First export cohort is 3+ weeks old
//
// Architecture:
//   POST { userID, exportID }  (authenticated)
//   → Verifies export belongs to the calling user
//   → Verifies ambassador_status = 'yes_hired' (prevents double-grant)
//   → Grants 1 export credit via user_credits upsert
//   → Marks ambassador_rewarded_at on the ambassador_notifications record
//   → Returns { success: true, creditsGranted: 1 }
//
// Idempotency: ambassador_status check prevents double-grant.
// If ambassador_status is already 'yes_hired' and reward was already granted,
// return success without modifying credits.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // TODO: Implement when gate opens.
  // Steps:
  // 1. Parse { userID, exportID } from request body
  // 2. Authenticate: verify JWT, confirm userID matches auth.uid()
  // 3. Fetch user_exports row where id = exportID AND user_id = userID
  //    → 404 if not found (security: prevent cross-user reward)
  // 4. Verify ambassador_status = 'yes_hired'
  //    → 400 if not hired (prevents non-hired users claiming reward)
  // 5. Check ambassador_notifications.triggered_at IS NOT NULL
  //    → Already rewarded: return { success: true, creditsGranted: 0, alreadyGranted: true }
  // 6. Upsert user_credits:
  //    INSERT INTO user_credits (user_id, export_credits)
  //    VALUES (userID, 1)
  //    ON CONFLICT (user_id) DO UPDATE SET export_credits = export_credits + 1
  // 7. Update ambassador_notifications SET triggered_at = now()
  // 8. Return { success: true, creditsGranted: 1 }

  return new Response(
    JSON.stringify({ error: 'Not implemented — gate condition not met (Plan 3 must be live)' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
});
