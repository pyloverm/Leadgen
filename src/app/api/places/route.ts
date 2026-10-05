import { badRequest, errorResponse } from "@/lib/api";
import { ALL_GROUP_IDS } from "@/lib/categories";
import { isInPortugal } from "@/lib/geo";
import { searchOsm } from "@/lib/providers/overpass";
import type { CategoryGroupId, SearchParams } from "@/lib/types";

export const maxDuration = 120;

const MAX_RADIUS = 15_000;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as (Partial<SearchParams> & { locality?: string }) | null;
  if (!body) return badRequest("Requête invalide");

  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const radius = Math.round(Number(body.radius));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return badRequest("Coordonnées invalides");
  if (!isInPortugal({ lat, lon })) return badRequest("Le point choisi n'est pas au Portugal");
  if (!Number.isFinite(radius) || radius < 50 || radius > MAX_RADIUS) {
    return badRequest(`Le rayon doit être compris entre 50 m et ${MAX_RADIUS / 1000} km`);
  }
  const groups = (body.groups ?? []).filter((g): g is CategoryGroupId => ALL_GROUP_IDS.includes(g));
  if (!groups.length) return badRequest("Choisissez au moins une catégorie");

  const params: SearchParams = {
    lat,
    lon,
    radius,
    groups,
    excludeChains: Boolean(body.excludeChains),
  };

  try {
    return Response.json(await searchOsm(params, body.locality));
  } catch (err) {
    return errorResponse(err);
  }
}
