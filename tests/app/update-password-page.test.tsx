import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const getSession = jest.fn<() => Promise<{ data: { session: unknown } }>>();
const exchangeCodeForSession = jest.fn<(code: string) => Promise<{ error: unknown }>>();
const verifyOtp = jest.fn<(args: unknown) => Promise<{ error: unknown }>>();
const updateUser = jest.fn<(args: unknown) => Promise<{ error: unknown }>>();
const signOut = jest.fn<() => Promise<{ error: null }>>();
const setSession = jest.fn<(args: unknown) => Promise<{ error: unknown }>>();

function t() {
  return (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
}

jest.mock('next-intl', () => ({
  __esModule: true,
  useTranslations: () => t(),
}));

jest.mock('@/navigation', () => ({
  __esModule: true,
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  createClientComponentClient: () => ({
    auth: { getSession, exchangeCodeForSession, verifyOtp, updateUser, signOut, setSession },
  }),
}));

function changeValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('UpdatePasswordPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/auth/update-password');
    getSession.mockResolvedValue({ data: { session: null } });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    setSession.mockResolvedValue({ error: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render() {
    // Loaded after the mocks above, as in auth-form-session-handoff.test.tsx.
    const { default: UpdatePasswordPage } = require('@/app/[locale]/auth/update-password/page');
    await act(async () => {
      root.render(<UpdatePasswordPage />);
    });
    await flush();
  }

  function submit(password: string, confirm: string) {
    const [first, second] = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    act(() => {
      changeValue(first, password);
      changeValue(second, confirm);
    });
    const form = container.querySelector('form') as HTMLFormElement;
    return act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }

  it('shows the form when the reset link already signed the user in', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await render();

    expect(container.querySelector('form')).not.toBeNull();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('exchanges a PKCE code when the client did not do it on start', async () => {
    window.history.replaceState({}, '', '/auth/update-password?code=abc');
    await render();

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(container.querySelector('form')).not.toBeNull();
  });

  it('verifies a token_hash recovery link', async () => {
    window.history.replaceState({}, '', '/auth/update-password?token_hash=th1&type=recovery');
    await render();

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'th1' });
    expect(container.querySelector('form')).not.toBeNull();
  });

  it('sets the session from implicit-flow hash tokens', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/update-password#access_token=at1&refresh_token=rt1&type=recovery'
    );
    await render();

    expect(setSession).toHaveBeenCalledWith({ access_token: 'at1', refresh_token: 'rt1' });
    expect(container.querySelector('form')).not.toBeNull();
  });

  it('offers a new link when there is no recovery session', async () => {
    await render();

    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).toContain('invalidLink');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/auth/reset-password');
  });

  it('treats an expired link as invalid without calling Supabase', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/update-password#error=access_denied&error_description=Email+link+is+invalid+or+has+expired'
    );
    await render();

    expect(container.textContent).toContain('invalidLink');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('rejects mismatched and short passwords before calling Supabase', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await render();

    await submit('abcdef12', 'abcdef13');
    expect(container.textContent).toContain('mismatch');

    await submit('abc', 'abc');
    expect(container.textContent).toContain('tooShort:{"min":6}');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates the password, signs out, and points to sign in', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await render();

    await submit('New-Pass-1234!', 'New-Pass-1234!');
    await flush();

    expect(updateUser).toHaveBeenCalledWith({ password: 'New-Pass-1234!' });
    expect(signOut).toHaveBeenCalled();
    expect(container.textContent).toContain('success');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/auth/signin');
  });

  it('shows the Supabase error when the update fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    updateUser.mockResolvedValue({ error: new Error('Password is too weak') });
    await render();

    await submit('New-Pass-1234!', 'New-Pass-1234!');
    await flush();

    expect(container.textContent).toContain('Password is too weak');
    expect(signOut).not.toHaveBeenCalled();
  });
});
