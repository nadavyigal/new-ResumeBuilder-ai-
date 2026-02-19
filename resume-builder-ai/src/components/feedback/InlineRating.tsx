'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface InlineRatingProps {
  optimizationId: string;
  label?: string;
}

type RatingState = 'idle' | 'thumbs_up' | 'thumbs_down' | 'expanded' | 'success';

export function InlineRating({ optimizationId, label = 'Was this optimization helpful?' }: InlineRatingProps) {
  const [state, setState] = useState<RatingState>('idle');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(thumbScore: 10 | 0, extraComment?: string) {
    setIsSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rating',
          rating: thumbScore,
          message: extraComment?.trim() || null,
          context: {
            optimization_id: optimizationId,
            page: window.location.pathname,
          },
        }),
      });
    } catch {
      // Silent fail
    } finally {
      setIsSubmitting(false);
      setState('success');
    }
  }

  function onThumbsUp() {
    setState('thumbs_up');
    submit(10);
  }

  function onThumbsDown() {
    setState('thumbs_down');
    // Expand for optional comment
    setState('expanded');
  }

  function submitWithComment() {
    submit(0, comment);
  }

  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <CheckCircle size={16} className="text-green-500 shrink-0" />
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  if (state === 'expanded') {
    return (
      <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
        <p className="text-sm font-medium">Sorry to hear that. What could be better?</p>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what went wrong (optional)..."
          className="text-sm resize-none"
          rows={3}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit(0)}
            disabled={isSubmitting}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            size="sm"
            onClick={submitWithComment}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Sending...' : 'Send feedback'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        <button
          onClick={onThumbsUp}
          disabled={state !== 'idle' || isSubmitting}
          aria-label="Thumbs up"
          className={`p-2 rounded-lg border transition-all hover:scale-110 ${
            state === 'thumbs_up'
              ? 'bg-green-100 border-green-400 text-green-600 dark:bg-green-900/30'
              : 'border-border hover:border-green-400 hover:text-green-500'
          }`}
        >
          <ThumbsUp size={16} />
        </button>
        <button
          onClick={onThumbsDown}
          disabled={state !== 'idle' || isSubmitting}
          aria-label="Thumbs down"
          className={`p-2 rounded-lg border transition-all hover:scale-110 ${
            state === 'thumbs_down'
              ? 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900/30'
              : 'border-border hover:border-red-400 hover:text-red-500'
          }`}
        >
          <ThumbsDown size={16} />
        </button>
      </div>
    </div>
  );
}
