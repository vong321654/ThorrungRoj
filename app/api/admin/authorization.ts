import { apiError } from "@/app/api/response";
import { authenticateAdmin as authenticateAdminService } from "@/app/api/services/adminService";

export async function authenticateAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json(apiError("Missing access token"), { status: 401 });
  const auth = await authenticateAdminService(token);
  if ("statusCode" in auth) {
    return Response.json(apiError(auth.message), { status: auth.statusCode });
  }
  return auth;
}
