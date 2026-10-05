import { TtlCache } from "../cache";
import { classifyOsm, getGroup, labelFor } from "../categories";
import { haversine } from "../geo";
import { dedupeLeads, googleMapsSearchUrl, markChains } from "../leads";
import type { Lead, SearchParams, SearchResponse } from "../types";
import { socialToUrl, splitWebsite } from "../urls";
import { APP_USER_AGENT, UpstreamError, fetchWithTimeout } from "./http";

const ENDPOINTS = (
  process.env.OVERPASS_URLS ||
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const cache = new TtlCache<OverpassElement[]>(30 * 60 * 1000, 50);

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildOverpassQuery(params: SearchParams): string {
  const around = `(around:${Math.round(params.radius)},${params.lat.toFixed(6)},${params.lon.toFixed(6)})`;
  const filters = new Set(params.groups.flatMap((g) => getGroup(g).osm));
  const clauses = [...filters].map((f) => `  nwr${around}${f}["name"];`).join("\n");
  return `[out:json][timeout:90];\n(\n${clauses}\n);\nout center tags;`;
}

const first = (v?: string) => v?.split(";")[0]?.trim() || undefined;

export function elementToLead(el: OverpassElement, params: SearchParams, locality?: string): Lead | null {
  const tags = el.tags ?? {};
  const name = tags.name || tags["name:pt"] || tags.brand;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!name || lat === undefined || lon === undefined) return null;

  const cls = classifyOsm(tags);
  if (!cls || !params.groups.includes(cls.group)) return null;

  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const city = [tags["addr:postcode"], tags["addr:city"] || tags["addr:place"]].filter(Boolean).join(" ");
  const address = [street, city].filter(Boolean).join(", ") || undefined;

  const facebook = first(tags["contact:facebook"] || tags.facebook);
  const instagram = first(tags["contact:instagram"] || tags.instagram);
  const { website, socials } = splitWebsite([
    first(tags.website),
    first(tags["contact:website"]),
    first(tags.url),
    facebook ? (socialToUrl(facebook, "facebook") ?? undefined) : undefined,
    instagram ? (socialToUrl(instagram, "instagram") ?? undefined) : undefined,
  ]);

  const where = address || tags["addr:city"] || locality || `${lat},${lon}`;

  return {
    id: `osm:${el.type}/${el.id}`,
    source: "osm",
    name,
    category: labelFor(cls.value),
    group: cls.group,
    lat,
    lon,
    distance: Math.round(haversine(params, { lat, lon })),
    address,
    phone: first(tags.phone || tags["contact:phone"] || tags["contact:mobile"] || tags.mobile),
    email: first(tags.email || tags["contact:email"]),
    website,
    socials,
    openingHours: tags.opening_hours,
    mapsUrl: googleMapsSearchUrl(name, where),
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    isChain: Boolean(tags.brand || tags["brand:wikidata"]),
    brand: tags.brand,
  };
}

/** Overall time budget for all mirrors, kept below the route's maxDuration. */
const TOTAL_BUDGET_MS = 110_000;

async function runQuery(query: string): Promise<OverpassElement[]> {
  const errors: string[] = [];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  for (const endpoint of ENDPOINTS) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) break;
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        timeoutMs: Math.min(80_000, remaining),
        headers: {
          "User-Agent": APP_USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (!res.ok) {
        errors.push(`${new URL(endpoint).host}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
      if (json.remark && !json.elements?.length) {
        errors.push(`${new URL(endpoint).host}: ${json.remark}`);
        continue;
      }
      return json.elements ?? [];
    } catch (err) {
      errors.push(`${new URL(endpoint).host}: ${(err as Error).message}`);
    }
  }
  throw new UpstreamError(`Overpass (OpenStreetMap) indisponible — ${errors.join(" · ")}`, 502);
}

export async function searchOsm(params: SearchParams, locality?: string): Promise<SearchResponse> {
  const query = buildOverpassQuery(params);
  let elements = cache.get(query);
  let requests = 0;
  if (!elements) {
    elements = await runQuery(query);
    requests = 1;
    cache.set(query, elements);
  }

  const leads = elements
    .map((el) => elementToLead(el, params, locality))
    .filter((l): l is Lead => l !== null && l.distance <= params.radius * 1.05);

  let result = markChains(dedupeLeads(leads.sort((a, b) => a.distance - b.distance)));
  if (params.excludeChains) result = result.filter((l) => !l.isChain);

  const warnings: string[] = [];
  const withSite = result.filter((l) => l.website).length;
  if (result.length > 0 && withSite / result.length < 0.25) {
    warnings.push(
      "OpenStreetMap ne connaît pas toujours le site web des commerces : vérifiez les « sans site » avec le lien Google avant de démarcher, ou utilisez la source Google Places.",
    );
  }
  return { leads: result, warnings, requests };
}
