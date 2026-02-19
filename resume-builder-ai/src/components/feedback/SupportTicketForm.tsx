'use client';

import { useState } from 'react';
import { CheckCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormState {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
}

const INITIAL_STATE: FormState = {
  name: '',
  email: '',
  subject: '',
  category: 'other',
  message: '',
};

interface SupportTicketFormProps {
  userEmail?: string;
  userName?: string;
}

export function SupportTicketForm({ userEmail, userName }: SupportTicketFormProps) {
  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    email: userEmail ?? '',
    name: userName ?? '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError(null);
  }

  function validate(): boolean {
    const errors: Partial<FormState> = {};
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email';
    if (!form.subject.trim()) errors.subject = 'Subject is required';
    if (!form.message.trim() || form.message.length < 10)
      errors.message = 'Please describe your issue in at least 10 characters';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || null,
          email: form.email.trim(),
          subject: form.subject.trim(),
          category: form.category,
          message: form.message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to submit. Please try again.');
      }

      setSuccess(data.ticketRef);
      setForm({ ...INITIAL_STATE, email: userEmail ?? '', name: userName ?? '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle className="text-green-500" size={48} />
        <div>
          <h3 className="text-xl font-semibold mb-2">Message Received!</h3>
          <p className="text-muted-foreground">
            We&apos;ll get back to you within 1–2 business days.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Ticket ID: <span className="font-mono font-semibold text-foreground">{success}</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => setSuccess(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="st-name">Name (optional)</Label>
          <Input
            id="st-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="st-email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="st-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@example.com"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="st-category">Category</Label>
        <Select value={form.category} onValueChange={(v) => set('category', v)}>
          <SelectTrigger id="st-category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="technical">Technical issue</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="account">Account</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="st-subject">
          Subject <span className="text-destructive">*</span>
        </Label>
        <Input
          id="st-subject"
          value={form.subject}
          onChange={(e) => set('subject', e.target.value)}
          placeholder="Brief description of your issue"
          aria-invalid={!!fieldErrors.subject}
        />
        {fieldErrors.subject && (
          <p className="text-xs text-destructive">{fieldErrors.subject}</p>
        )}
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <Label htmlFor="st-message">
          Message <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="st-message"
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder="Describe your issue in detail. The more context you provide, the faster we can help."
          rows={5}
          aria-invalid={!!fieldErrors.message}
        />
        {fieldErrors.message && (
          <p className="text-xs text-destructive">{fieldErrors.message}</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 py-5"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Sending...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send size={16} />
            Send Message
          </span>
        )}
      </Button>
    </form>
  );
}
