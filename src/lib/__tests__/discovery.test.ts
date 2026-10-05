import { describe, expect, it } from "vitest";
import { candidateDomains, emailDomain, nameSlugs } from "../discovery/candidates";
import { matchPage, snapshotFromHtml } from "../discovery/verify";
import { buildLeadView, leadPotential } from "../leads";
import type { DiscoveryInput, Lead } from "../types";

describe("candidate domains", () => {
  it("derives slugs from the business name", () => {
    const slugs = nameSlugs("Restaurante O Pescador", "Lagos");
    expect(slugs.slice(0, 3)).toEqual(["restauranteopescador", "restaurante-o-pescador", "opescador"]);
    expect(slugs).toContain("pescador");
    expect(slugs).toContain("pescadorlagos");
    expect(slugs.length).toBeLessThanOrEqual(8);
  });

  it("handles accents, apostrophes and short names", () => {
    expect(nameSlugs("Tasca do Zé")).toEqual(["tascadoze", "tasca-do-ze", "tascaze"]);
    expect(nameSlugs("Pão d'Ouro")[0]).toBe("paodouro");
    expect(nameSlugs("Zé")).toEqual([]);
  });

  it("uses custom email domains first and ignores webmail", () => {
    expect(emailDomain("info@casasilva.pt")).toBe("casasilva.pt");
    expect(emailDomain("casasilva@sapo.pt")).toBeNull();
    expect(emailDomain("casa.silva@gmail.com")).toBeNull();
    const c = candidateDomains("Casa Silva", "Lagos", "reservas@restaurante-silva.com");
    expect(c[0]).toEqual({ domain: "restaurante-silva.com", method: "email", specific: true });
    expect(c.map((x) => x.domain)).toEqual(expect.arrayContaining(["casasilva.pt", "casasilva.com", "casasilva.com.pt"]));
  });
});

const input: DiscoveryInput = { name: "O Pescador", city: "Lagos", postcode: "8600-763", phone: "+351 282 123 456" };

const page = (body: string, title = "O Pescador | Restaurante", url = "https://opescador.pt/") =>
  snapshotFromHtml(url, `<html><head><title>${title}</title></head><body>${body}</body></html>`);

describe("page verification", () => {
  it("accepts a page with the same phone number", () => {
    const m = matchPage(page('<p>Reservas: <a href="tel:282123456">282 123 456</a></p>'), input, "domain");
    expect(m).toMatchObject({ kind: "match", confidence: "high" });
    expect(m.evidence).toContain("Même numéro de téléphone");
  });

  it("accepts name + town", () => {
    const m = matchPage(page("<p>Peixe fresco no centro de Lagos, Algarve.</p>"), input, "domain");
    expect(m).toMatchObject({ kind: "match", confidence: "high" });
  });

  it("is only medium-confident with the name alone", () => {
    const m = matchPage(page("<p>Peixe fresco no Porto.</p>", "O Pescador"), { name: "O Pescador" }, "domain");
    expect(m).toMatchObject({ kind: "match", confidence: "medium" });
  });

  it("rejects an unrelated business on a guessed domain", () => {
    const m = matchPage(page("<p>Consultoria informática em Braga.</p>", "Silva & Filhos"), input, "domain");
    expect(m.kind).toBe("no");
  });

  it("reports parked domains", () => {
    const m = matchPage(page("<h1>This domain is for sale</h1>", "opescador.pt"), input, "domain");
    expect(m.kind).toBe("parked");
  });

  it("trusts the email domain", () => {
    const m = matchPage(page("<p>Bem-vindo</p>", "Início"), input, "email");
    expect(m).toMatchObject({ kind: "match", confidence: "medium" });
  });
});

describe("lead potential", () => {
  const lead: Lead = {
    id: "osm:node/1",
    name: "Casa Azul",
    category: "Maison d'hôtes",
    group: "lodging",
    lat: 0,
    lon: 0,
    distance: 0,
    phone: "912345678",
    socials: [],
    mapsUrl: "",
    isChain: false,
  };

  it("ranks missing websites above good websites", () => {
    expect(leadPotential(lead, "none")).toBeGreaterThanOrEqual(80);
    expect(leadPotential(lead, "good")).toBeLessThan(40);
    expect(leadPotential({ ...lead, isChain: true }, "none")).toBeLessThan(70);
    expect(leadPotential(lead, "searching")).toBeNull();
  });

  it("uses the discovered website", () => {
    const view = buildLeadView(
      lead,
      { [lead.id]: { website: "https://casaazul.pt/", confidence: "high", method: "domain", evidence: [], parked: [], checked: 9, checkedAt: "" } },
      {},
    );
    expect(view).toMatchObject({ website: "https://casaazul.pt/", discovered: true, status: "pending", potential: null });
  });

  it("boosts leads whose domain is parked", () => {
    const parked = { evidence: [], parked: ["casaazul.pt"], checked: 9, checkedAt: "" };
    const plain = { ...parked, parked: [] };
    expect(leadPotential(lead, "none", undefined, parked)!).toBeGreaterThan(leadPotential(lead, "none", undefined, plain)!);
  });
});

describe("area codes", () => {
  const lagos = { name: "O Pescador", city: "Lagos", lat: 37.1028, lon: -8.6731 };

  it("rejects a homonym whose landline is in another region", () => {
    const m = matchPage(page('<p>Reservas: <a href="tel:+351289586834">289 586 834</a> · Praia de Faro</p>'), lagos, "domain");
    expect(m.kind).toBe("no");
    expect(m.rejectedBecause).toMatch(/289.*Faro/);
  });

  it("uses a landline from the same area as supporting evidence", () => {
    const m = matchPage(page('<p>Ligue <a href="tel:282 760 000">282 760 000</a></p>', "O Pescador"), lagos, "domain");
    expect(m).toMatchObject({ kind: "match", confidence: "medium" });
    expect(m.evidence.join(" ")).toMatch(/282 Portimão/);
  });

  it("knows Portuguese area codes", async () => {
    const { phoneArea } = await import("../phone-regions");
    expect(phoneArea("+351 21 123 4567")?.town).toBe("Lisboa");
    expect(phoneArea("282 123 456")?.town).toBe("Portimão");
    expect(phoneArea("912 345 678")).toBeNull();
  });

  it("does not report single-word parked domains", () => {
    const c = candidateDomains("Cabeleireiro Lurdes", "Lagos");
    expect(c.find((x) => x.domain === "lurdes.pt")?.specific).toBe(false);
    expect(c.find((x) => x.domain === "cabeleireirolurdes.pt")?.specific).toBe(true);
  });
});
