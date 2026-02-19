'use client';

import { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { FeedbackType } from '@/types/feedback';

type Step = 'closed' | 'type' | 'details' | 'success';

const FEEDBACK_TYPES: { value: FeedbackType; label: string; emoji: string; description: string }[] = [
  { value: 'general', label: 'General', emoji: '💬', description: 'Share a thought or suggestion' },
  { value: 'bug', label: 'Bug Report', emoji: '🐛', description: 'Something is broken' },
  { value: 'feature_request', label: 'Feature Request', emoji: '✨', description: 'Request a new feature' },
];

interface FeedbackWidgetProps {
  currentPage?: string;
}

export function FeedbackWidget({ currentPage }: FeedbackWidgetProps) {
  const [step, setStep] = useState<Step>('closed');
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep('closed');
    setSelectedType(null);
    setRating(null);
    setMessage('');
    setError(null);
  }

  function open() {
    setStep('type');
    setError(null);
  }

  function selectType(type: FeedbackType) {
    setSelectedType(type);
    setStep('details');
  }

  async function submit() {
    if (!selectedType) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          rating,
          message: message.trim() || null,
          context: { page: currentPage ?? window.location.pathname },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to submit feedback');
      }

      setStep('success');
      setTimeout(() => reset(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'closed') {
    return (
      <button
        onClick={open}
        aria-label="Give feedback"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 font-medium text-sm"
      >
        <MessageSquarePlus size={18} />
        <span>Feedback</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <span className="font-semibold text-sm">
          {step === 'type' && 'Share your feedback'}
          {step === 'details' && 'Tell us more'}
          {step === 'success' && 'Thank you!'}
        </span>
        <button onClick={reset} aria-label="Close" className="hover:opacity-70 transition-opacity">
          <X size={16} />
        </button>
      </div>

      {/* Type selection */}
      {step === 'type' && (
        <div className="p-4 space-y-2">
          <p className="text-sm text-muted-foreground mb-3">What would you like to share?</p>
          {FEEDBACK_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => selectType(t.value)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-border hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all duration-150"
            >
              <span className="text-2xl leading-none mt-0.5">{t.emoji}</span>
              <div>
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Details */}
      {step === 'details' && selectedType && (
        <div className="p-4 space-y-4">
          {/* Star rating */}
          <div>
            <Label className="text-sm font-medium">How would you rate your experience? (optional)</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(rating === star * 2 ? null : star * 2)}
                  aria-label={`${star} star`}
                  className={`text-2xl transition-transform hover:scale-110 ${
                    rating != null && star * 2 <= rating ? 'text-yellow-400' : 'text-muted-foreground/30'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="fb-message" className="text-sm font-medium">
              Message {selectedType === 'bug' ? '(required)' : '(optional)'}
            </Label>
            <Textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                selectedType === 'bug'
                  ? 'Describe what happened and how to reproduce it...'
                  : selectedType === 'feature_request'
                  ? 'Describe the feature and why it would help you...'
                  : 'Share your thoughts...'
              }
              className="mt-1.5 text-sm resize-none"
              rows={3}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep('type')}
              className="flex-1"
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={isSubmitting || (selectedType === 'bug' && !message.trim())}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                  Sending...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Send size={14} />
                  Send
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="p-6 text-center space-y-3">
          <CheckCircle className="mx-auto text-green-500" size={40} />
          <p className="font-semibold">Feedback sent!</p>
          <p className="text-sm text-muted-foreground">
            Thanks for helping us improve. We read every piece of feedback.
          </p>
        </div>
      )}
    </div>
  );
}
