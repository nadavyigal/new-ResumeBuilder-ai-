
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesignPanel } from '@/components/ai-assistant/DesignPanel';
import { useDesignCustomization } from '@/hooks/useDesignCustomization';

// Mock the useDesignCustomization hook
jest.mock('@/hooks/useDesignCustomization', () => ({
  useDesignCustomization: jest.fn(),
}));

// Mock the toast function
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DesignPanel', () => {
  const mockApplyCustomization = jest.fn();

  beforeEach(() => {
    (useDesignCustomization as jest.Mock).mockReturnValue({
      currentDesign: { template: { name: 'Modern' } },
      applyCustomization: mockApplyCustomization,
      loading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  it('renders current template', () => {
    render(<DesignPanel optimizationId="1" />);
    expect(screen.getByText('Current Template: Modern')).toBeInTheDocument();
  });

  it('suggestion button click populates input', () => {
    render(<DesignPanel optimizationId="1" />);
    fireEvent.click(screen.getByText('Change header color to dark blue'));
    expect(screen.getByRole('textbox')).toHaveValue('Change header color to dark blue');
  });

  it('apply button click calls applyCustomization', async () => {
    mockApplyCustomization.mockResolvedValue({ success: true });
    render(<DesignPanel optimizationId="1" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test customization' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(mockApplyCustomization).toHaveBeenCalledWith('Test customization');
  });

  it('loading state disables input', () => {
    (useDesignCustomization as jest.Mock).mockReturnValue({
      currentDesign: { template: { name: 'Modern' } },
      applyCustomization: mockApplyCustomization,
      loading: true,
      error: null,
    });
    render(<DesignPanel optimizationId="1" />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('Apply')).toBeDisabled();
  });

  it('success toast appears on success', async () => {
    mockApplyCustomization.mockResolvedValue({ success: true });
    render(<DesignPanel optimizationId="1" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Apply'));
    await screen.findByText('Apply'); // Wait for state update
    expect(toast.success).toHaveBeenCalledWith('Design updated successfully!');
  });

  it('error toast appears on error', async () => {
    mockApplyCustomization.mockRejectedValue(new Error('Test error'));
    render(<DesignPanel optimizationId="1" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Apply'));
    await screen.findByText('Apply'); // Wait for state update
    expect(toast.error).toHaveBeenCalledWith('Test error');
  });
});
