"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Sparkles, Target } from "@/lib/icons";

interface ReadinessOverviewProps {
  title: string;
  subtitle: string;
  highlights: string[];
  eyebrow?: string;
  structureBadge?: string;
  stats?: Array<{ label: string; value: string }>;
}

export function ReadinessOverview({
  title,
  subtitle,
  highlights,
  eyebrow,
  structureBadge,
  stats = [],
}: ReadinessOverviewProps) {
  return (
    <Card className="overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {eyebrow || "Interview-ready draft"}
              </Badge>
              <Badge variant="outline" className="border-emerald-300 bg-white/70 text-emerald-900">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {structureBadge || "ATS-safe structure"}
              </Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              {subtitle}
            </p>

            {highlights.length > 0 && (
              <div className="mt-5 grid gap-2 md:grid-cols-2">
                {highlights.slice(0, 4).map((highlight, index) => (
                  <div
                    key={`${highlight}-${index}`}
                    className="flex items-start gap-2 rounded-xl border border-white/80 bg-white/80 px-3 py-3 text-sm text-slate-700 shadow-sm"
                  >
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {stats.length > 0 && (
            <div className="grid min-w-[220px] gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm"
                >
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    {stat.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{stat.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
