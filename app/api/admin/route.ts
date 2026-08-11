import { apiError } from "@/app/api/response";
import type { CreateAdminCredentials } from "@/app/models/adminLogin";
import {
  createAdmin,
  deleteAdmin,
  getAdminById,
  getAllAdmins,
  updateAdmin,
} from "@/app/api/services/adminService";
import { authenticateAdmin } from "./authorization";

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const result = await getAdminById(auth, id);
    return Response.json(result, { status: result.status === "success" ? 200 : 403 });
  }
  const result = await getAllAdmins(auth);
  return Response.json(result, { status: result.status === "success" ? 200 : 403 });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const body = (await request.json().catch(() => null)) as CreateAdminCredentials | null;
  if (!body) return Response.json(apiError("Invalid admin credentials"), { status: 400 });
  const result = await createAdmin(auth, body);
  return Response.json(result, { status: result.status === "success" ? 201 : 400 });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json(apiError("Missing admin id"), { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json(apiError("Invalid admin payload"), { status: 400 });
  const result = await updateAdmin(auth, id, body);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json(apiError("Missing admin id"), { status: 400 });
  const result = await deleteAdmin(auth, id);
  return Response.json(result, { status: result.status === "success" ? 200 : 403 });
}
