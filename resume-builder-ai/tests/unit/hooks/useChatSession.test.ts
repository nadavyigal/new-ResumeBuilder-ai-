
import { renderHook, act } from '@testing-library/react-hooks';
import { useChatSession } from '@/hooks/useChatSession';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useChatSession', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('fetches an existing session', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { id: 'session-123' }, messages: [{ id: '1', content: 'Hi' }] }),
    });

    const { result, waitFor } = renderHook(() => useChatSession('opt-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.session).not.toBeNull());

    expect(result.current.session?.id).toBe('session-123');
    expect(result.current.messages[0].content).toBe('Hi');
  });

  it('creates a new session if none exists', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 404 }) // First GET fails
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ session: { id: 'new-session' }, messages: [] }) // POST succeeds
      });

    const { result, waitFor } = renderHook(() => useChatSession('opt-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.session).not.toBeNull());

    expect(result.current.session?.id).toBe('new-session');
    expect(fetch).toHaveBeenCalledWith('/api/v1/chat/sessions', expect.any(Object)); // POST
  });

  it('sendMessage calls API with correct params', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ session: { id: 'session-123' }, messages: [] }),
    });

    const { result, waitFor } = renderHook(() => useChatSession('opt-123'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.session).not.toBeNull());

    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{id: '2', content: 'Response'}] }),
    });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(fetch).toHaveBeenCalledWith('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-123', message: 'Test message' }),
    });
  });

  it('updates messages on response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { id: 'session-123' }, messages: [] }),
    });

    const { result, waitFor } = renderHook(() => useChatSession('opt-123'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.session).not.toBeNull());
    
    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{id: '1', role: 'user', content: 'Test message'}, {id: '2', role: 'assistant', content: 'AI Response'}] }),
    });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.messages.length).toBe(2);
    expect(result.current.messages[1].content).toBe('AI Response');
  });

  it('handles loading state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ session: { id: 'session-123' }, messages: [] }),
    });

    const { result, waitFor } = renderHook(() => useChatSession('opt-123'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ok: true, json: async () => ({messages: []})}), 100)));

    let promise;
    act(() => {
      promise = result.current.sendMessage('test');
    });

    expect(result.current.isSending).toBe(true);
    await act(async () => {
        await promise;
    });
    expect(result.current.isSending).toBe(false);
  });

  it('handles error state', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result, waitFor } = renderHook(() => useChatSession('opt-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Network error');
  });
});
