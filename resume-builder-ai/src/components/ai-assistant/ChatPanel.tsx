import { useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useChatSession } from "@/hooks/useChatSession";

/**
 * ChatPanel Component
 *
 * Conversational interface for iterative resume content editing using AI.
 * Integrates with Feature 002 (Chat) existing API infrastructure.
 *
 * @component
 * @example
 * ```tsx
 * <ChatPanel optimizationId="uuid-123" />
 * ```
 *
 * Features:
 * - Message history display with user/AI message bubbles
 * - Real-time message sending with loading states
 * - Empty state with example prompts
 * - Error handling with toast notifications
 * - Enter to send (Shift+Enter for new line)
 * - Automatic scroll to latest message
 *
 * API Integration:
 * - POST /api/v1/chat - Send messages and receive AI responses (via useChatSession hook)
 */

export interface ChatPanelProps {
  /** The optimization ID to chat about */
  optimizationId: string;
}

const EXAMPLE_PROMPTS = [
  "Make my second bullet point more impactful",
  "Add project management keywords to my experience",
  "Rewrite my summary to highlight leadership skills",
  "Improve the action verbs in my latest role",
];

const MessageSkeleton = () => (
  <div className="flex animate-pulse space-x-3">
    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
    <div className="flex-1 space-y-2 py-1">
      <div className="h-4 w-3/4 rounded bg-gray-200"></div>
      <div className="h-4 w-1/2 rounded bg-gray-200"></div>
    </div>
  </div>
);

const TypingIndicator = () => (
    <div className="flex justify-start">
        <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-2 text-gray-900">
            <div className="flex items-center space-x-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400 [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400 [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400"></span>
            </div>
        </div>
    </div>
);

export function ChatPanel({ optimizationId }: ChatPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputValueRef = useRef<string>("");
  const { toast } = useToast();

  // Use the useChatSession hook for API integration
  const {
    messages,
    sendMessage,
    isLoading,
    isSending,
    error,
  } = useChatSession({
    optimizationId,
    onSuccess: (data) => {
      // Show success toast
      toast({
        title: "Message sent",
        description: data.requires_clarification
          ? "AI needs more information"
          : "AI is processing your request",
      });
    },
onError: (error) => {
      // Show error toast
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: <span>{error.message || "Please check your internet connection and try again."} <a href="/support?error=chat_send" className="underline">Report Issue</a></span>,
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isSending]);

  const handleSendMessage = async () => {
    const trimmedMessage = inputValueRef.current.trim();
    if (!trimmedMessage || isSending) return;

    try {
      // Clear input immediately
      inputValueRef.current = "";
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }

      // Send message via hook
      await sendMessage(trimmedMessage);

      // Focus back on textarea
      textareaRef.current?.focus();
    } catch (error) {
      // Error is already handled by onError callback
      console.error("Error sending message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    inputValueRef.current = e.target.value;
  };

  const handleExampleClick = (prompt: string) => {
    inputValueRef.current = prompt;
    if (textareaRef.current) {
      textareaRef.current.value = prompt;
    }
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Message History */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-4">
        {/* T031: Skip link for accessibility */}
        <a href="#chat-input" className="sr-only focus:not-sr-only">Skip to chat input</a>

        {isLoading ? (
          <div className="space-y-4">
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        ) : messages.length === 0 ? (
          /* Empty State */
          <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">
                Start a conversation
              </h3>
              <p className="text-sm text-gray-500">
                Ask me to improve any part of your resume. Try one of these:
              </p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2">
              {EXAMPLE_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(prompt)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="space-y-4" role="log" aria-live="polite"> {/* T031: ARIA live region and role="log" */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.sender === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  } text-base`} // T025: Increased font size
                >
                  <p className="whitespace-pre-wrap text-base"> // T025: Increased font size
                    {message.content}
                  </p>
                  <span
                    className={`mt-1 block text-xs ${
                      message.sender === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            {isSending && <TypingIndicator />}
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4 pb-[env(safe-area-inset-bottom)]"> {/* T025: Add safe area padding */}
        <div className="flex flex-col sm:flex-row gap-2"> {/* T025: Stack vertically on mobile */}
          <Textarea
            ref={textareaRef}
            defaultValue=""
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="min-h-[80px] resize-none text-base" // T025: Increased font size
            disabled={isSending}
            aria-label="Type your message here"
            id="chat-input" // T031: Add ID for skip link
          />
          <Button
            onClick={handleSendMessage}
            disabled={isSending}
            size="icon"
            className="h-12 sm:h-[80px] w-full sm:w-12 shrink-0" // T025: Adjust button width
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
