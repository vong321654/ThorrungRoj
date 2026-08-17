import { createOrder, getCustomerOrderById, getCustomerOrders } from "@/app/api/services/orderService";
import { apiError } from "@/app/api/response";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const response = await getCustomerOrderById(getBearerToken(request), id);
    return Response.json(response.result, { status: response.status });
  }
  const response = await getCustomerOrders(getBearerToken(request));
  return Response.json(response.result, { status: response.status });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return Response.json(apiError("Invalid JSON payload"), { status: 400 });
  }

  const response = await createOrder(getBearerToken(request), payload);
  return Response.json(response.result, { status: response.status });
}
