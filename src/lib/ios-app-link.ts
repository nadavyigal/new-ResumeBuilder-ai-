/** Opens the Resumely iOS app on its sign-in screen (URL scheme registered from iOS 1.6.1). */
export const IOS_APP_SIGN_IN_URL = "resumebuilder://signin";

/** iPhone, iPod, or iPad. iPadOS reports itself as a Mac, so a Mac with touch counts too. */
export function isAppleMobileDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}
