import { apiError } from "@/app/api/response";
import {
  addProductType,
  deleteProductType,
  getAllProductType,
  getTypeById,
  updateProductType,
} from "../../services/typeService";
import { authenticateAdmin } from "../../admin/authorization";
import { isSuperAdmin } from "@/app/api/services/adminService";

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
      return Response.json(apiError("Invalid product type id"), { status: 400 });
    }

    const result = await getTypeById(id);
    return Response.json(result, {
      status: result.status === "success" ? 200 : 404,
    });
  }

  const result = await getAllProductType();
  return Response.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(
      apiError("Only a super admin can edit product types"),
      { status: 403 },
    );
  }

  const id = getQueryId(request);
  if (id === null) {
    return Response.json(apiError("Valid product type id is required"), { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json(apiError("Product type name is required"), { status: 400 });
  }

  const result = await updateProductType(id, body.name, auth.supabase, auth.admin.id);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isSuperAdmin(auth)) {
    return Response.json(
      apiError("Only a super admin can delete product types"),
      { status: 403 },
    );
  }

  const id = getQueryId(request);
  if (id === null) {
    return Response.json(apiError("Valid product type id is required"), { status: 400 });
  }

  const result = await deleteProductType(id, auth.supabase);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
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
