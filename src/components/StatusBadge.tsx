import { Loader2 } from "lucide-react";
import { OPPORTUNITY_META, STATUS_META } from "@/lib/leads";
import type { Opportunity, WebsiteStatus } from "@/lib/types";

export function StatusBadge({ status, long = false }: { status: WebsiteStatus; long?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}
    >
      {status === "auditing" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      )}
      {long ? meta.label : meta.short}
    </span>
  );
}

export function OpportunityTag({ value }: { value: Opportunity }) {
  const meta = OPPORTUNITY_META[value];
  const flames = value === "hot" ? "🔥" : value === "warm" ? "♨️" : value === "cold" ? "❄️" : "…";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.className}`}>
      <span aria-hidden>{flames}</span>
      {meta.label}
    </span>
  );
}

export function ScoreBar({ score, showValue = true }: { score: number; showValue?: boolean }) {
  const color = score < 50 ? "bg-rose-500" : score < 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2" title={`Score ${score}/100`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      {showValue && <span className="w-7 text-right text-xs tabular-nums text-slate-600">{score}</span>}
    </div>
  );
}
