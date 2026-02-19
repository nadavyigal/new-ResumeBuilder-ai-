'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Feedback, SupportTicket, FeedbackStatus, TicketStatus, TicketPriority } from '@/types/feedback';

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  general: 'General',
  bug: '🐛 Bug',
  feature_request: '✨ Feature',
  nps: 'NPS',
  rating: '⭐ Rating',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  reviewed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  actioned: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface FeedbackStats {
  total: number;
  new: number;
  avg_nps: number | null;
  by_type: Record<string, number>;
}

interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  high_priority: number;
}

export function FeedbackAdminDashboard() {
  const [activeTab, setActiveTab] = useState<'feedback' | 'tickets'>('feedback');
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [ticketList, setTicketList] = useState<SupportTicket[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchFeedback = useCallback(async () => {
    const params = new URLSearchParams({ limit: '50' });
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);

    const res = await fetch(`/api/admin/feedback?${params}`);
    if (!res.ok) return;
    const json = await res.json();
    setFeedbackList(json.data ?? []);
    setFeedbackStats(json.stats ?? null);
  }, [typeFilter, statusFilter]);

  const fetchTickets = useCallback(async () => {
    const params = new URLSearchParams({ limit: '50' });
    if (statusFilter !== 'all') params.set('status', statusFilter);

    const res = await fetch(`/api/admin/tickets?${params}`);
    if (!res.ok) return;
    const json = await res.json();
    setTicketList(json.data ?? []);
    setTicketStats(json.stats ?? null);
  }, [statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    const load = activeTab === 'feedback' ? fetchFeedback() : fetchTickets();
    load.finally(() => setIsLoading(false));
  }, [activeTab, fetchFeedback, fetchTickets]);

  async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
    await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setFeedbackList((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  }

  async function updateTicketStatus(id: string, status: TicketStatus) {
    await fetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setTicketList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );
  }

  async function updateTicketPriority(id: string, priority: TicketPriority) {
    await fetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
    setTicketList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority } : t))
    );
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      {activeTab === 'feedback' && feedbackStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Feedback" value={feedbackStats.total} />
          <StatCard label="New / Unread" value={feedbackStats.new} highlight />
          <StatCard label="Avg NPS Score" value={feedbackStats.avg_nps != null ? feedbackStats.avg_nps.toFixed(1) : '—'} />
          <StatCard label="Feature Requests" value={feedbackStats.by_type?.feature_request ?? 0} />
        </div>
      )}
      {activeTab === 'tickets' && ticketStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Tickets" value={ticketStats.total} />
          <StatCard label="Open" value={ticketStats.open} highlight />
          <StatCard label="In Progress" value={ticketStats.in_progress} />
          <StatCard label="High Priority" value={ticketStats.high_priority} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => { setActiveTab('feedback'); setStatusFilter('all'); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'feedback'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Feedback {feedbackStats && `(${feedbackStats.total})`}
        </button>
        <button
          onClick={() => { setActiveTab('tickets'); setStatusFilter('all'); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'tickets'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Support Tickets {ticketStats && `(${ticketStats.total})`}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {activeTab === 'feedback' && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="bug">Bug Reports</SelectItem>
              <SelectItem value="feature_request">Feature Requests</SelectItem>
              <SelectItem value="nps">NPS Surveys</SelectItem>
              <SelectItem value="rating">Ratings</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {activeTab === 'feedback' ? (
              <>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => activeTab === 'feedback' ? fetchFeedback() : fetchTickets()}
        >
          Refresh
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : activeTab === 'feedback' ? (
        <FeedbackTable items={feedbackList} onStatusChange={updateFeedbackStatus} formatDate={formatDate} />
      ) : (
        <TicketsTable
          items={ticketList}
          onStatusChange={updateTicketStatus}
          onPriorityChange={updateTicketPriority}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-900/20' : 'border-border bg-muted/30'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>{value}</p>
    </div>
  );
}

function FeedbackTable({
  items,
  onStatusChange,
  formatDate,
}: {
  items: Feedback[];
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  formatDate: (d: string) => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No feedback found.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((f) => (
        <div
          key={f.id}
          className="border border-border rounded-xl p-4 space-y-2 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded-full">
              {FEEDBACK_TYPE_LABELS[f.type] ?? f.type}
            </span>
            {f.rating != null && (
              <span className="text-xs text-muted-foreground">⭐ {f.rating}/10</span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status] ?? ''}`}
            >
              {f.status}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">{formatDate(f.created_at)}</span>
          </div>

          {f.message && (
            <p className="text-sm text-foreground/80 line-clamp-2">{f.message}</p>
          )}

          {f.context && Object.keys(f.context).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {Object.entries(f.context)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select
              value={f.status}
              onValueChange={(v) => onStatusChange(f.id, v as FeedbackStatus)}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketsTable({
  items,
  onStatusChange,
  onPriorityChange,
  formatDate,
}: {
  items: SupportTicket[];
  onStatusChange: (id: string, status: TicketStatus) => void;
  onPriorityChange: (id: string, priority: TicketPriority) => void;
  formatDate: (d: string) => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No support tickets found.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="border border-border rounded-xl p-4 space-y-2 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
        >
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{t.subject}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.name ? `${t.name} <${t.email}>` : t.email} · {t.category}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                {t.priority}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? ''}`}>
                {t.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <p className="text-sm text-foreground/80 line-clamp-2">{t.message}</p>

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-muted-foreground">Priority:</span>
              <Select
                value={t.priority}
                onValueChange={(v) => onPriorityChange(t.id, v as TicketPriority)}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Status:</span>
              <Select
                value={t.status}
                onValueChange={(v) => onStatusChange(t.id, v as TicketStatus)}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
