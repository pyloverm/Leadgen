import { fetchWithTimeout } from "../providers/http";
import type { PageSpeedResult } from "../types";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface LighthouseResponse {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null }>;
    audits?: Record<string, { numericValue?: number }>;
  };
  error?: { message?: string };
}

const pct = (score: number | null | undefined) => (typeof score === "number" ? Math.round(score * 100) : undefined);

/** Google PageSpeed Insights (Lighthouse, mobile). Works without a key, with a low quota. */
export async function runPageSpeed(url: string): Promise<PageSpeedResult> {
  const params = new URLSearchParams({ url, strategy: "mobile" });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) params.append("category", c);
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set("key", key);

  const res = await fetchWithTimeout(`${ENDPOINT}?${params}`, { timeoutMs: 90_000 });
  const json = (await res.json().catch(() => ({}))) as LighthouseResponse;
  if (!res.ok || !json.lighthouseResult) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    return {
      url,
      strategy: "mobile",
      error: res.status === 429 ? "Quota PageSpeed dépassé : ajoutez PAGESPEED_API_KEY dans .env.local" : `PageSpeed : ${msg}`,
    };
  }
  const cats = json.lighthouseResult.categories ?? {};
  const audits = json.lighthouseResult.audits ?? {};
  return {
    url,
    strategy: "mobile",
    performance: pct(cats.performance?.score),
    accessibility: pct(cats.accessibility?.score),
    bestPractices: pct(cats["best-practices"]?.score),
    seo: pct(cats.seo?.score),
    lcpMs: audits["largest-contentful-paint"]?.numericValue,
    cls: audits["cumulative-layout-shift"]?.numericValue,
  };
}
