"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function CompareContent() {
  const sp = useSearchParams();
  const ids = (sp.get("ids") || "").split(",").filter(Boolean);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const results: any[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/v1/applications/${id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          results.push(data);
        }
      }
      setItems(results);
      setLoading(false);
    };
    if (ids.length) load();
  }, [ids.join(",")]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!ids.length) return <div className="p-6">No items selected</div>;

  return (
    <div className="p-6 grid md:grid-cols-2 gap-4">
      {items.map((it) => (
        <div key={it.application.id} className="border rounded p-3 space-y-2">
          <div className="font-semibold">{it.application.job_title} — {it.application.company_name}</div>
          <div className="text-xs text-muted-foreground">Applied: {new Date(it.application.applied_date).toLocaleString()}</div>
          <div className="flex gap-2 text-sm">
            {it.htmlUrl && <a href={it.htmlUrl} target="_blank" rel="noreferrer" className="underline">HTML</a>}
            {it.jsonUrl && <a href={it.jsonUrl} target="_blank" rel="noreferrer" className="underline">JSON</a>}
          </div>
          {it.application.contact && (
            <pre className="bg-muted p-2 rounded text-xs max-h-48 overflow-auto">{JSON.stringify(it.application.contact, null, 2)}</pre>
          )}
          {it.htmlUrl && (
            <iframe src={it.htmlUrl} className="w-full h-72 border rounded" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CompareApplicationsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}



