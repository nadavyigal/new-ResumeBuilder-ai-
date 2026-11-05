import { describe, expect, it } from '@jest/globals';
import { redirectsSignedInUserFromAuthPage } from '@/lib/auth-route-policy';

describe('redirectsSignedInUserFromAuthPage', () => {
  it('keeps a signed-in user on the update-password page', () => {
    expect(redirectsSignedInUserFromAuthPage('/auth/update-password')).toBe(false);
  });

  it('still sends a signed-in user away from sign-in, sign-up and reset', () => {
    expect(redirectsSignedInUserFromAuthPage('/auth/signin')).toBe(true);
    expect(redirectsSignedInUserFromAuthPage('/auth/signup')).toBe(true);
    expect(redirectsSignedInUserFromAuthPage('/auth/reset-password')).toBe(true);
  });

  it('does not match a look-alike path', () => {
    expect(redirectsSignedInUserFromAuthPage('/auth/update-password-other')).toBe(true);
  });

  it('ignores non-auth pages', () => {
    expect(redirectsSignedInUserFromAuthPage('/dashboard')).toBe(false);
  });
});
