import { TtlCache } from "../cache";
import type { AuditResult } from "../types";
import { isNotARealWebsite, normalizeUrl } from "../urls";
import { analyzeHtml } from "./analyze";
import { inspectAssets } from "./assets";
import { FetchError, safeFetch, type FetchedPage } from "./safe-fetch";
import { siteHistory } from "./wayback";

/** Resolves to `fallback` if the promise takes too long or fails: extras must never block an audit. */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

const cache = new TtlCache<AuditResult>(6 * 60 * 60 * 1000, 3000);

/** Codes for which retrying the same site over plain HTTP makes sense. */
const HTTP_FALLBACK_CODES = new Set(["TLS", "ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET", "NETWORK"]);

function withScheme(url: string, scheme: "http:" | "https:"): string {
  const u = new URL(url);
  u.protocol = scheme;
  return u.toString();
}

function toggleWww(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
  return u.toString();
}

function failure(url: string, partial: Partial<AuditResult> & Pick<AuditResult, "verdict" | "reasons">): AuditResult {
  return {
    url,
    reachable: false,
    https: url.startsWith("https://"),
    score: 0,
    checks: [],
    tech: [],
    emails: [],
    phones: [],
    socials: [],
    auditedAt: new Date().toISOString(),
    ...partial,
  };
}

async function fetchWithFallbacks(url: string): Promise<{ page: FetchedPage; tlsError?: string }> {
  try {
    return { page: await safeFetch(url) };
  } catch (err) {
    if (!(err instanceof FetchError)) throw err;
    // Many small business sites only resolve with (or without) "www."
    if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
      return { page: await safeFetch(toggleWww(url)).catch(() => Promise.reject(err)) };
    }
    if (url.startsWith("https://") && HTTP_FALLBACK_CODES.has(err.code)) {
      const page = await safeFetch(withScheme(url, "http:")).catch(() => Promise.reject(err));
      return { page, tlsError: err.code === "TLS" ? err.message : undefined };
    }
    throw err;
  }
}

function isBotChallenge(page: FetchedPage): boolean {
  return (
    page.headers.get("cf-mitigated") === "challenge" ||
    /<title>(just a moment|attention required|access denied|un instant)/i.test(page.body.slice(0, 5000)) ||
    /cf-chl-|captcha-delivery|_Incapsula_Resource/i.test(page.body.slice(0, 20000))
  );
}

export async function auditWebsite(rawUrl: string, { force = false } = {}): Promise<AuditResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) return failure(rawUrl, { verdict: "unknown", reasons: ["URL invalide"], error: "URL invalide" });

  const cached = force ? undefined : cache.get(url);
  if (cached) return cached;

  let result: AuditResult;
  if (isNotARealWebsite(url)) {
    result = failure(url, {
      verdict: "redo",
      reachable: true,
      reasons: ["Pas de vrai site : page réseau social / annuaire uniquement"],
    });
  } else {
    try {
      const { page, tlsError } = await fetchWithFallbacks(url);
      if ([401, 403, 429].includes(page.status) || isBotChallenge(page)) {
        result = failure(url, {
          verdict: "unknown",
          reachable: true,
          httpStatus: page.status,
          finalUrl: page.finalUrl,
          reasons: [`Site protégé contre les robots (HTTP ${page.status}) — à vérifier à la main`],
        });
      } else if (page.status >= 400) {
        result = failure(url, {
          verdict: "redo",
          httpStatus: page.status,
          finalUrl: page.finalUrl,
          error: `HTTP ${page.status}`,
          reasons: [page.status === 404 ? "Page d'accueil introuvable (erreur 404)" : `Site en erreur (HTTP ${page.status})`],
        });
      } else {
        const [assets, history] = await Promise.all([
          within(inspectAssets(page.body, page.finalUrl), 12_000, undefined),
          within(siteHistory(page.finalUrl), 10_000, null),
        ]);
        result = {
          url,
          auditedAt: new Date().toISOString(),
          ...analyzeHtml({
            url,
            finalUrl: page.finalUrl,
            status: page.status,
            html: page.body,
            timeMs: page.timeMs,
            bytes: page.bytes,
            tlsError,
            assets,
            history,
          }),
        };
      }
    } catch (err) {
      const e = err instanceof FetchError ? err : new FetchError((err as Error).message, "UNKNOWN");
      if (e.code === "BLOCKED_HOST" || e.code === "BAD_PROTOCOL" || e.code === "BAD_PORT") {
        result = failure(url, { verdict: "unknown", error: e.message, reasons: [e.message] });
      } else {
        const dns = e.code === "ENOTFOUND" || e.code === "EAI_AGAIN";
        result = failure(url, {
          verdict: "redo",
          error: e.message,
          reasons: [dns ? "Domaine introuvable : nom de domaine expiré ou mal configuré" : `Site inaccessible : ${e.message}`],
        });
      }
    }
  }

  cache.set(url, result);
  return result;
}
