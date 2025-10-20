"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ApplicationDetail {
  id: string;
  job_title: string;
  company_name: string;
  applied_date: string;
  ats_score: number | null;
  contact: any | null;
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [jsonUrl, setJsonUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch(`/api/v1/applications/${params.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItem(data.application);
        setHtmlUrl(data.htmlUrl);
        setJsonUrl(data.jsonUrl);
      }
      setLoading(false);
    };
    if (params.id) load();
  }, [params.id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!item) return <div className="p-6">Not found</div>;

  return (
    <div className="p-6 space-y-4">
      <Link href="/dashboard/applications" className="text-sm underline">← Back</Link>
      <div>
        <div className="text-xl font-semibold">{item.job_title}</div>
        <div className="text-muted-foreground">{item.company_name}</div>
        <div className="text-xs text-muted-foreground">Applied: {new Date(item.applied_date).toLocaleString()}</div>
        {item.ats_score !== null && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
            <span className="text-sm font-medium text-green-900 dark:text-green-100">
              ATS Match Score:
            </span>
            <span className="text-sm font-bold text-green-700 dark:text-green-300">
              {item.ats_score}%
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {htmlUrl && <a href={htmlUrl} target="_blank" rel="noreferrer" className="underline">Download HTML</a>}
        {jsonUrl && <a href={jsonUrl} target="_blank" rel="noreferrer" className="underline">Download JSON</a>}
      </div>
      {item.contact && (
        <pre className="bg-muted p-3 rounded text-sm overflow-auto max-h-80">{JSON.stringify(item.contact, null, 2)}</pre>
      )}
      {htmlUrl && (
        <iframe src={htmlUrl} className="w-full h-[70vh] border rounded" />
      )}
    </div>
  );
}



