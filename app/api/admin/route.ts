import { apiError } from "@/app/api/response";
import type { CreateAdminCredentials } from "@/app/models/adminLogin";
import {
  createAdmin,
  getAllAdmins,
} from "@/app/api/services/adminService";
import { authenticateAdmin } from "./authorization";

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
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
