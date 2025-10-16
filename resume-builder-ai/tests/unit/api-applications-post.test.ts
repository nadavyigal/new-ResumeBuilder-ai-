
import { POST } from '@/app/api/applications/route';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createRouteHandlerClient: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({ body, init })),
  },
}));

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  lt: jest.fn(() => mockSupabase),
  maybeSingle: jest.fn(),
  single: jest.fn(),
};

describe('POST /api/applications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createRouteHandlerClient as jest.Mock).mockResolvedValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } } });
  });

  const mockRequest = (body: Record<string, unknown>, searchParams = '') => {
    return {
      json: async () => body,
      url: `http://localhost/api/applications${searchParams}`,
    } as unknown as NextRequest;
  };

  it('should create an application when no duplicate exists', async () => {
    const reqBody = {
      optimizationId: 'opt-123',
      jobTitle: 'Software Engineer',
      companyName: 'Acme Corp',
    };
    const req = mockRequest(reqBody);

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // No duplicate
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'opt-123', user_id: 'test-user-id' }, error: null }); // Optimization found
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'app-456', ...reqBody }, error: null }); // Application created

    await POST(req);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
      { status: 201 }
    );
  });

  it('should return 409 conflict when a duplicate is detected', async () => {
    const reqBody = {
      optimizationId: 'opt-123',
      jobTitle: 'Software Engineer',
      companyName: 'Acme Corp',
    };
    const req = mockRequest(reqBody);

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'existing-app-id' }, error: null }); // Duplicate found

    await POST(req);

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Duplicate detected',
        confirm_required: true,
        existing_application_id: 'existing-app-id',
      }),
      { status: 409 }
    );
  });

  it('should create an application when confirm=true is passed, even if duplicate exists', async () => {
    const reqBody = {
      optimizationId: 'opt-123',
      jobTitle: 'Software Engineer',
      companyName: 'Acme Corp',
    };
    const req = mockRequest(reqBody, '?confirm=true');

    // Duplicate check is skipped, so no mock for maybeSingle needed here.
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'opt-123', user_id: 'test-user-id' }, error: null }); // Optimization found
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'app-789', ...reqBody }, error: null }); // Application created

    await POST(req);

    expect(mockSupabase.from).toHaveBeenCalledWith('applications');
    expect(mockSupabase.insert).toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
      { status: 201 }
    );
  });

  it('should create a new application if a duplicate exists for a different day', async () => {
    const reqBody = {
        optimizationId: 'opt-123',
        jobTitle: 'Software Engineer',
        companyName: 'Acme Corp',
    };
    const req = mockRequest(reqBody);

    // Simulate that the duplicate check runs but finds nothing for today
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'opt-123', user_id: 'test-user-id' }, error: null });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'app-456', ...reqBody }, error: null });

    await POST(req);

    // The key check is that the insert function is called
    expect(mockSupabase.insert).toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
        { status: 201 }
    );
  });
});
