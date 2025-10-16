import { useState, useEffect, useRef } from "react";
import { X, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatPanel } from "./ChatPanel";
import { DesignPanel } from "./DesignPanel";

/**
 * AIAssistantSidebar Component
 *
 * A unified AI assistant interface for resume content editing and visual design customization.
 * Provides tabbed access to chat-based content editing and design modification features.
 *
 * @component
 * @example
 * ```tsx
 * <AIAssistantSidebar
 *   optimizationId="uuid-123"
 *   onClose={() => setSidebarOpen(false)}
 * />
 * ```
 *
 * Features:
 * - Fixed positioning on right side of screen
 * - Responsive: full screen on mobile (<768px), 384px width on desktop
 * - Two tabs: Content Editing (chat) and Visual Design
 * - Integrates with existing Features 002 (Chat) and 003 (Design)
 */

export interface AIAssistantSidebarProps {
  /** The optimization ID to work with */
  optimizationId: string;
  /** Callback when sidebar is closed */
  onClose: () => void;
}

export function AIAssistantSidebar({
  optimizationId,
  onClose,
}: AIAssistantSidebarProps) {
  const [activeTab, setActiveTab] = useState<"content" | "design">("content");
  const sidebarRef = useRef<HTMLDivElement>(null);

  // T030: Support Esc key to close sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // T030: Trap focus inside sidebar when open
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const focusableElements = sidebar.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) { // If Shift + Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else { // If Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    sidebar.addEventListener('keydown', handleTabKeyPress);
    firstElement?.focus(); // Focus on the first element when sidebar opens

    return () => {
      sidebar.removeEventListener('keydown', handleTabKeyPress);
    };
  }, [activeTab]); // Re-trap focus when tab changes

  return (
    <div
      ref={sidebarRef}
      className="fixed right-0 top-0 z-50 h-screen w-full transform bg-white shadow-2xl transition-transform duration-300 ease-in-out md:w-96"
      role="dialog"
      aria-label="AI Resume Assistant"
      aria-modal="true"
      tabIndex={-1} // Make the div focusable
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              AI Resume Assistant
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-5 w-5 text-gray-400 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <h4 className="font-bold mb-2">AI Assistant Help</h4>
                  <p className="font-bold">Content Editing:</p>
                  <ul className="list-disc list-inside mb-2">
                    <li>Make my second bullet point more impactful</li>
                    <li>Add project management keywords to my experience</li>
                  </ul>
                  <p className="font-bold">Visual Design:</p>
                  <ul className="list-disc list-inside mb-2">
                    <li>Change header color to navy blue</li>
                    <li>Use Roboto font for headings</li>
                  </ul>
                  <p className="font-bold">Troubleshooting:</p>
                  <p>If the AI doesn't respond, try rephrasing your request.</p>
                  <a href="/docs/ai-assistant" className="underline text-blue-600">Full Documentation</a>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close AI Assistant"
          className="h-8 w-8 min-h-[44px] min-w-[44px]"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "content" | "design")}
        className="flex h-[calc(100vh-57px)] flex-col"
      >
        <TabsList className="w-full justify-start rounded-none border-b border-gray-200 bg-transparent px-4">
          <TabsTrigger
            value="content"
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent min-h-[44px] min-w-[44px]"
          >
            Content Editing
          </TabsTrigger>
          <TabsTrigger
            value="design"
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent min-h-[44px] min-w-[44px]"
          >
            Visual Design
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="content"
          className="flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <ChatPanel optimizationId={optimizationId} />
        </TabsContent>

        <TabsContent
          value="design"
          className="flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <DesignPanel optimizationId={optimizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
