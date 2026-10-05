import { Loader2 } from "lucide-react";
import { OPPORTUNITY_META, STATUS_META } from "@/lib/leads";
import type { Opportunity, WebsiteStatus } from "@/lib/types";

export function StatusBadge({ status, long = false }: { status: WebsiteStatus; long?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}
    >
      {status === "auditing" || status === "searching" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      )}
      {long ? meta.label : meta.short}
    </span>
  );
}

export function OpportunityTag({ value, potential }: { value: Opportunity; potential: number | null }) {
  const meta = OPPORTUNITY_META[value];
  const icon = value === "hot" ? "🔥" : value === "warm" ? "♨️" : value === "cold" ? "❄️" : "…";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.className}`} title={`Potentiel ${potential ?? "?"}/100`}>
      <span aria-hidden>{icon}</span>
      {potential === null ? meta.label : <span className="tabular-nums">{potential}</span>}
      {potential !== null && <span className="font-normal opacity-70">{meta.label}</span>}
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
