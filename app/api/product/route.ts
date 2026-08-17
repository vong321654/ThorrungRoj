import {
  addProduct,
  deleteProduct,
  getFilteredProduct,
  getAllProduct,
  getProductItem,
  updateProduct,
} from "@/app/api/services/productService";
import { apiError } from "@/app/api/response";
import type { PRODUCTPAYLOAD } from "@/app/models/product";
import { authenticateAdmin } from "../admin/authorization";
import { isAdminOrSuperAdmin } from "../services/adminService";

function getQueryId(request: Request) {
  const idValue = new URL(request.url).searchParams.get("id");
  if (idValue === null) return null;

  const id = Number(idValue);
  return Number.isInteger(id) && id > 0 ? String(id) : null;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const idValue = searchParams.get("id");
  if (idValue !== null) {
    const id = getQueryId(request);
    if (id === null) {
      return Response.json(apiError("Invalid product id"), { status: 400 });
    }

    const result = await getProductItem(id);
    return Response.json(result, { status: result.status === "success" ? 200 : 404 });
  }

  const name = searchParams.get("name");
  const size = searchParams.get("size");
  const brand = searchParams.get("brand") ?? searchParams.get("brandId");
  if (name !== null || size !== null || brand !== null) {
    const result = await getFilteredProduct({
      ...(name !== null ? { name } : {}),
      ...(size !== null ? { size } : {}),
      ...(brand !== null ? { brand } : {}),
    });
    return Response.json(result, { status: result.status === "success" ? 200 : 400 });
  }

  const result = await getAllProduct();
  return Response.json(result, { status: result.status === "success" ? 200 : 500 });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can manage products"), { status: 403 });

  const body = (await request.json().catch(() => null)) as PRODUCTPAYLOAD | null;
  if (!body || typeof body !== "object") {
    return Response.json(apiError("Invalid product payload"), { status: 400 });
  }

  const result = await addProduct(body, auth.adminSupabase, auth.admin.id);
  return Response.json(result, { status: result.status === "success" ? 201 : 400 });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can manage products"), { status: 403 });

  const id = getQueryId(request);
  if (id === null) {
    return Response.json(apiError("Valid product id is required"), { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as PRODUCTPAYLOAD | null;
  if (!body || typeof body !== "object") {
    return Response.json(apiError("Invalid product payload"), { status: 400 });
  }

  const result = await updateProduct(id, body, auth.adminSupabase, auth.admin.id);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can manage products"), { status: 403 });

  const id = getQueryId(request);
  if (id === null) {
    return Response.json(apiError("Valid product id is required"), { status: 400 });
  }

  const result = await deleteProduct(id, auth.adminSupabase);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}

