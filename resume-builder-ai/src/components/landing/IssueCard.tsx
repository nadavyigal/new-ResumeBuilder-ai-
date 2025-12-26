import { Badge } from "@/components/ui/badge";
import type { ATSIssue } from "@/components/landing/FreeATSChecker";

interface IssueCardProps {
  issue: ATSIssue;
  rank: number;
}

export function IssueCard({ issue, rank }: IssueCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-mobile-cta/10 text-mobile-cta flex items-center justify-center font-semibold">
          {rank}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">{issue.text}</p>
          <div className="flex flex-wrap items-center gap-2">
            {issue.category && (
              <Badge variant="secondary" className="text-xs">
                {issue.category}
              </Badge>
            )}
            {typeof issue.estimated_gain === "number" && (
              <Badge variant="outline" className="text-xs">
                +{issue.estimated_gain} pts
              </Badge>
            )}
            {issue.quick_win && (
              <Badge variant="secondary" className="text-xs">
                Quick win
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
