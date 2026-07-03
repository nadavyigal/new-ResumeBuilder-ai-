import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const push = jest.fn();
const signUp = jest.fn();
let searchParams = new URLSearchParams();

const translations: Record<string, string> = {
  'auth.form.title.signup': 'Create your account',
  'auth.form.subtitle.signup': 'Save your ATS checks and continue with full optimization',
  'auth.form.labels.fullName': 'Full name',
  'auth.form.labels.email': 'Email',
  'auth.form.labels.password': 'Password',
  'auth.form.placeholders.fullName': 'Nadav Yigal',
  'auth.form.placeholders.email': 'you@example.com',
  'auth.form.buttons.createAccount': 'Create account',
  'auth.form.processing': 'Creating account',
  'auth.form.switchPrompt.hasAccount': 'Already have an account?',
  'auth.form.switchButtons.signIn': 'Sign in',
  'auth.form.errorGeneric': 'Something went wrong',
};

function t(namespace?: string) {
  return (key: string) => translations[namespace ? `${namespace}.${key}` : key] ?? key;
}

function changeValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
  });
}

jest.mock('next/navigation', () => ({
  __esModule: true,
  useSearchParams: () => searchParams,
}));

jest.mock('next-intl', () => ({
  __esModule: true,
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => t(namespace),
}));

jest.mock('@/navigation', () => ({
  __esModule: true,
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  posthog: {
    alias: jest.fn(),
    capture: jest.fn(),
    identify: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  createClientComponentClient: () => ({
    auth: { signUp },
  }),
}));

describe('AuthForm anonymous ATS session handoff', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    push.mockClear();
    signUp.mockReset();
    searchParams = new URLSearchParams('session_id=session-1&next=/dashboard');
    window.localStorage.clear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => '',
    } as Response)) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.restoreAllMocks();
  });

  it('passes the anonymous session through email callback and converts it for immediate signups', async () => {
    (signUp as any).mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'nadav@example.com',
          created_at: '2026-07-03T09:00:00.000Z',
          email_confirmed_at: '2026-07-03T09:00:00.000Z',
        },
        session: {
          access_token: 'access-token-1',
        },
      },
      error: null,
    });

    const { AuthForm } = require('@/components/auth/auth-form');
    await act(async () => {
      root.render(<AuthForm mode="signup" />);
    });

    await act(async () => {
      changeValue(container.querySelector('#fullName') as HTMLInputElement, 'Nadav Yigal');
      changeValue(container.querySelector('#email') as HTMLInputElement, 'nadav@example.com');
      changeValue(container.querySelector('#password') as HTMLInputElement, 'password123');
    });

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
      }));
    });
    await flushReact();

    const signUpArgs = (signUp as any).mock.calls[0][0];
    expect(signUpArgs.options.emailRedirectTo).toContain('/auth/callback?');
    expect(signUpArgs.options.emailRedirectTo).toContain('session_id=session-1');
    expect(signUpArgs.options.emailRedirectTo).toContain('next=%2Fdashboard');
    expect(window.localStorage.getItem('ats_session_id')).toBe('session-1');
    expect(global.fetch).toHaveBeenCalledWith('/api/public/convert-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token-1',
      },
      body: JSON.stringify({ sessionId: 'session-1' }),
    });
    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});
