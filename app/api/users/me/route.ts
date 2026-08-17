import { getCurrentUser } from "@/app/api/services/userService";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

export async function GET(request: Request) {
  const result = await getCurrentUser(getBearerToken(request) ?? undefined);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}
