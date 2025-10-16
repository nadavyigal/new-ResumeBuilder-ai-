
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from '@/components/ai-assistant/ChatPanel';
import { useChatSession } from '@/hooks/useChatSession';

// Mock the useChatSession hook
jest.mock('@/hooks/useChatSession', () => ({
  useChatSession: jest.fn(),
}));

// Mock the toast function
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('ChatPanel', () => {
  const mockSendMessage = jest.fn();

  beforeEach(() => {
    (useChatSession as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      loading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  it('renders empty state', () => {
    render(<ChatPanel optimizationId="1" />); 
    expect(screen.getByText('Make my second bullet point more impactful')).toBeInTheDocument();
  });

  it('renders with messages', () => {
    (useChatSession as jest.Mock).mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there!' },
      ],
      sendMessage: mockSendMessage,
      loading: false,
      error: null,
    });
    render(<ChatPanel optimizationId="1" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('send button click calls sendMessage', () => {
    render(<ChatPanel optimizationId="1" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test message' } });
    fireEvent.click(screen.getByText('Send'));
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('Enter key press calls sendMessage', () => {
    render(<ChatPanel optimizationId="1" />);
    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'Test message' } });
    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' });
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('Shift+Enter inserts a newline', () => {
    render(<ChatPanel optimizationId="1" />);
    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'First line' } });
    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(textbox).toHaveValue('First line\n');
  });

  it('loading state disables input', () => {
    (useChatSession as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      loading: true,
      error: null,
    });
    render(<ChatPanel optimizationId="1" />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('Send')).toBeDisabled();
  });

  it('error state displays toast', () => {
    import { toast } from 'sonner';
    (useChatSession as jest.Mock).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        loading: false,
        error: new Error('Test error'),
    });
    render(<ChatPanel optimizationId="1" />);
    // We need to trigger a re-render for the error to be picked up by the effect
    // A better approach would be to have the error in the initial state
    expect(mockToast.error).toHaveBeenCalledWith('Test error');
  });
});
