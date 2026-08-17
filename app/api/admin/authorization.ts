import { apiError } from "@/app/api/response";
import { authenticateAdmin as authenticateAdminService } from "@/app/api/services/adminService";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

export async function authenticateAdmin(request: Request) {
  const token = getBearerToken(request);
  if (!token) return Response.json(apiError("Missing access token"), { status: 401 });
  const auth = await authenticateAdminService(token);
  if ("statusCode" in auth) {
    return Response.json(apiError(auth.message), { status: auth.statusCode });
  }
  return auth;
}
