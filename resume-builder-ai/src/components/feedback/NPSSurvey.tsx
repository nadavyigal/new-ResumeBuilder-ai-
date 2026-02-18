'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const NPS_STORAGE_KEY = 'rba_nps_shown';
const NPS_SHOWN_AFTER_MS = 3000; // Show 3s after trigger

interface NPSSurveyProps {
  trigger?: boolean; // Set to true when NPS should appear (e.g. after first optimization)
}

export function NPSSurvey({ trigger = false }: NPSSurveyProps) {
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<'score' | 'comment' | 'success'>('score');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    // Only show once per browser
    if (typeof window !== 'undefined' && localStorage.getItem(NPS_STORAGE_KEY)) return;

    const timer = setTimeout(() => setVisible(true), NPS_SHOWN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [trigger]);

  function dismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NPS_STORAGE_KEY, 'true');
    }
    setVisible(false);
  }

  async function submitScore() {
    if (score === null) return;
    setStep('comment');
  }

  async function submitFinal() {
    if (score === null) return;
    setIsSubmitting(true);

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'nps',
          rating: score,
          message: comment.trim() || null,
          context: { page: window.location.pathname },
        }),
      });
    } catch {
      // Silent fail — don't disturb the user if NPS submission fails
    } finally {
      setIsSubmitting(false);
      setStep('success');
      localStorage.setItem(NPS_STORAGE_KEY, 'true');
      setTimeout(() => setVisible(false), 2500);
    }
  }

  function getLabel(s: number): string {
    if (s <= 3) return 'Not at all';
    if (s <= 6) return 'Unlikely';
    if (s <= 8) return 'Likely';
    return 'Very likely';
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <span className="font-semibold text-sm">How are we doing?</span>
          <button onClick={dismiss} aria-label="Dismiss" className="hover:opacity-70 transition-opacity">
            <X size={16} />
          </button>
        </div>

        {/* Score step */}
        {step === 'score' && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-center font-medium">
              How likely are you to recommend Resume Builder AI to a friend or colleague?
            </p>
            <div className="flex justify-between gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setScore(i)}
                  aria-label={`Score ${i}`}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                    score === i
                      ? 'bg-indigo-600 text-white border-indigo-600 scale-110'
                      : 'border-border hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Not at all</span>
              <span>Very likely</span>
            </div>
            {score !== null && (
              <p className="text-center text-xs font-medium text-indigo-600">
                {getLabel(score)} ({score}/10)
              </p>
            )}
            <Button
              onClick={submitScore}
              disabled={score === null}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0"
            >
              Continue <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}

        {/* Comment step */}
        {step === 'comment' && (
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium">
              {score != null && score >= 9
                ? "What do you love most about Resume Builder AI?"
                : score != null && score >= 7
                ? "What could we do to make it even better?"
                : "What's the main thing we could improve?"}
            </p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Your answer (optional)..."
              className="text-sm resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={submitFinal}
                disabled={isSubmitting}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={submitFinal}
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0"
              >
                {isSubmitting ? 'Sending...' : 'Submit'}
              </Button>
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="p-5 text-center">
            <p className="text-2xl mb-2">🙏</p>
            <p className="font-semibold text-sm">Thank you for your feedback!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your input helps us build a better product.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
