"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

function CompareContent() {
  const sp = useSearchParams();
  const t = useTranslations("dashboard.applications.compare");
  const locale = useLocale();
  const dateLocale = locale === "he" ? "he-IL" : "en-US";
  const idsParam = sp.get("ids") || "";
  const ids = useMemo(() => idsParam.split(",").filter(Boolean), [idsParam]);
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
  }, [ids]);

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (!ids.length) return <div className="p-6">{t("empty")}</div>;

  return (
    <div className="p-6 grid md:grid-cols-2 gap-4">
      {items.map((it) => (
        <div key={it.application.id} className="border rounded p-3 space-y-2">
          <div className="font-semibold">{it.application.job_title} - {it.application.company_name}</div>
          <div className="text-xs text-muted-foreground">{t("appliedDate", { date: new Date(it.application.applied_date).toLocaleString(dateLocale) })}</div>
          <div className="flex gap-2 text-sm">
            {it.htmlUrl && <a href={it.htmlUrl} target="_blank" rel="noreferrer" className="underline">{t("html")}</a>}
            {it.jsonUrl && <a href={it.jsonUrl} target="_blank" rel="noreferrer" className="underline">{t("json")}</a>}
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
  const t = useTranslations("dashboard.applications.compare");

  return (
    <Suspense fallback={<div className="p-6">{t("loading")}</div>}>
      <CompareContent />
    </Suspense>
  );
}



