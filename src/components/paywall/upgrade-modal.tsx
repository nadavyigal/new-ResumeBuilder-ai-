"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Sparkles, Zap } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  optimizationsUsed: number;
}

/**
 * Upgrade Modal Component
 * Epic 5: FR-022 - Paywall interface for free-tier users
 *
 * Displays when free-tier users attempt additional optimizations
 */
export function UpgradeModal({ isOpen, onClose, optimizationsUsed }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpgrade = async () => {
    setLoading(true);

    try {
      // FR-024: Payment processing integration (Stripe)
      const response = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "premium" }),
      });

      const data = await response.json();

      if (response.ok && data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        console.error("Upgrade failed:", data.error);
        alert("Failed to start upgrade process. Please try again.");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const premiumFeatures = [
    "Unlimited resume optimizations",
    "Access to all premium templates",
    "Priority AI processing",
    "Advanced match score analytics",
    "Export in multiple formats",
    "Priority customer support",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription className="text-base">
            You&rsquo;ve used your free optimization ({optimizationsUsed}/1)
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Pricing Card */}
          <Card className="border-2 border-primary shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-primary">Best Value</span>
                </div>
                <div className="mb-2">
                  <span className="text-5xl font-bold">$9.99</span>
                  <span className="text-xl text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cancel anytime • No hidden fees
                </p>
              </div>

              {/* Features List */}
              <div className="space-y-3 mb-6">
                {premiumFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full text-base py-6"
                size="lg"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                    Processing...
                  </span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Upgrade to Premium
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                Secure payment processed by Stripe
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
