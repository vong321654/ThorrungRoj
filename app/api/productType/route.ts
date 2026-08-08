import { apiError } from "@/app/api/response";
import { addProductType, getAllProductType } from "../services/typeService";
import { authenticateAdmin } from "../admin/authorization";
import { isSuperAdmin } from "@/app/api/services/adminService";

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const result = await getAllProductType(auth.supabase);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(apiError("Only a super admin can add product types"), {
      status: 403,
    });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json(apiError("Product type name is required"), {
      status: 400,
    });
  }

  const result = await addProductType(body.name, auth.supabase, auth.admin.id);
  return Response.json(result, {
    status: result.status === "success" ? 201 : 400,
  });
}
