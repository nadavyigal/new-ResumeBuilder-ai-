"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ApplicationItem {
  id: string;
  job_title: string;
  company_name: string;
  applied_date: string;
  apply_clicked_at?: string | null;
  ats_score: number | null;
  contact?: { name?: string; email?: string; phone?: string } | null;
  resume_html_path?: string | null;
  optimized_resume_url?: string | null;
  source_url?: string | null;
  optimization_id?: string | null;
}

export default function ApplicationsPage() {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [createUrl, setCreateUrl] = useState("");

  const load = async () => {
    setLoading(true);
    const url = new URL(`/api/v1/applications`, window.location.origin);
    if (q) url.searchParams.set("q", q);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setItems(data.applications || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createFromUrl = async () => {
    if (!createUrl) return;
    const res = await fetch('/api/v1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: createUrl })
    });
    if (res.ok) {
      setCreateUrl("");
      await load();
    }
  };

  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>Browse jobs you applied to and open the matching optimized resume.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input placeholder="Search job title or company" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button onClick={load} disabled={loading}>Search</Button>
          </div>
          {/* Removed Create from URL per request */}
        </CardContent>
      </Card>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-3">Optimized resume</th>
                    <th className="py-3">Company name</th>
                    <th className="py-3">Job title</th>
                    <th className="py-3">Application date</th>
                    <th className="py-3">ATS score</th>
                    <th className="py-3">Contact person</th>
                    <th className="py-3">Job URL</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b">
                      <td className="py-3">
                        {it.optimization_id ? (
                          <Link href={`/dashboard/optimizations/${it.optimization_id}`} className="underline">Go to optimization</Link>
                        ) : (it.optimized_resume_url ? <a href={it.optimized_resume_url} target="_blank" className="underline">Open optimized</a> : '-')}
                      </td>
                      <td className="py-3">{it.company_name || '-'}</td>
                      <td className="py-3">{it.job_title}</td>
                      <td className="py-3">
                        {it.apply_clicked_at ? new Date(it.apply_clicked_at).toLocaleDateString() : new Date(it.applied_date).toLocaleDateString()}
                        <span className="ml-2"><MarkAppliedButton id={it.id} onDone={load} /></span>
                      </td>
                      <td className="py-3">{it.ats_score != null ? Math.round(it.ats_score) : '-'}</td>
                      <td className="py-3">{it.contact?.name || '-'}</td>
                      <td className="py-3">{it.source_url ? <a href={it.source_url} target="_blank" className="underline">Job URL</a> : '-'}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={8}>No applications yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OpenResumeButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const onOpen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/applications/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.htmlUrl) window.open(data.htmlUrl, '_blank');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" onClick={onOpen} disabled={loading}>
      {loading ? 'Opening...' : 'Open Resume'}
    </Button>
  );
}


function OpenOptimizedButton({ id, fallbackHtml }: { id: string; fallbackHtml?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const onOpen = async () => {
    setLoading(true);
    try {
      // Try open optimized resume first via details
      const res = await fetch(`/api/v1/applications/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.application?.optimized_resume_url) {
          window.open(data.application.optimized_resume_url, '_blank');
          return;
        }
        if (fallbackHtml && data.htmlUrl) {
          window.open(data.htmlUrl, '_blank');
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" onClick={onOpen} disabled={loading}>
      {loading ? 'Opening...' : 'Open the optimized resume'}
    </Button>
  );
}

function OpenOptimizedCircle({ id, optimizationId }: { id: string; optimizationId: string | null }) {
  const [loading, setLoading] = useState(false);
  const onOpen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/applications/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.application?.optimized_resume_url) {
          window.open(data.application.optimized_resume_url, '_blank');
          return;
        }
        if (data.htmlUrl) {
          window.open(data.htmlUrl, '_blank');
          return;
        }
      }
      if (optimizationId) {
        window.location.href = `/dashboard/optimizations/${optimizationId}`;
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={onOpen}
      disabled={loading}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black text-white hover:opacity-90"
      title="Open optimized resume"
    >
      {loading ? '…' : '↗'}
    </button>
  );
}

function MarkAppliedButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/applications/${id}/mark-applied`, { method: 'POST' });
      if (res.ok) onDone();
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={loading}>
      {loading ? 'Marking…' : 'Mark Applied'}
    </Button>
  );
}


