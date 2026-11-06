import { describe, expect, it } from '@jest/globals';
import { IOS_APP_SIGN_IN_URL, isAppleMobileDevice } from '@/lib/ios-app-link';

describe('isAppleMobileDevice', () => {
  it('is true on iPhone and iPad', () => {
    expect(isAppleMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isAppleMobileDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true);
  });

  it('is true on iPadOS, which reports itself as a Mac with touch', () => {
    expect(isAppleMobileDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });

  it('is false on a Mac, Android, and Windows', () => {
    expect(isAppleMobileDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isAppleMobileDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false);
    expect(isAppleMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe(false);
  });

  it('opens the app sign-in screen', () => {
    expect(IOS_APP_SIGN_IN_URL).toBe('resumebuilder://signin');
  });
});
