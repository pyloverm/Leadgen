import { OPPORTUNITY_META, STATUS_META, type LeadView } from "./leads";

const escape = (value: unknown): string => {
  const s = value === undefined || value === null ? "" : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with ";" separator and a UTF-8 BOM so it opens cleanly in Excel (FR/PT locales). */
export function leadsToCsv(rows: LeadView[]): string {
  const header = [
    "Nom",
    "Catégorie",
    "Potentiel (0-100)",
    "Opportunité",
    "Statut site",
    "Score site",
    "Problèmes principaux",
    "Site web",
    "Site trouvé automatiquement",
    "Domaines réservés sans site",
    "En ligne depuis",
    "Page inchangée depuis",
    "Réseaux sociaux",
    "Téléphone",
    "Email",
    "Emails trouvés sur le site",
    "Adresse",
    "Distance (m)",
    "Enseigne / chaîne",
    "Google Maps",
    "OpenStreetMap",
    "Latitude",
    "Longitude",
  ];
  const lines = rows.map(({ lead, website, discovered, confirmed, status, audit, discovery, potential, opportunity }) => [
    lead.name,
    lead.category,
    potential ?? "",
    OPPORTUNITY_META[opportunity].label,
    STATUS_META[status].label,
    audit?.reachable && audit.checks.length ? audit.score : "",
    audit?.reasons.slice(0, 4).join(" | ") ?? "",
    website ?? "",
    discovered ? `oui (${discovery?.confidence === "high" ? "sûr" : "à confirmer"})` : "",
    discovery?.parked.join(" ") ?? "",
    audit?.history?.firstSeen ?? "",
    audit?.history?.unchangedSince ?? "",
    Array.from(new Set([...lead.socials, ...(audit?.socials ?? [])])).join(" "),
    lead.phone ?? (confirmed ? audit?.phones[0] : undefined) ?? "",
    lead.email ?? "",
    (confirmed ? audit?.emails.join(" ") : "") ?? "",
    lead.address ?? "",
    lead.distance,
    lead.isChain ? "oui" : "",
    lead.mapsUrl,
    lead.sourceUrl ?? "",
    lead.lat.toFixed(6),
    lead.lon.toFixed(6),
  ]);
  return "\uFEFF" + [header, ...lines].map((r) => r.map(escape).join(";")).join("\r\n");
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
