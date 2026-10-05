import { badRequest, errorResponse } from "@/lib/api";
import { runPageSpeed } from "@/lib/audit/pagespeed";
import { normalizeUrl } from "@/lib/urls";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = normalizeUrl(body?.url);
  if (!url) return badRequest("URL invalide");
  try {
    return Response.json(await runPageSpeed(url));
  } catch (err) {
    return errorResponse(err);
  }
}
