import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

export class FetchError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export interface FetchedPage {
  finalUrl: string;
  status: number;
  headers: Headers;
  body: string;
  bytes: number;
  truncated: boolean;
  /** Time until the headers of the final response arrived (redirects included). */
  timeMs: number;
  redirects: string[];
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Refuses URLs that resolve to the local network (the audit endpoint must not become an SSRF proxy). */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError(`Protocole non supporté : ${url.protocol}`, "BAD_PROTOCOL");
  }
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) {
    throw new FetchError(`Port non autorisé : ${url.port}`, "BAD_PORT");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchError("Adresse locale refusée", "BLOCKED_HOST");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch((e: NodeJS.ErrnoException) => {
    throw new FetchError("Nom de domaine introuvable (DNS)", e.code ?? "ENOTFOUND");
  });
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new FetchError("Adresse privée refusée", "BLOCKED_HOST");
  }
}

function describeNetworkError(err: unknown): FetchError {
  if (err instanceof FetchError) return err;
  const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return new FetchError("Le site ne répond pas (délai dépassé)", "TIMEOUT");
  const code = e?.cause?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new FetchError("Nom de domaine introuvable (DNS)", code);
  if (code === "ECONNREFUSED") return new FetchError("Connexion refusée par le serveur", code);
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return new FetchError("Connexion interrompue", code);
  if (code.startsWith("CERT_") || code.startsWith("ERR_TLS") || code.includes("SELF_SIGNED") || code.includes("UNABLE_TO_VERIFY")) {
    return new FetchError(`Certificat SSL invalide (${code})`, "TLS");
  }
  return new FetchError(e?.cause?.message || e?.message || "Erreur réseau", code || "NETWORK");
}

function detectCharset(headers: Headers, head: Uint8Array): string {
  const fromHeader = headers.get("content-type")?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const ascii = new TextDecoder("latin1").decode(head.subarray(0, 4096));
  const fromMeta = ascii.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return fromMeta?.toLowerCase() ?? "utf-8";
}

async function readBody(res: Response, maxBytes: number): Promise<{ buf: Uint8Array; bytes: number; truncated: boolean }> {
  if (!res.body) return { buf: new Uint8Array(), bytes: 0, truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.byteLength;
    if (bytes >= maxBytes) {
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const buf = new Uint8Array(Math.min(bytes, maxBytes));
  let pos = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, buf.length - pos));
    buf.set(slice, pos);
    pos += slice.byteLength;
  }
  return { buf, bytes, truncated };
}

/** Fetches a public web page, following redirects manually so each hop is validated. */
export async function safeFetch(
  rawUrl: string,
  { timeoutMs = 15_000, maxBytes = 3_000_000, maxRedirects = 6 } = {},
): Promise<FetchedPage> {
  let url = new URL(rawUrl);
  const redirects: string[] = [];
  const started = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    for (let hop = 0; ; hop++) {
      await assertPublicUrl(url);
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8,fr;q=0.7",
        },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        if (hop >= maxRedirects) throw new FetchError("Trop de redirections", "REDIRECT_LOOP");
        await res.body?.cancel().catch(() => {});
        url = new URL(location, url);
        redirects.push(url.toString());
        continue;
      }
      const timeMs = Math.round(performance.now() - started);
      const { buf, bytes, truncated } = await readBody(res, maxBytes);
      let charset = detectCharset(res.headers, buf);
      if (charset === "iso-8859-1" || charset === "latin1") charset = "windows-1252";
      let body: string;
      try {
        body = new TextDecoder(charset).decode(buf);
      } catch {
        body = new TextDecoder("utf-8").decode(buf);
      }
      return { finalUrl: url.toString(), status: res.status, headers: res.headers, body, bytes, truncated, timeMs, redirects };
    }
  } catch (err) {
    throw describeNetworkError(err);
  }
}
