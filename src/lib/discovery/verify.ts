import * as cheerio from "cheerio";
import { detectParked } from "../audit/analyze";
import { SAME_AREA_KM, areaDistanceKm, phoneArea } from "../phone-regions";
import { STOP_WORDS, digitsOnly, nameTokens, normalizeText, phoneKey } from "../text";
import type { DiscoveryInput } from "../types";
import { isNotARealWebsite } from "../urls";

export interface PageSnapshot {
  finalUrl: string;
  /** Title, H1 and og:site_name. */
  heading: string;
  text: string;
  /** Phone numbers found in tel: links and in the text (digits only). */
  phones: string[];
  parked: string | null;
}

export interface PageMatch {
  kind: "match" | "parked" | "no";
  confidence?: "high" | "medium";
  evidence: string[];
  /** Set when the page is clearly another business with the same name. */
  rejectedBecause?: string;
}

const PHONE_RE = /(?:\+|00)?\d[\d\s.()-]{7,16}\d/g;

export function snapshotFromHtml(finalUrl: string, html: string): PageSnapshot {
  const $ = cheerio.load(html);
  const title = $("title").first().text();
  const heading = [title, $("h1").first().text(), $('meta[property="og:site_name"]').attr("content") ?? ""].join(" ");
  const phones = new Set<string>();
  $('a[href^="tel:" i]').each((_, el) => {
    phones.add(digitsOnly($(el).attr("href") ?? ""));
  });
  $("script, style, noscript, template, svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 80_000);
  for (const m of text.matchAll(PHONE_RE)) phones.add(digitsOnly(m[0]));
  return { finalUrl, heading, text, phones: [...phones].filter((p) => p.length >= 9), parked: detectParked(title, text, html) };
}

const hasWord = (haystack: string, word: string) => ` ${haystack} `.includes(` ${word} `);

/** Decides whether a page is the website of the given business, and how sure we are. */
export function matchPage(page: PageSnapshot, input: DiscoveryInput, method: "email" | "domain"): PageMatch {
  if (isNotARealWebsite(page.finalUrl)) return { kind: "no", evidence: [] };
  if (page.parked) return { kind: "parked", evidence: [page.parked] };

  const heading = normalizeText(page.heading);
  const body = `${heading} ${normalizeText(page.text)}`;
  const { all, distinctive } = nameTokens(input.name);
  const tokens = distinctive.length ? distinctive : all.filter((t) => !STOP_WORDS.has(t) && t.length >= 3);
  const found = tokens.filter((t) => hasWord(body, t));
  const nameRatio = tokens.length ? found.length / tokens.length : 0;
  const fullName = normalizeText(input.name);
  const fullInHeading = fullName.length >= 4 && hasWord(heading, fullName);

  const phone = phoneKey(input.phone);
  const phoneMatch = Boolean(phone && page.phones.some((p) => p.endsWith(phone)));
  const city = normalizeText(input.city || input.locality || "");
  const cityMatch = city.length >= 3 && hasWord(body, city);
  const postcode = input.postcode?.match(/^(\d{4})-?(\d{3})?/);
  const postcodeMatch = Boolean(postcode && new RegExp(`\\b${postcode[1]}[- ]?${postcode[2] ?? "\\d{3}"}\\b`).test(page.text));

  const evidence: string[] = [];
  if (method === "email") evidence.push("Même domaine que l'email de contact");
  if (phoneMatch) evidence.push("Même numéro de téléphone");
  if (fullInHeading) evidence.push("Nom exact dans le titre");
  else if (nameRatio === 1) evidence.push("Nom présent sur la page");
  if (cityMatch) evidence.push(`Ville « ${input.city || input.locality} » mentionnée`);
  if (postcodeMatch) evidence.push("Même code postal");

  // Landline area codes tell where the business on the page is: 282 = Portimão/Lagos, 289 = Faro…
  const here = input.lat !== undefined && input.lon !== undefined ? { lat: input.lat, lon: input.lon } : null;
  const areas = here ? page.phones.map(phoneArea).filter((a) => a !== null) : [];
  const localArea = here ? areas.find((a) => areaDistanceKm(a, here) <= SAME_AREA_KM) : undefined;
  const foreignArea = here && !localArea ? areas.find((a) => areaDistanceKm(a, here) > SAME_AREA_KM) : undefined;
  if (localArea && !phoneMatch) evidence.push(`Téléphone de la même région (indicatif ${localArea.code} ${localArea.town})`);

  if (foreignArea && !phoneMatch && !cityMatch && method === "domain") {
    const homonym = nameRatio >= 0.5;
    return {
      kind: "no",
      evidence,
      rejectedBecause: homonym
        ? `autre établissement du même nom (téléphone ${foreignArea.code}, région de ${foreignArea.town})`
        : undefined,
    };
  }

  // An area code covers a whole district: it supports a match but is not proof on its own.
  const localMatch = cityMatch || postcodeMatch;
  if (method === "email") {
    return { kind: "match", confidence: nameRatio >= 0.5 || phoneMatch || localMatch || localArea ? "high" : "medium", evidence };
  }
  if (phoneMatch && nameRatio > 0) return { kind: "match", confidence: "high", evidence };
  if (nameRatio === 1 && localMatch) return { kind: "match", confidence: "high", evidence };
  if (nameRatio === 1 && (fullInHeading || localArea)) return { kind: "match", confidence: "medium", evidence };
  return { kind: "no", evidence };
}
