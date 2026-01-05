"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

/**
 * Newsletter Signup Component - Integrated with Buttondown
 *
 * This component posts directly to Buttondown's API for newsletter management
 * while maintaining a professional, branded UI with our design system.
 *
 * Buttondown handles:
 * - Email validation and deliverability
 * - Welcome email sequence
 * - Unsubscribe management
 * - Newsletter sending
 *
 * Example usage:
 * ```tsx
 * import { NewsletterSignup } from '@/components/newsletter-signup';
 *
 * export default function LandingPage() {
 *   return (
 *     <div>
 *       <h1>Join our newsletter</h1>
 *       <NewsletterSignup />
 *     </div>
 *   );
 * }
 * ```
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Post directly to Buttondown's API
      const formData = new FormData();
      formData.append('email', email);

      const response = await fetch(
        'https://buttondown.com/api/emails/embed-subscribe/resumebuilderai',
        {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        toast({
          title: 'Success! 🎉',
          description: 'Check your email to confirm your subscription.',
        });
        setEmail('');

        // Track successful signup in PostHog if available
        if (typeof window !== 'undefined' && (window as any).posthog) {
          (window as any).posthog.capture('newsletter_signup', {
            email_domain: email.split('@')[1],
          });
        }
      } else {
        // Handle Buttondown error responses
        const errorText = await response.text();
        let errorMessage = 'Failed to subscribe. Please try again.';

        if (errorText.includes('already subscribed') || errorText.includes('duplicate')) {
          errorMessage = 'This email is already subscribed!';
        }

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Newsletter signup error:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          name="email"
          id="bd-email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading} className="sm:w-auto">
          {loading ? 'Subscribing...' : 'Subscribe'}
        </Button>
      </div>
      <p className="text-xs text-center text-foreground/60">
        Get weekly resume tips, ATS insights, and career advice. Unsubscribe anytime.
      </p>
    </form>
  );
}
