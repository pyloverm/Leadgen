import { isGoogleEnabled } from "@/lib/providers/google";

export async function GET() {
  return Response.json({
    google: isGoogleEnabled(),
    pagespeedKey: Boolean(process.env.PAGESPEED_API_KEY),
  });
}
