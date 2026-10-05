import { OPPORTUNITY_META, STATUS_META, opportunity, websiteStatus } from "./leads";
import type { AuditResult, Lead } from "./types";

const escape = (value: unknown): string => {
  const s = value === undefined || value === null ? "" : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with ";" separator and a UTF-8 BOM so it opens cleanly in Excel (FR/PT locales). */
export function leadsToCsv(leads: Lead[], audits: Record<string, AuditResult>): string {
  const header = [
    "Nom",
    "Catégorie",
    "Opportunité",
    "Statut site",
    "Score site",
    "Problèmes principaux",
    "Site web",
    "Réseaux sociaux",
    "Téléphone",
    "Email",
    "Emails trouvés sur le site",
    "Adresse",
    "Distance (m)",
    "Note Google",
    "Avis Google",
    "Enseigne / chaîne",
    "Google Maps",
    "Latitude",
    "Longitude",
    "Source",
  ];
  const rows = leads.map((lead) => {
    const audit = lead.website ? audits[lead.website] : undefined;
    const status = websiteStatus(lead, audit, false);
    return [
      lead.name,
      lead.category,
      OPPORTUNITY_META[opportunity(status)].label,
      STATUS_META[status].label,
      audit?.reachable ? audit.score : "",
      audit?.reasons.slice(0, 4).join(" | ") ?? "",
      lead.website ?? "",
      Array.from(new Set([...lead.socials, ...(audit?.socials ?? [])])).join(" "),
      lead.phone ?? audit?.phones[0] ?? "",
      lead.email ?? "",
      audit?.emails.join(" ") ?? "",
      lead.address ?? "",
      lead.distance,
      lead.rating ?? "",
      lead.ratingCount ?? "",
      lead.isChain ? "oui" : "",
      lead.mapsUrl,
      lead.lat.toFixed(6),
      lead.lon.toFixed(6),
      lead.source === "google" ? "Google Places" : "OpenStreetMap",
    ];
  });
  return "﻿" + [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
}

export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
