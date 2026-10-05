import { badRequest, errorResponse } from "@/lib/api";
import { auditWebsite } from "@/lib/audit";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string; force?: boolean } | null;
  if (!body?.url || typeof body.url !== "string") return badRequest("Paramètre « url » manquant");
  try {
    return Response.json(await auditWebsite(body.url, { force: body.force === true }));
  } catch (err) {
    return errorResponse(err);
  }
}
