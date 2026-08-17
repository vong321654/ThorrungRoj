import { clockIn } from "../../services/attendService";
import { getBearerToken } from "../../util/supabase/authenticated";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const response = await clockIn(getBearerToken(request), payload);
  return Response.json(response.result, { status: response.status });
}
