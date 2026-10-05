"use client";

import { Globe, Mail, Phone, Sparkles } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import type { LeadView } from "@/lib/leads";
import { displayHost } from "@/lib/urls";
import { OpportunityTag, ScoreBar, StatusBadge } from "./StatusBadge";

interface Props {
  rows: LeadView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function Problems({ row }: { row: LeadView }) {
  const { audit, status, lead, discovery } = row;
  if (audit?.reasons.length) {
    return (
      <ul className="space-y-0.5">
        {audit.reasons.slice(0, 2).map((r) => (
          <li key={r} className="truncate" title={r}>
            • {r}
          </li>
        ))}
        {audit.reasons.length > 2 && <li className="text-slate-400">+{audit.reasons.length - 2} autres</li>}
      </ul>
    );
  }
  if (status === "none" || status === "social") {
    return (
      <span className="text-slate-500">
        {status === "social" ? `Uniquement ${lead.socials.map(displayHost).join(", ")}` : "Aucun site"}
        {discovery && ` · ${discovery.checked} domaines testés`}
        {discovery?.parked.length ? (
          <span className="block text-orange-700">Domaine réservé mais vide : {discovery.parked[0]}</span>
        ) : null}
      </span>
    );
  }
  return null;
}

export function LeadsTable({ rows, selectedId, onSelect }: Props) {
  if (!rows.length) {
    return <div className="p-10 text-center text-sm text-slate-500">Aucun commerce ne correspond aux filtres.</div>;
  }
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="border-b border-slate-200 px-3 py-2">Potentiel</th>
          <th className="border-b border-slate-200 px-3 py-2">Commerce</th>
          <th className="border-b border-slate-200 px-3 py-2">Site web</th>
          <th className="border-b border-slate-200 px-3 py-2">Score</th>
          <th className="hidden border-b border-slate-200 px-3 py-2 xl:table-cell">Problèmes détectés</th>
          <th className="border-b border-slate-200 px-3 py-2">Contact</th>
          <th className="border-b border-slate-200 px-3 py-2 text-right">Dist.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const { lead, status, opportunity, potential, audit, website, discovered, confirmed, discovery } = row;
          const selected = lead.id === selectedId;
          const email = lead.email ?? (confirmed ? audit?.emails[0] : undefined);
          const phone = lead.phone ?? (confirmed ? audit?.phones[0] : undefined);
          return (
            <tr
              key={lead.id}
              onClick={() => onSelect(lead.id)}
              className={`cursor-pointer align-top transition ${selected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
            >
              <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5">
                <OpportunityTag value={opportunity} potential={potential} />
              </td>
              <td className="max-w-[260px] border-b border-slate-100 px-3 py-2.5">
                <div className="truncate font-medium text-slate-900" title={lead.name}>
                  {lead.name}
                </div>
                <div className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  {lead.category}
                  {lead.isChain && <span className="rounded bg-slate-200 px-1 text-[10px] text-slate-600">chaîne</span>}
                </div>
              </td>
              <td className="max-w-[220px] border-b border-slate-100 px-3 py-2.5">
                <StatusBadge status={status} />
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline"
                  >
                    {discovered ? <Sparkles className="size-3 shrink-0 text-violet-500" /> : <Globe className="size-3 shrink-0" />}
                    <span className="truncate">{displayHost(website)}</span>
                    {discovered && (
                      <span
                        className={`shrink-0 rounded px-1 text-[10px] ${
                          discovery?.confidence === "high" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"
                        }`}
                        title="Site trouvé automatiquement (absent d'OpenStreetMap)"
                      >
                        {discovery?.confidence === "high" ? "trouvé" : "à confirmer"}
                      </span>
                    )}
                  </a>
                )}
              </td>
              <td className="border-b border-slate-100 px-3 py-2.5">
                {audit?.reachable && audit.checks.length > 0 ? <ScoreBar score={audit.score} /> : <span className="text-xs text-slate-400">—</span>}
              </td>
              <td className="hidden max-w-[320px] border-b border-slate-100 px-3 py-2.5 text-xs text-slate-600 xl:table-cell">
                <Problems row={row} />
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
