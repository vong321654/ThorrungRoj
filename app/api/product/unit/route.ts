import { apiError } from "@/app/api/response";
import { authenticateAdmin } from "../../admin/authorization";
import { isSuperAdmin } from "@/app/api/services/adminService";
import {
  addProductUnit,
  deleteProductUnit,
  getAllProductUnit,
  getUnitById,
  updateProductUnit,
} from "../../services/unitService";

function getQueryId(request: Request) {
  const idValue = new URL(request.url).searchParams.get("id");
  if (idValue === null) return null;

  const id = Number(idValue);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  const idValue = new URL(request.url).searchParams.get("id");
  if (idValue !== null) {
    const id = getQueryId(request);
    if (id === null) {
      return Response.json(apiError("Invalid product unit id"), { status: 400 });
    }

    const result = await getUnitById(id);
    return Response.json(result, { status: result.status === "success" ? 200 : 404 });
  }

  const result = await getAllProductUnit();
  return Response.json(result, { status: result.status === "success" ? 200 : 500 });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(apiError("Only a super admin can add product units"), { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json(apiError("Product unit name is required"), { status: 400 });
  }

  const result = await addProductUnit(body.name, auth.supabase, auth.admin.id);
  return Response.json(result, { status: result.status === "success" ? 201 : 500 });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(apiError("Only a super admin can edit product units"), { status: 403 });
  }

  const id = getQueryId(request);
  if (id === null) {
    return Response.json(apiError("Valid product unit id is required"), { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json(apiError("Product unit name is required"), { status: 400 });
  }

  const result = await updateProductUnit(id, body.name, auth.supabase);
  return Response.json(result, { status: result.status === "success" ? 200 : 500 });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(apiError("Only a super admin can delete product units"), { status: 403 });
  }

  const id = getQueryId(request);
  if (id === null) {
    return Response.json(apiError("Valid product unit id is required"), { status: 400 });
  }

  const result = await deleteProductUnit(id, auth.supabase);
  return Response.json(result, { status: result.status === "success" ? 200 : 500 });
}
