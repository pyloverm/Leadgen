import { UpstreamError } from "./providers/http";

export function errorResponse(err: unknown): Response {
  const status = err instanceof UpstreamError ? (err.status && err.status >= 400 ? err.status : 502) : 500;
  const message = err instanceof Error ? err.message : "Erreur inconnue";
  if (status === 500) console.error(err);
  return Response.json({ error: message }, { status });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}
