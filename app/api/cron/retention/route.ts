import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/app/api/response";
import { runPrivacyRetention } from "@/app/api/services/privacyService";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

function isAuthorized(token: string | null, secret: string) {
  if (!token) return false;
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json(apiError("CRON_SECRET is not configured"), { status: 503 });
  if (!isAuthorized(getBearerToken(request), secret)) {
    return Response.json(apiError("Unauthorized"), { status: 401 });
  }

  const { result, status } = await runPrivacyRetention();
  return Response.json(result, { status });
}
