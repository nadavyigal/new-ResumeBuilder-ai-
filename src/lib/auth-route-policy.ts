/**
 * Auth pages a signed-in user still needs. A password reset link signs the
 * user in with a recovery session before they choose the new password, so
 * that page must not bounce them to the dashboard.
 */
const SIGNED_IN_AUTH_PAGES = ["/auth/update-password"];

/** True when middleware should send a signed-in user from this auth page to the dashboard. */
export function redirectsSignedInUserFromAuthPage(pathname: string): boolean {
  if (!pathname.startsWith("/auth/")) return false;
  return !SIGNED_IN_AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`)
  );
}
