import { GENERIC_WORDS, STOP_WORDS, nameTokens, normalizeText } from "../text";

/** Webmail / ISP providers: an email there says nothing about a website. */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.pt", "hotmail.fr", "outlook.com", "outlook.pt", "live.com",
  "live.com.pt", "msn.com", "yahoo.com", "yahoo.pt", "yahoo.fr", "yahoo.com.br", "icloud.com", "me.com", "aol.com",
  "gmx.com", "gmx.net", "gmx.de", "protonmail.com", "proton.me", "sapo.pt", "iol.pt", "netcabo.pt", "clix.pt",
  "mail.telepac.pt", "telepac.pt", "vodafone.pt", "meo.pt", "net.novis.pt", "portugalmail.pt", "zonmail.pt",
  "oninet.pt", "netvisao.pt", "free.fr", "orange.fr", "wanadoo.fr", "laposte.net",
]);

const TLDS = ["pt", "com", "com.pt"];
const MAX_SLUGS = 8;

/** Domain of a business email, when it is a custom domain (info@casasilva.pt → casasilva.pt). */
export function emailDomain(email: string | undefined): string | null {
  const domain = email?.trim().toLowerCase().split("@")[1]?.replace(/[>\s].*$/, "");
  if (!domain || !domain.includes(".") || FREE_MAIL.has(domain)) return null;
  return domain;
}

/**
 * Plausible domain names ("slugs") for a business, most likely first.
 * "Restaurante O Pescador" (Lagos) → restauranteopescador, restaurante-o-pescador, opescador, pescador, pescadorlagos…
 */
export function nameSlugs(name: string, locality?: string): string[] {
  const { all, distinctive } = nameTokens(name);
  const meaningful = all.filter((t) => !STOP_WORDS.has(t));
  const city = locality ? normalizeText(locality).replace(/ /g, "") : "";

  // Without leading business-type words: "Restaurante O Pescador" → "o pescador".
  let start = 0;
  while (start < all.length - 1 && GENERIC_WORDS.has(all[start])) start++;
  const withoutType = all.slice(start);

  const raw = [
    all.join(""),
    all.join("-"),
    withoutType.join(""),
    meaningful.join(""),
    distinctive.join(""),
    distinctive.join("-"),
    city && `${all.join("")}${city}`,
    city && distinctive.length && `${distinctive.join("")}${city}`,
    city && `${meaningful.join("")}-${city}`,
  ];

  const slugs: string[] = [];
  for (const s of raw) {
    if (!s) continue;
    const slug = s.replace(/^-+|-+$/g, "");
    // Too short = too ambiguous ("ze.pt"); DNS labels are limited to 63 chars.
    if (slug.replace(/-/g, "").length < 5 || slug.length > 40) continue;
    if (!slugs.includes(slug)) slugs.push(slug);
  }
  return slugs.slice(0, MAX_SLUGS);
}

export interface Candidate {
  domain: string;
  method: "email" | "domain";
  /** False for single-word slugs ("lurdes.pt"), which may well belong to someone else. */
  specific: boolean;
}

/** Candidate hostnames to probe, best first. */
export function candidateDomains(name: string, locality?: string, email?: string): Candidate[] {
  const out: Candidate[] = [];
  const fromEmail = emailDomain(email);
  if (fromEmail) out.push({ domain: fromEmail, method: "email", specific: true });
  const singleWords = new Set(nameTokens(name).all);
  for (const slug of nameSlugs(name, locality)) {
    const specific = !singleWords.has(slug.replace(/-/g, ""));
    for (const tld of TLDS) {
      const domain = `${slug}.${tld}`;
      if (!out.some((c) => c.domain === domain)) out.push({ domain, method: "domain", specific });
    }
  }
  return out;
}
