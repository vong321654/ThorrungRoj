import { apiError } from "@/app/api/response";
import { eraseCustomerData } from "@/app/api/services/privacyService";
import { ADMINROLE } from "@/app/models/admin";
import { authenticateAdmin } from "../../authorization";

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== ADMINROLE.SUPER_ADMIN) {
    return Response.json(apiError("Only a super admin can erase customer data"), { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !body.id.trim()) {
    return Response.json(apiError("User id is required"), { status: 400 });
  }

  const { result, status } = await eraseCustomerData(body.id);
  return Response.json(result, { status });
}
