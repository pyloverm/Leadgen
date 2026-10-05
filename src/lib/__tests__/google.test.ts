import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { haversine, offset } from "../geo";
import { searchGoogle } from "../providers/google";
import type { SearchParams } from "../types";

const params: SearchParams = {
  lat: 38.7223,
  lon: -9.1393,
  radius: 1000,
  groups: ["food"],
  source: "google",
  excludeChains: true,
};

interface Body {
  includedTypes: string[];
  locationRestriction: { circle: { center: { latitude: number; longitude: number }; radius: number } };
}

/** 60 fake restaurants spread over the 1 km circle. */
const PLACES = Array.from({ length: 60 }, (_, i) => {
  const p = offset(params, Math.cos(i) * 900 * ((i % 10) / 10), Math.sin(i) * 900 * ((i % 10) / 10));
  return {
    id: `place-${i}`,
    displayName: { text: i === 0 ? "McDonald's" : `Restaurante ${i}` },
    location: { latitude: p.lat, longitude: p.lon },
    primaryType: "restaurant",
    primaryTypeDisplayName: { text: "Restaurant" },
    websiteUri: i % 3 === 0 ? undefined : i % 3 === 1 ? `https://restaurante${i}.pt/` : `https://facebook.com/r${i}`,
    businessStatus: i === 5 ? "CLOSED_PERMANENTLY" : "OPERATIONAL",
  };
});

describe("searchGoogle", () => {
  const calls: Body[] = [];

  beforeEach(() => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as Body;
        calls.push(body);
        const { center, radius } = body.locationRestriction.circle;
        const inside = PLACES.filter(
          (p) => haversine({ lat: center.latitude, lon: center.longitude }, { lat: p.location.latitude, lon: p.location.longitude }) <= radius,
        );
        return Response.json({ places: inside.slice(0, 20) });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("subdivides saturated circles to collect more than 20 places", async () => {
    const res = await searchGoogle(params);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[0].includedTypes).toContain("restaurant");
    // 60 places - 1 closed - 1 chain (McDonald's)
    expect(res.leads.length).toBeGreaterThan(40);
    expect(res.leads.length).toBeLessThanOrEqual(58);
    expect(res.leads.find((l) => l.name === "McDonald's")).toBeUndefined();
    expect(res.leads.find((l) => l.id === "google:place-5")).toBeUndefined();
    const withSocialOnly = res.leads.find((l) => l.id === "google:place-2");
    expect(withSocialOnly).toMatchObject({ website: undefined, socials: ["https://facebook.com/r2"] });
    expect(new Set(res.leads.map((l) => l.id)).size).toBe(res.leads.length);
    expect(res.requests).toBe(calls.length);
  });

  it("respects the request budget", async () => {
    vi.stubEnv("GOOGLE_MAX_REQUESTS", "2");
    const res = await searchGoogle({ ...params, lat: 38.7224 });
    expect(calls.length).toBe(2);
    expect(res.warnings.join(" ")).toMatch(/Budget/);
  });
});
