"use client";

import { Globe, Mail, Phone, Star } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import type { AuditResult, Lead, Opportunity, WebsiteStatus } from "@/lib/types";
import { displayHost } from "@/lib/urls";
import { OpportunityTag, ScoreBar, StatusBadge } from "./StatusBadge";

export interface LeadRow {
  lead: Lead;
  status: WebsiteStatus;
  opportunity: Opportunity;
  audit?: AuditResult;
}

interface Props {
  rows: LeadRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function LeadsTable({ rows, selectedId, onSelect }: Props) {
  if (!rows.length) {
    return <div className="p-10 text-center text-sm text-slate-500">Aucun commerce ne correspond aux filtres.</div>;
  }
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="border-b border-slate-200 px-3 py-2">Opportunité</th>
          <th className="border-b border-slate-200 px-3 py-2">Commerce</th>
          <th className="border-b border-slate-200 px-3 py-2">Site web</th>
          <th className="border-b border-slate-200 px-3 py-2">Score</th>
          <th className="hidden border-b border-slate-200 px-3 py-2 xl:table-cell">Problèmes détectés</th>
          <th className="border-b border-slate-200 px-3 py-2">Contact</th>
          <th className="border-b border-slate-200 px-3 py-2 text-right">Dist.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ lead, status, opportunity, audit }) => {
          const selected = lead.id === selectedId;
          const email = lead.email ?? audit?.emails[0];
          const phone = lead.phone ?? audit?.phones[0];
          return (
            <tr
              key={lead.id}
              onClick={() => onSelect(lead.id)}
              className={`cursor-pointer align-top transition ${selected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
            >
              <td className="border-b border-slate-100 px-3 py-2.5">
                <OpportunityTag value={opportunity} />
              </td>
              <td className="max-w-[260px] border-b border-slate-100 px-3 py-2.5">
                <div className="truncate font-medium text-slate-900" title={lead.name}>
                  {lead.name}
                </div>
                <div className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  {lead.category}
                  {lead.isChain && <span className="rounded bg-slate-200 px-1 text-[10px] text-slate-600">chaîne</span>}
                  {lead.rating !== undefined && (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {lead.rating.toFixed(1)}
                      <span className="text-slate-400">({lead.ratingCount ?? 0})</span>
                    </span>
                  )}
                </div>
              </td>
              <td className="max-w-[200px] border-b border-slate-100 px-3 py-2.5">
                <StatusBadge status={status} />
                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline"
                  >
                    <Globe className="size-3 shrink-0" />
                    <span className="truncate">{displayHost(lead.website)}</span>
                  </a>
                )}
              </td>
              <td className="border-b border-slate-100 px-3 py-2.5">
                {audit?.reachable && audit.checks.length > 0 ? <ScoreBar score={audit.score} /> : <span className="text-xs text-slate-400">—</span>}
              </td>
              <td className="hidden max-w-[320px] border-b border-slate-100 px-3 py-2.5 text-xs text-slate-600 xl:table-cell">
                {audit?.reasons.length ? (
                  <ul className="space-y-0.5">
                    {audit.reasons.slice(0, 2).map((r) => (
                      <li key={r} className="truncate" title={r}>
                        • {r}
                      </li>
                    ))}
                    {audit.reasons.length > 2 && <li className="text-slate-400">+{audit.reasons.length - 2} autres</li>}
                  </ul>
                ) : status === "none" ? (
                  <span className="text-slate-400">Aucun site connu</span>
                ) : status === "social" ? (
                  <span className="text-slate-400">Uniquement {lead.socials.map(displayHost).join(", ")}</span>
                ) : null}
              </td>
              <td className="border-b border-slate-100 px-3 py-2.5">
                <div className="flex gap-1.5 text-slate-400">
                  <Phone className={`size-4 ${phone ? "text-emerald-600" : ""}`} aria-label={phone ? "Téléphone" : "Pas de téléphone"} />
                  <Mail className={`size-4 ${email ? "text-emerald-600" : ""}`} aria-label={email ? "Email" : "Pas d'email"} />
                </div>
              </td>
              <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-right text-xs tabular-nums text-slate-500">
                {formatDistance(lead.distance)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
