import { haversine } from "./geo";
import type { AuditResult, Lead, Opportunity, WebsiteStatus } from "./types";

/** Big national / international brands: rarely a good web-design lead. */
const KNOWN_CHAINS = [
  "pingo doce",
  "continente",
  "lidl",
  "aldi",
  "intermarché",
  "intermarche",
  "minipreço",
  "minipreco",
  "auchan",
  "mercadona",
  "spar",
  "meu super",
  "amanhecer",
  "mcdonald",
  "burger king",
  "kfc",
  "telepizza",
  "pizza hut",
  "domino's",
  "starbucks",
  "subway",
  "h3",
  "galp",
  "repsol",
  "bp ",
  "prio",
  "cepsa",
  "moeve",
  "worten",
  "fnac",
  "zara",
  "primark",
  "h&m",
  "decathlon",
  "leroy merlin",
  "ikea",
  "vodafone",
  "meo",
  "nos ",
  "ctt",
  "millennium",
  "caixa geral",
  "santander",
  "novo banco",
  "bpi",
  "multibanco",
  "remax",
  "re/max",
  "century 21",
  "era imobiliária",
  "kw ",
  "wells",
  "bricomarché",
  "bricomarche",
  "staples",
  "tiffosi",
  "parfois",
  "pull&bear",
  "bershka",
  "springfield",
  "mango",
  "sport zone",
  "pans & company",
  "padaria portuguesa",
  "ibis",
  "pestana",
  "vila galé",
  "vila gale",
  "tivoli",
  "hertz",
  "europcar",
  "avis",
  "sixt",
  "goldcar",
  "norauto",
  "midas",
  "euromaster",
  "carglass",
];

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9&/' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function isKnownChain(name: string): boolean {
  const n = `${name.toLowerCase()} `;
  return KNOWN_CHAINS.some((c) => n.startsWith(c) || n.includes(` ${c}`));
}

/** Flags chains: known brands + any name appearing 3+ times in the same search. */
export function markChains(leads: Lead[]): Lead[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const key = normalizeName(l.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return leads.map((l) =>
    l.isChain || isKnownChain(l.name) || (counts.get(normalizeName(l.name)) ?? 0) >= 3
      ? { ...l, isChain: true }
      : l,
  );
}

/** The same business is often mapped twice in OSM (a node and its building). */
export function dedupeLeads(leads: Lead[], maxDistanceM = 60): Lead[] {
  const out: Lead[] = [];
  for (const lead of leads) {
    const key = normalizeName(lead.name);
    const dup = out.findIndex((o) => normalizeName(o.name) === key && haversine(o, lead) <= maxDistanceM);
    if (dup === -1) {
      out.push(lead);
      continue;
    }
    const a = out[dup];
    out[dup] = {
      ...a,
      address: a.address ?? lead.address,
      phone: a.phone ?? lead.phone,
      email: a.email ?? lead.email,
      website: a.website ?? lead.website,
      socials: Array.from(new Set([...a.socials, ...lead.socials])),
      openingHours: a.openingHours ?? lead.openingHours,
    };
  }
  return out;
}

export function googleMapsSearchUrl(name: string, where: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${where}`)}`;
}

export function googleSearchUrl(lead: Lead, locality?: string): string {
  const q = [lead.name, locality ?? lead.address ?? ""].join(" ").trim();
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function websiteStatus(lead: Lead, audit: AuditResult | undefined, auditing: boolean): WebsiteStatus {
  if (!lead.website) return lead.socials.length ? "social" : "none";
  if (audit) return audit.verdict;
  return auditing ? "auditing" : "pending";
}

export function opportunity(status: WebsiteStatus): Opportunity {
  switch (status) {
    case "none":
    case "social":
    case "redo":
      return "hot";
    case "improve":
      return "warm";
    case "good":
      return "cold";
    default:
      return "unknown";
  }
}

export const STATUS_META: Record<WebsiteStatus, { label: string; short: string; color: string; badge: string }> = {
  none: { label: "Pas de site web", short: "Sans site", color: "#dc2626", badge: "bg-red-100 text-red-800 ring-red-200" },
  social: {
    label: "Réseaux sociaux / annuaire seulement",
    short: "Réseaux seulement",
    color: "#ea580c",
    badge: "bg-orange-100 text-orange-800 ring-orange-200",
  },
  redo: { label: "Site à refaire", short: "À refaire", color: "#be123c", badge: "bg-rose-100 text-rose-800 ring-rose-200" },
  improve: {
    label: "Site améliorable",
    short: "Améliorable",
    color: "#d97706",
    badge: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  good: { label: "Site correct", short: "Correct", color: "#16a34a", badge: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  unknown: {
    label: "Analyse impossible (site protégé)",
    short: "Non analysable",
    color: "#64748b",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  pending: { label: "Analyse en attente", short: "En attente", color: "#94a3b8", badge: "bg-slate-50 text-slate-500 ring-slate-200" },
  auditing: { label: "Analyse en cours…", short: "Analyse…", color: "#3b82f6", badge: "bg-blue-50 text-blue-700 ring-blue-200" },
};

export const OPPORTUNITY_META: Record<Opportunity, { label: string; rank: number; className: string }> = {
  hot: { label: "Chaud", rank: 0, className: "text-red-600" },
  warm: { label: "Tiède", rank: 1, className: "text-amber-600" },
  unknown: { label: "?", rank: 2, className: "text-slate-400" },
  cold: { label: "Froid", rank: 3, className: "text-sky-600" },
};
