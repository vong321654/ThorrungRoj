import { apiError } from "@/app/api/response";
import {
  deleteProductType,
  getTypeById,
  updateProductType,
} from "../../services/typeService";
import { authenticateAdmin } from "../../admin/authorization";
import { isSuperAdmin } from "@/app/api/services/adminService";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const id = parseId((await context.params).id);
  if (id === null)
    return Response.json(apiError("Invalid product type id"), { status: 400 });
  const result = await getTypeById(id);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 404,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth))
    return Response.json(
      apiError("Only a super admin can edit product types"),
      { status: 403 },
    );
  const id = parseId((await context.params).id);
  if (id === null)
    return Response.json(apiError("Invalid product type id"), { status: 400 });
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json(apiError("Product type name is required"), {
      status: 400,
    });
  }
  const result = await updateProductType(id, body.name, auth.supabase);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 400,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await authenticateAdmin(_request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth))
    return Response.json(
      apiError("Only a super admin can delete product types"),
      { status: 403 },
    );
  const id = parseId((await context.params).id);
  if (id === null)
    return Response.json(apiError("Invalid product type id"), { status: 400 });
  const result = await deleteProductType(id, auth.supabase);
  return Response.json(result, {
    status: result.status === "success" ? 200 : 400,
  });
}
