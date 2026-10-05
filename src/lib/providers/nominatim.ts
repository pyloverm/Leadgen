import { TtlCache } from "../cache";
import { parseCoordinates } from "../geo";
import type { GeocodeResult, GeoPoint } from "../types";
import { APP_USER_AGENT, UpstreamError, fetchWithTimeout } from "./http";

const BASE = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const cache = new TtlCache<GeocodeResult[]>(24 * 60 * 60 * 1000);

interface NominatimItem {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  addresstype?: string;
  type?: string;
  address?: Record<string, string>;
}

function toResult(item: NominatimItem): GeocodeResult {
  const a = item.address ?? {};
  const locality =
    a.city || a.town || a.village || a.municipality || a.suburb || a.county || item.name || item.display_name;
  return {
    lat: Number(item.lat),
    lon: Number(item.lon),
    label: item.display_name.replace(/,\s*Portugal$/, ""),
    locality: locality.split(",")[0],
    type: item.addresstype || item.type,
  };
}

async function call(path: string, params: Record<string, string>): Promise<unknown> {
  const url = `${BASE}${path}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params })}`;
  const res = await fetchWithTimeout(url, {
    timeoutMs: 15_000,
    headers: { "User-Agent": APP_USER_AGENT, "Accept-Language": "pt-PT,pt,fr,en" },
  });
  if (!res.ok) throw new UpstreamError(`Nominatim a répondu ${res.status}`, res.status);
  return res.json();
}

/** Geocodes a free-text place, restricted to Portugal. Also accepts "lat, lon". */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  const coords = parseCoordinates(q);
  if (coords) {
    const reverse = await reverseGeocode(coords).catch(() => null);
    return [{ ...coords, label: reverse?.label ?? q, locality: reverse?.locality ?? q }];
  }

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const items = (await call("/search", { q, countrycodes: "pt", limit: "6" })) as NominatimItem[];
  const results = items.map(toResult);
  cache.set(key, results);
  return results;
}

export async function reverseGeocode(p: GeoPoint): Promise<GeocodeResult | null> {
  const key = `rev:${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached) return cached[0] ?? null;

  const item = (await call("/reverse", { lat: String(p.lat), lon: String(p.lon), zoom: "16" })) as
    | NominatimItem
    | { error: string };
  if ("error" in item) return null;
  const result = { ...toResult(item), lat: p.lat, lon: p.lon };
  cache.set(key, [result]);
  return result;
}
