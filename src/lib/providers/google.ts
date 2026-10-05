import { TtlCache } from "../cache";
import { classifyGoogleType, getGroup, labelFor } from "../categories";
import { haversine, offset } from "../geo";
import { markChains } from "../leads";
import type { CategoryGroupId, GeoPoint, Lead, SearchParams, SearchResponse } from "../types";
import { splitWebsite } from "../urls";
import { UpstreamError, fetchWithTimeout } from "./http";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const MAX_RESULTS = 20; // hard limit of the Places API (New) per request
const MAX_DEPTH = 3;
const MIN_SUB_RADIUS = 80;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.shortFormattedAddress",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
].join(",");

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  shortFormattedAddress?: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;
}

const cache = new TtlCache<GooglePlace[]>(60 * 60 * 1000, 2000);

export function isGoogleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

class Budget {
  used = 0;
  constructor(public max: number) {}
  take(): boolean {
    if (this.used >= this.max) return false;
    this.used++;
    return true;
  }
}

async function nearby(center: GeoPoint, radius: number, types: string[]): Promise<GooglePlace[]> {
  const res = await fetchWithTimeout(ENDPOINT, {
    method: "POST",
    timeoutMs: 20_000,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY ?? "",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: MAX_RESULTS,
      rankPreference: "DISTANCE",
      languageCode: "fr",
      regionCode: "PT",
      locationRestriction: {
        circle: { center: { latitude: center.lat, longitude: center.lon }, radius: Math.min(radius, 50_000) },
      },
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 403 || res.status === 401) {
      throw new UpstreamError(`Google Places refuse la clé API (${msg}). Vérifiez que « Places API (New) » est activée.`, res.status);
    }
    throw new UpstreamError(`Google Places : ${msg}`, res.status);
  }
  const json = (await res.json()) as { places?: GooglePlace[] };
  return json.places ?? [];
}

/**
 * The API returns at most 20 places per call. When a call is saturated we split the circle
 * into 4 smaller overlapping circles (quadtree) until results fit or the budget runs out.
 */
async function searchCircle(
  origin: SearchParams,
  center: GeoPoint,
  radius: number,
  types: string[],
  depth: number,
  budget: Budget,
  out: Map<string, { place: GooglePlace; group: CategoryGroupId }>,
  group: CategoryGroupId,
  warnings: Set<string>,
): Promise<void> {
  if (!budget.take()) {
    warnings.add("Budget de requêtes Google atteint : certains commerces peuvent manquer (augmentez GOOGLE_MAX_REQUESTS ou réduisez le rayon).");
    return;
  }
  const key = `${types.join(",")}|${center.lat.toFixed(5)},${center.lon.toFixed(5)}|${Math.round(radius)}`;
  let places = cache.get(key);
  if (!places) {
    places = await nearby(center, radius, types);
    cache.set(key, places);
  }
  for (const place of places) if (!out.has(place.id)) out.set(place.id, { place, group });

  const subRadius = radius * Math.SQRT1_2;
  if (places.length < MAX_RESULTS || depth >= MAX_DEPTH || subRadius < MIN_SUB_RADIUS) {
    if (places.length >= MAX_RESULTS) {
      warnings.add("Zone très dense : réduisez le rayon pour être sûr d'avoir tous les commerces.");
    }
    return;
  }
  const half = radius / 2;
  const children = [
    offset(center, -half, half),
    offset(center, half, half),
    offset(center, -half, -half),
    offset(center, half, -half),
  ].filter((c) => haversine(origin, c) - subRadius < origin.radius);

  for (const child of children) {
    await searchCircle(origin, child, subRadius, types, depth + 1, budget, out, group, warnings);
  }
}

function toLead(place: GooglePlace, fallbackGroup: CategoryGroupId, origin: SearchParams): Lead | null {
  const name = place.displayName?.text;
  if (!name || !place.location) return null;
  if (place.businessStatus === "CLOSED_PERMANENTLY") return null;
  const lat = place.location.latitude;
  const lon = place.location.longitude;
  const { website, socials } = splitWebsite([place.websiteUri]);
  return {
    id: `google:${place.id}`,
    source: "google",
    name,
    category: place.primaryTypeDisplayName?.text ?? (place.primaryType ? labelFor(place.primaryType) : "Commerce"),
    group: classifyGoogleType(place.primaryType, fallbackGroup),
    lat,
    lon,
    distance: Math.round(haversine(origin, { lat, lon })),
    address: place.shortFormattedAddress ?? place.formattedAddress,
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber,
    website,
    socials,
    rating: place.rating,
    ratingCount: place.userRatingCount,
    mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    isChain: false,
  };
}

export async function searchGoogle(params: SearchParams): Promise<SearchResponse> {
  if (!isGoogleEnabled()) throw new UpstreamError("GOOGLE_PLACES_API_KEY n'est pas configurée.", 400);

  const budget = new Budget(Number(process.env.GOOGLE_MAX_REQUESTS) || 60);
  const out = new Map<string, { place: GooglePlace; group: CategoryGroupId }>();
  const warnings = new Set<string>();

  for (const groupId of params.groups) {
    const group = getGroup(groupId);
    try {
      await searchCircle(params, params, params.radius, group.google, 0, budget, out, groupId, warnings);
    } catch (err) {
      // An unsupported type makes the whole request fail: retry with the conservative list.
      if (err instanceof UpstreamError && err.status === 400) {
        await searchCircle(params, params, params.radius, group.googleCore, 0, budget, out, groupId, warnings);
      } else {
        throw err;
      }
    }
  }

  let leads = [...out.values()]
    .map(({ place, group }) => toLead(place, group, params))
    .filter((l): l is Lead => l !== null && l.distance <= params.radius * 1.02)
    .sort((a, b) => a.distance - b.distance);

  leads = markChains(leads);
  if (params.excludeChains) leads = leads.filter((l) => !l.isChain);

  return { leads, warnings: [...warnings], requests: budget.used };
}
