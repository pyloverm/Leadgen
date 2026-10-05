/**
 * Domains that are not a "real" website for a business: social networks, link-in-bio
 * pages, marketplaces / directories, and the discontinued Google Business Profile sites.
 */
const NOT_A_WEBSITE = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
  "linktr.ee",
  "linkin.bio",
  "wa.me",
  "whatsapp.com",
  "tripadvisor.com",
  "tripadvisor.pt",
  "tripadvisor.fr",
  "booking.com",
  "airbnb.com",
  "airbnb.pt",
  "thefork.com",
  "thefork.pt",
  "ubereats.com",
  "glovoapp.com",
  "zomato.com",
  "google.com",
  "goo.gl",
  "g.page",
  "business.site",
  "negocio.site",
  "yelp.com",
  "olx.pt",
  "custojusto.pt",
];

const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Adds a scheme when missing and trims junk. Returns null when it is not a usable URL. */
export function normalizeUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = raw.trim().split(/[;\s]/)[0];
  if (!s) return null;
  if (s.startsWith("//")) s = `https:${s}`;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** True for Facebook pages, Instagram, TripAdvisor listings, etc. */
export function isNotARealWebsite(url: string): boolean {
  const host = hostOf(url);
  return host ? matchesDomain(host, NOT_A_WEBSITE) : false;
}

export function isSocialUrl(url: string): boolean {
  const host = hostOf(url);
  return host ? matchesDomain(host, SOCIAL_HOSTS) : false;
}

/** Turns an OSM `contact:facebook=pagename` style value into a URL. */
export function socialToUrl(value: string, network: "facebook" | "instagram"): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.includes(".com")) return normalizeUrl(v);
  const handle = v.replace(/^@/, "");
  return `https://www.${network}.com/${handle}`;
}

/** Splits candidate URLs into a single real website and a list of social/directory links. */
export function splitWebsite(candidates: (string | undefined)[]): { website?: string; socials: string[] } {
  let website: string | undefined;
  const socials: string[] = [];
  for (const candidate of candidates) {
    const url = normalizeUrl(candidate);
    if (!url) continue;
    if (isNotARealWebsite(url)) {
      if (!socials.includes(url)) socials.push(url);
    } else if (!website) {
      website = url;
    }
  }
  return { website, socials };
}

export function displayHost(url: string): string {
  const host = hostOf(url);
  return host ?? url;
}
