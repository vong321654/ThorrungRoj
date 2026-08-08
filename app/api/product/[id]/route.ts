import {
  deleteProduct,
  getProductItem,
  updateProduct,
  type ProductPayload,
} from "@/app/api/services/productService";
import { apiError } from "@/app/api/response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await getProductItem(id);
  return Response.json(result, { status: result.status === "success" ? 200 : 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as ProductPayload | null;
  if (!body || typeof body !== "object") {
    return Response.json(apiError("Invalid product payload"), { status: 400 });
  }

  const result = await updateProduct(id, body);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await deleteProduct(id);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}
