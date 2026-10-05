import { badRequest, errorResponse } from "@/lib/api";
import { discoverWebsite } from "@/lib/discovery";
import type { DiscoveryInput } from "@/lib/types";

export const maxDuration = 60;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = str(body?.name);
  if (!name) return badRequest("Paramètre « name » manquant");
  const input: DiscoveryInput = {
    name,
    locality: str(body?.locality),
    city: str(body?.city),
    postcode: str(body?.postcode),
    address: str(body?.address),
    phone: str(body?.phone),
    email: str(body?.email),
    lat: typeof body?.lat === "number" && Number.isFinite(body.lat) ? body.lat : undefined,
    lon: typeof body?.lon === "number" && Number.isFinite(body.lon) ? body.lon : undefined,
  };
  try {
    return Response.json(await discoverWebsite(input));
  } catch (err) {
    return errorResponse(err);
  }
}
