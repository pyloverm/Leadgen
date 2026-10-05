import type { GeoPoint } from "./types";

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters. */
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Move a point by a (dx, dy) offset in meters (east, north). */
export function offset(p: GeoPoint, dxMeters: number, dyMeters: number): GeoPoint {
  const dLat = dyMeters / EARTH_RADIUS_M;
  const dLon = dxMeters / (EARTH_RADIUS_M * Math.cos(toRad(p.lat)));
  return { lat: p.lat + (dLat * 180) / Math.PI, lon: p.lon + (dLon * 180) / Math.PI };
}

/** Parses "38.7223, -9.1393" style input. */
export function parseCoordinates(input: string): GeoPoint | null {
  const m = input.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Rough bounding box of Portugal (mainland, Madeira and the Azores). */
export function isInPortugal({ lat, lon }: GeoPoint): boolean {
  const mainland = lat >= 36.8 && lat <= 42.2 && lon >= -9.6 && lon <= -6.1;
  const madeira = lat >= 32.3 && lat <= 33.2 && lon >= -17.4 && lon <= -16.2;
  const azores = lat >= 36.8 && lat <= 39.8 && lon >= -31.4 && lon <= -24.9;
  return mainland || madeira || azores;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
