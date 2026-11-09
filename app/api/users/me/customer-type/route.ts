import { apiError } from "@/app/api/response";
import { chooseCustomerType } from "@/app/api/services/userService";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return Response.json(apiError("Missing access token"), { status: 401 });

  const body = await request.json().catch(() => null);
  const { result, status } = await chooseCustomerType(accessToken, body);
  return Response.json(result, { status });
}
