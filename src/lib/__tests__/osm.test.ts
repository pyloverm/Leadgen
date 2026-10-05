import { describe, expect, it } from "vitest";
import { classifyOsm } from "../categories";
import { haversine, isInPortugal, parseCoordinates } from "../geo";
import { dedupeLeads, markChains, opportunity, websiteStatus } from "../leads";
import { buildOverpassQuery, elementToLead } from "../providers/overpass";
import type { Lead, SearchParams } from "../types";
import { isNotARealWebsite, normalizeUrl, splitWebsite } from "../urls";

const params: SearchParams = {
  lat: 37.1028,
  lon: -8.6731,
  radius: 500,
  groups: ["food", "shops", "health_beauty"],
  source: "osm",
  excludeChains: false,
};

describe("urls", () => {
  it("normalizes websites", () => {
    expect(normalizeUrl("www.casasilva.pt")).toBe("https://www.casasilva.pt/");
    expect(normalizeUrl("http://casasilva.pt/menu")).toBe("http://casasilva.pt/menu");
    expect(normalizeUrl("casasilva.pt; www.other.pt")).toBe("https://casasilva.pt/");
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });

  it("separates social pages from real websites", () => {
    expect(isNotARealWebsite("https://www.facebook.com/casasilva")).toBe(true);
    expect(isNotARealWebsite("https://casasilva.business.site")).toBe(true);
    expect(isNotARealWebsite("https://casasilva.pt")).toBe(false);
    expect(splitWebsite(["https://facebook.com/x", "casasilva.pt"])).toEqual({
      website: "https://casasilva.pt/",
      socials: ["https://facebook.com/x"],
    });
  });
});

describe("geo", () => {
  it("parses coordinates", () => {
    expect(parseCoordinates("38.7223, -9.1393")).toEqual({ lat: 38.7223, lon: -9.1393 });
    expect(parseCoordinates("Lisboa")).toBeNull();
  });
  it("knows Portugal", () => {
    expect(isInPortugal({ lat: 38.72, lon: -9.14 })).toBe(true); // Lisboa
    expect(isInPortugal({ lat: 32.65, lon: -16.9 })).toBe(true); // Funchal
    expect(isInPortugal({ lat: 37.74, lon: -25.67 })).toBe(true); // Ponta Delgada
    expect(isInPortugal({ lat: 40.41, lon: -3.7 })).toBe(false); // Madrid
  });
  it("computes distances", () => {
    const d = haversine({ lat: 38.7223, lon: -9.1393 }, { lat: 41.1579, lon: -8.6291 });
    expect(d).toBeGreaterThan(270_000);
    expect(d).toBeLessThan(280_000);
  });
});

describe("overpass", () => {
  it("builds one clause per filter", () => {
    const q = buildOverpassQuery(params);
    expect(q).toContain('nwr(around:500,37.102800,-8.673100)["shop"]["name"];');
    expect(q).toContain('["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten|food_court)$"]');
    expect(q).toContain("out center tags;");
  });

  it("classifies OSM tags", () => {
    expect(classifyOsm({ amenity: "restaurant" })).toEqual({ group: "food", value: "restaurant" });
    expect(classifyOsm({ shop: "hairdresser" })).toEqual({ group: "health_beauty", value: "hairdresser" });
    expect(classifyOsm({ shop: "car_repair" })).toEqual({ group: "auto", value: "car_repair" });
    expect(classifyOsm({ shop: "vacant" })).toBeNull();
    expect(classifyOsm({ amenity: "bench" })).toBeNull();
  });

  it("maps an element to a lead", () => {
    const lead = elementToLead(
      {
        type: "way",
        id: 42,
        center: { lat: 37.1031, lon: -8.6735 },
        tags: {
          amenity: "restaurant",
          name: "Casa Silva",
          "addr:street": "Rua 25 de Abril",
          "addr:housenumber": "12",
          "addr:postcode": "8600-763",
          "addr:city": "Lagos",
          phone: "+351 282 123 456;+351 912 345 678",
          "contact:facebook": "casasilvalagos",
        },
      },
      params,
    );
    expect(lead).toMatchObject({
      id: "osm:way/42",
      name: "Casa Silva",
      category: "Restaurant",
      group: "food",
      address: "Rua 25 de Abril 12, 8600-763 Lagos",
      phone: "+351 282 123 456",
      website: undefined,
      socials: ["https://www.facebook.com/casasilvalagos"],
      isChain: false,
    });
    expect(lead!.distance).toBeLessThan(100);
    expect(websiteStatus(lead!, undefined, false)).toBe("social");
    expect(opportunity("social")).toBe("hot");
  });

  it("ignores categories that were not requested", () => {
    const el = { type: "node" as const, id: 1, lat: 37.1, lon: -8.67, tags: { tourism: "hotel", name: "Hotel X" } };
    expect(elementToLead(el, params)).toBeNull();
  });
});

describe("leads", () => {
  const lead = (over: Partial<Lead>): Lead => ({
    id: Math.random().toString(),
    source: "osm",
    name: "X",
    category: "Café",
    group: "food",
    lat: 37.1,
    lon: -8.67,
    distance: 0,
    socials: [],
    mapsUrl: "",
    isChain: false,
    ...over,
  });

  it("merges duplicates mapped twice", () => {
    const out = dedupeLeads([
      lead({ name: "Café Central", phone: "1" }),
      lead({ name: "Cafe central", lat: 37.1002, website: "https://cafe.pt/" }),
      lead({ name: "Café Central", lat: 37.11 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ phone: "1", website: "https://cafe.pt/" });
  });

  it("flags chains", () => {
    const out = markChains([lead({ name: "Pingo Doce Lagos" }), lead({ name: "Tasca do Zé" })]);
    expect(out.map((l) => l.isChain)).toEqual([true, false]);
  });
});
