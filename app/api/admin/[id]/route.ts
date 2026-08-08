import { apiError } from "@/app/api/response";
import {
  deleteAdmin,
  getAdminById,
  updateAdmin,
} from "@/app/api/services/adminService";
import { authenticateAdmin } from "../authorization";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const result = await getAdminById(auth, id);
  return Response.json(result, { status: result.status === "success" ? 200 : 403 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json(apiError("Invalid admin payload"), { status: 400 });
  const result = await updateAdmin(auth, id, body);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const result = await deleteAdmin(auth, id);
  return Response.json(result, { status: result.status === "success" ? 200 : 403 });
}
