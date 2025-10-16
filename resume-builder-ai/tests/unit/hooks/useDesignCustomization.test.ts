
import { renderHook, act } from '@testing-library/react-hooks';
import { useDesignCustomization } from '@/hooks/useDesignCustomization';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useDesignCustomization', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('fetches the current design', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assignment: { id: 'design-123', template: { name: 'Modern' } } }),
    });

    const { result, waitFor } = renderHook(() => useDesignCustomization('opt-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.currentDesign).not.toBeNull());

    expect(result.current.currentDesign?.id).toBe('design-123');
  });

  it('applyCustomization calls API with correct params', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assignment: { id: 'design-123' } }),
    });
    const { result, waitFor } = renderHook(() => useDesignCustomization('opt-123'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.currentDesign).not.toBeNull());

    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
    });

    await act(async () => {
      await result.current.applyCustomization('make header blue');
    });

    expect(fetch).toHaveBeenCalledWith('/api/v1/design/opt-123/customize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: 'make header blue' }),
    });
  });

  it('updates design on success', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assignment: { id: 'design-123', template: { name: 'Modern' } } }),
    });
    const { result, waitFor } = renderHook(() => useDesignCustomization('opt-123'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.currentDesign).not.toBeNull());

    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, assignment: { id: 'design-456' } }),
    });

    await act(async () => {
      await result.current.applyCustomization('test');
    });

    // The hook should refetch, let's mock that too
    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assignment: { id: 'design-456' } }),
    });

    await waitFor(() => {
        expect(result.current.currentDesign?.id).toBe('design-456');
    });
  });

  it('handles loading state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ assignment: { id: 'design-123' } }),
    });
    const { result, waitFor } = renderHook(() => useDesignCustomization('opt-123'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ok: true, json: async () => ({success: true})}), 100)));

    let promise;
    act(() => {
      promise = result.current.applyCustomization('test');
    });

    expect(result.current.isCustomizing).toBe(true);
    await act(async () => {
        await promise;
    });
    expect(result.current.isCustomizing).toBe(false);
  });

  it('handles error state', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { result, waitFor } = renderHook(() => useDesignCustomization('opt-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Network error');
  });

  it('returns ATS warnings', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assignment: { id: 'design-123' } }),
    });
    const { result, waitFor } = renderHook(() => useDesignCustomization('opt-123'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.currentDesign).not.toBeNull());

    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ats_warning: 'Score dropped' }),
    });

    let response;
    await act(async () => {
      response = await result.current.applyCustomization('test');
    });

    expect(response.ats_warning).toBe('Score dropped');
  });
});
