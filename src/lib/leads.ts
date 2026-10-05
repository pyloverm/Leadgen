import { haversine } from "./geo";
import type { AuditResult, CategoryGroupId, DiscoveryResult, Lead, Opportunity, WebsiteStatus } from "./types";

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

export function effectiveWebsite(lead: Lead, discovery?: DiscoveryResult): string | undefined {
  return lead.website ?? discovery?.website;
}

export function websiteStatus(
  lead: Lead,
  { discovery, audit, searching = false, auditing = false }: { discovery?: DiscoveryResult; audit?: AuditResult; searching?: boolean; auditing?: boolean },
): WebsiteStatus {
  if (!effectiveWebsite(lead, discovery)) {
    if (searching) return "searching";
    return lead.socials.length ? "social" : "none";
  }
  if (audit) return audit.verdict;
  return auditing ? "auditing" : "pending";
}

/** How much a business is worth calling, per category (hotels and clinics need a website more than a kiosk). */
const GROUP_VALUE: Record<CategoryGroupId, number> = {
  lodging: 6,
  health_beauty: 5,
  food: 4,
  services: 4,
  leisure: 3,
  auto: 2,
  shops: 0,
};

/**
 * Lead potential from 0 to 100: website situation first, then contactability, category and chains.
 * Returns null while the website is still being searched or audited.
 */
export function leadPotential(lead: Lead, status: WebsiteStatus, audit?: AuditResult, discovery?: DiscoveryResult): number | null {
  let p: number;
  switch (status) {
    case "none":
      p = discovery ? 85 : 80; // absence confirmed by the website search
      break;
    case "social":
      p = 82;
      break;
    case "redo":
      p = audit && !audit.reachable ? 90 : 75 + Math.round((50 - Math.min(audit?.score ?? 50, 50)) / 5);
      break;
    case "improve":
      p = 40 + Math.round((80 - (audit?.score ?? 65)) * 0.9);
      break;
    case "good":
      p = 15;
      break;
    case "unknown":
      p = 45;
      break;
    default:
      return null;
  }
  // A website guessed with medium confidence may belong to a homonym: stay halfway with "no website".
  const guessed = !lead.website && discovery?.website && discovery.confidence !== "high";
  if (guessed && audit) p = Math.round((p + 82) / 2);
  if (discovery?.parked.length) p += 4; // owns a domain without a site: an easy sell
  const contactable = lead.phone || lead.email || audit?.emails.length || audit?.phones.length;
  p += contactable ? 4 : -10;
  p += GROUP_VALUE[lead.group];
  if (lead.isChain) p -= 40;
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function opportunity(potential: number | null): Opportunity {
  if (potential === null) return "unknown";
  return potential >= 70 ? "hot" : potential >= 40 ? "warm" : "cold";
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
  searching: {
    label: "Recherche du site…",
    short: "Recherche…",
    color: "#6366f1",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-200",
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

/** Everything the UI and exports need about a lead, derived from search + discovery + audit results. */
export interface LeadView {
  lead: Lead;
  website?: string;
  /** True when the website was found by the automatic search (not listed in OpenStreetMap). */
  discovered: boolean;
  /** False when the website is only a medium-confidence guess: its contacts may be someone else's. */
  confirmed: boolean;
  status: WebsiteStatus;
  audit?: AuditResult;
  discovery?: DiscoveryResult;
  potential: number | null;
  opportunity: Opportunity;
}

export function buildLeadView(
  lead: Lead,
  discoveries: Record<string, DiscoveryResult>,
  audits: Record<string, AuditResult>,
  searching: Set<string> = new Set(),
  auditing: Set<string> = new Set(),
): LeadView {
  const discovery = discoveries[lead.id];
  const website = effectiveWebsite(lead, discovery);
  const audit = website ? audits[website] : undefined;
  const status = websiteStatus(lead, {
    discovery,
    audit,
    searching: searching.has(lead.id),
    auditing: website ? auditing.has(website) : false,
  });
  const potential = leadPotential(lead, status, audit, discovery);
  return {
    lead,
    website,
    discovered: !lead.website && Boolean(website),
    confirmed: Boolean(lead.website) || discovery?.confidence === "high",
    status,
    audit,
    discovery,
    potential,
    opportunity: opportunity(potential),
  };
}
