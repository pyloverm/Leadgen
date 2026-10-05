import { TtlCache } from "../cache";
import { APP_USER_AGENT, fetchWithTimeout } from "../providers/http";
import type { SiteHistory } from "../types";

const CDX = "https://web.archive.org/cdx/search/cdx";
const cache = new TtlCache<SiteHistory | null>(24 * 60 * 60 * 1000, 3000);

// The Internet Archive is a free public service: keep the pressure low.
const MAX_CONCURRENT = 3;
let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  // A finishing task hands its slot directly to the next waiting one.
  if (running >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  else running++;
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

const month = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}`;

/**
 * Turns CDX rows ([timestamp, digest], one per month, oldest first) into a history.
 * The digest is a hash of the page: identical digests mean the homepage did not change at all.
 */
export function historyFromCdx(rows: string[][]): SiteHistory | null {
  const data = rows.filter((r) => /^\d{14}$/.test(r[0] ?? ""));
  if (!data.length) return null;
  const lastDigest = data[data.length - 1][1];
  let i = data.length - 1;
  while (i > 0 && data[i - 1][1] === lastDigest) i--;
  return {
    firstSeen: month(data[0][0]),
    lastCapture: month(data[data.length - 1][0]),
    unchangedSince: month(data[i][0]),
    captures: data.length,
  };
}

/** Free homepage history from the Wayback Machine. Returns null when unknown or unavailable. */
export async function siteHistory(url: string): Promise<SiteHistory | null> {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const cached = cache.get(host);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams({
    url: `${host}/`,
    output: "json",
    fl: "timestamp,digest",
    filter: "statuscode:200",
    collapse: "timestamp:6",
    limit: "1000",
  });
  try {
    const history = await withSlot(async () => {
      const res = await fetchWithTimeout(`${CDX}?${params}`, { timeoutMs: 8000, headers: { "User-Agent": APP_USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return historyFromCdx(text.trim() ? (JSON.parse(text) as string[][]) : []);
    });
    cache.set(host, history);
    return history;
  } catch {
    return null; // not cached: a later audit may succeed
  }
}
