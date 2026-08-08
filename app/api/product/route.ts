import { addProduct, getAllProduct, type ProductPayload } from "@/app/api/services/productService";
import { apiError } from "@/app/api/response";

export async function GET() {
  const result = await getAllProduct();
  return Response.json(result, { status: result.status === "success" ? 200 : 500 });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProductPayload | null;
  if (!body || typeof body !== "object") {
    return Response.json(apiError("Invalid product payload"), { status: 400 });
  }

  const result = await addProduct(body);
  return Response.json(result, { status: result.status === "success" ? 201 : 400 });
}
