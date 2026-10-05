import type { NextRequest } from "next/server";
import { badRequest, errorResponse } from "@/lib/api";
import { geocode, reverseGeocode } from "@/lib/providers/nominatim";

/**
 * GET /api/geocode?q=Lagos            → list of matching places in Portugal
 * GET /api/geocode?lat=37.1&lon=-8.67 → reverse geocoding of a point
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const lat = params.get("lat");
    const lon = params.get("lon");
    if (lat && lon) {
      const result = await reverseGeocode({ lat: Number(lat), lon: Number(lon) });
      return Response.json({ results: result ? [result] : [] });
    }
    const q = params.get("q")?.trim();
    if (!q || q.length < 2) return badRequest("Indiquez un lieu (ville, quartier, adresse…)");
    return Response.json({ results: await geocode(q) });
  } catch (err) {
    return errorResponse(err);
  }
}
