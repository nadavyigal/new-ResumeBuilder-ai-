/**
 * Auth pages a signed-in user still needs. A password reset link goes through
 * `/auth/confirm` (verifies the link, even if the browser is already signed in)
 * and then signs the user in before they choose the new password, so neither
 * may bounce them to the dashboard.
 */
const SIGNED_IN_AUTH_PAGES = ["/auth/update-password", "/auth/confirm"];

/** True when middleware should send a signed-in user from this auth page to the dashboard. */
export function redirectsSignedInUserFromAuthPage(pathname: string): boolean {
  if (!pathname.startsWith("/auth/")) return false;
  return !SIGNED_IN_AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`)
  );
}
