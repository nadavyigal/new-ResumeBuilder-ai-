import { useState, useEffect } from "react";
import { Loader2, Sparkles, Palette, AlertTriangle, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useDesignCustomization } from "@/hooks/useDesignCustomization";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * DesignPanel Component
 *
 * Natural language interface for AI-powered resume design customization.
 * Integrates with Feature 003 (Design) existing API infrastructure.
 *
 * @component
 * @example
 * ```tsx
 * <DesignPanel optimizationId="uuid-123" />
 * ```
 *
 * Features:
 * - Current template display card
 * - Natural language input for design requests
 * - Suggestion buttons for common customizations
 * - Apply button with loading state
 * - Success/error toast notifications
 * - ATS safety warnings
 *
 * API Integration:
 * - GET /api/v1/design/:optimizationId - Fetch current design assignment (via useDesignCustomization hook)
 * - POST /api/v1/design/:optimizationId/customize - Apply customization (via useDesignCustomization hook)
 */

export interface DesignPanelProps {
  /** The optimization ID to customize design for */
  optimizationId: string;
}

const SUGGESTION_PROMPTS = [
  "Change header color to dark blue",
  "Use Roboto font for headings",
  "Switch to two-column layout",
  "Make the design more modern and minimal",
  "Increase spacing between sections",
];

export function DesignPanel({ optimizationId }: DesignPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [showErrorShake, setShowErrorShake] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const { toast } = useToast();

  // Use the useDesignCustomization hook for API integration
  const {
    currentDesign,
    applyCustomization,
    isLoading,
    isCustomizing,
    error,
  } = useDesignCustomization({
    optimizationId,
    onSuccess: (data) => {
      // Show success toast with AI message
      toast({
        title: "Design updated successfully!",
        description: data.message || "Your resume design has been customized",
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      });

      // Show ATS warning if present
      if (data.ats_warning) {
        toast({
          variant: "destructive",
          title: "ATS Compatibility Warning",
          description: data.ats_warning,
        });
      }

      // Clear input after successful customization
      setInputValue("");
    },
onError: (error) => {
      // Show error toast
      toast({
        variant: "destructive",
        title: "Failed to update design",
        description: <span>{error.message || "Please check your internet connection and try again."} <a href="/support?error=design_update" className="underline">Report Issue</a></span>,
      });
      // Trigger shake animation
      setShowErrorShake(true);
      setTimeout(() => setShowErrorShake(false), 500);
    },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCustomizing) {
      timer = setTimeout(() => {
        setShowProgressBar(true);
      }, 2000);
    } else {
      setShowProgressBar(false);
    }
    return () => clearTimeout(timer);
  }, [isCustomizing]);

  const handleApplyCustomization = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isCustomizing) return;

    try {
      // Apply customization via hook
      await applyCustomization(trimmedInput);
    } catch (error) {
      // Error is already handled by onError callback
      console.error("Error applying customization:", error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyCustomization();
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <CardTitle className="text-base">Current Template</CardTitle>
          </div>
        </CardHeader>
        <CardContent aria-live="polite"> {/* T032: aria-live="polite" */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" aria-hidden="true" />
            </div>
          ) : currentDesign ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="font-medium text-gray-900">
                  {currentDesign.template_key}
                </p>
                {currentDesign.customization_id && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    Customized
                  </span>
                )}
              </div>
              {currentDesign.template && (
                <CardDescription className="text-sm">
                  {currentDesign.template.description ||
                   `${currentDesign.template.category} template with ${currentDesign.template.name} style`}
                </CardDescription>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No template assigned yet</p>
          )}
        </CardContent>
      </Card>

      {/* Design Customization Input */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-900">
            Customize Your Design
          </h3>
        </div>

        <div className={`space-y-2 ${showErrorShake ? 'animate-shake' : ''}`}>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the design change you want..."
            disabled={isCustomizing || !currentDesign}
            className="w-full"
            aria-label="Design customization request"
          />
          <Button
            onClick={handleApplyCustomization}
            disabled={!inputValue.trim() || isCustomizing || !currentDesign}
            className="w-full min-h-[44px]" // T026: Ensure touch target size
            aria-label="Apply design changes"
          >
            {isCustomizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Applying Changes...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                Apply Change
              </>
            )}
          </Button>
          {showProgressBar && <Progress value={isCustomizing ? undefined : 100} className="w-full h-1 mt-2" />}
        </div>
      </div>

      {/* Suggestion Buttons */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">
          Try these suggestions:
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTION_PROMPTS.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(prompt)}
              disabled={isCustomizing || !currentDesign}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 transition-colors hover:border-purple-300 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]" // T026: Ensure touch target size
              aria-label={`Suggest: ${prompt}`}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-auto rounded-lg bg-blue-50 p-3">
        <p className="text-xs text-blue-900">
          <strong>💡 Tip:</strong> Describe design changes naturally. For
          example: "Make the header dark blue" or "Use a serif font for
          headings"
        </p>
      </div>
    </div>
  );
}

