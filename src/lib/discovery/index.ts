import { Resolver } from "node:dns/promises";
import { safeFetch } from "../audit/safe-fetch";
import { TtlCache } from "../cache";
import { normalizeText } from "../text";
import type { DiscoveryInput, DiscoveryResult } from "../types";
import { candidateDomains } from "./candidates";
import { matchPage, snapshotFromHtml } from "./verify";

const cache = new TtlCache<DiscoveryResult>(24 * 60 * 60 * 1000, 5000);
const resolver = new Resolver({ timeout: 2500, tries: 2 });

const DNS_CONCURRENCY = 10;
const MAX_PAGES = 6;
const PAGE_BATCH = 3;

const baseDomain = (host: string) => host.replace(/^www\./, "");

async function resolves(host: string): Promise<boolean> {
  try {
    return (await resolver.resolve4(host)).length > 0;
  } catch {
    return false;
  }
}

/** Returns the host to use ("x.pt" or "www.x.pt") when the domain points to a server. */
async function liveHost(domain: string): Promise<string | null> {
  const [apex, www] = await Promise.all([resolves(domain), resolves(`www.${domain}`)]);
  return www ? `www.${domain}` : apex ? domain : null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function fetchHome(host: string) {
  try {
    return await safeFetch(`https://${host}/`, { timeoutMs: 8000, maxBytes: 1_500_000 });
  } catch {
    // Parked and abandoned domains often have no (valid) certificate.
    return safeFetch(`http://${host}/`, { timeoutMs: 8000, maxBytes: 1_500_000 }).catch(() => null);
  }
}

/**
 * Looks for the website of a business that OpenStreetMap doesn't know, for free:
 * 1. the domain of its email address (info@casasilva.pt → casasilva.pt);
 * 2. domains derived from its name (opescador.pt, restauranteopescador.com…), checked in DNS;
 * then each live domain is fetched and its content compared with the business (name, phone, town).
 */
export async function discoverWebsite(input: DiscoveryInput): Promise<DiscoveryResult> {
  const key = [normalizeText(input.name), normalizeText(input.city || input.locality || ""), input.email ?? ""].join("|");
  const cached = cache.get(key);
  if (cached) return cached;

  const candidates = candidateDomains(input.name, input.city || input.locality, input.email);
  const hosts = await mapLimit(candidates, DNS_CONCURRENCY, (c) => liveHost(c.domain));
  const live = candidates.flatMap((c, i) => (hosts[i] ? [{ ...c, host: hosts[i]! }] : []));

  const parked: string[] = [];
  const rejected: string[] = [];
  let medium: DiscoveryResult | undefined;
  let result: DiscoveryResult | undefined;

  // Pages are fetched a few at a time but evaluated in priority order (email domain first, then best slugs).
  const toFetch = live.slice(0, MAX_PAGES);
  for (let i = 0; i < toFetch.length && !result; i += PAGE_BATCH) {
    const batch = toFetch.slice(i, i + PAGE_BATCH);
    const pages = await Promise.all(batch.map((c) => fetchHome(c.host)));
    for (const [j, c] of batch.entries()) {
      const page = pages[j];
      if (!page || page.status >= 400) continue;
      const match = matchPage(snapshotFromHtml(page.finalUrl, page.body), input, c.method);
      if (match.kind === "parked") {
        // A parked "lurdes.pt" says nothing about "Cabeleireiro Lurdes"; "cabeleireirolurdes.pt" does.
        if (c.specific) parked.push(c.domain);
        continue;
      }
      if (match.rejectedBecause) rejected.push(`${c.domain} : ${match.rejectedBecause}`);
      if (match.kind !== "match") continue;
      const finalHost = new URL(page.finalUrl).hostname;
      const evidence =
        baseDomain(finalHost) === baseDomain(c.host) ? match.evidence : [...match.evidence, `${c.domain} redirige vers ${finalHost}`];
      const found: DiscoveryResult = {
        website: page.finalUrl,
        confidence: match.confidence,
        method: c.method,
        evidence,
        parked,
        rejected,
        checked: candidates.length,
        checkedAt: new Date().toISOString(),
      };
      if (match.confidence === "high") {
        result = found;
        break;
      }
      medium ??= found;
    }
  }

  result ??= medium ?? { evidence: [], parked, rejected, checked: candidates.length, checkedAt: new Date().toISOString() };
  result.parked = parked;
  result.rejected = rejected;
  cache.set(key, result);
  return result;
}
