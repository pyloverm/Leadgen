export const APP_USER_AGENT =
  process.env.LEADGEN_USER_AGENT || "LeadGenPortugal/1.0 (+https://github.com/pyloverm/Leadgen)";

export class UpstreamError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 30_000, ...rest } = init;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
}
