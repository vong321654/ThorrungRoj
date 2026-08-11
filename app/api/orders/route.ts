import { createOrder, getCustomerOrders } from "@/app/api/services/orderService";
import { apiError } from "@/app/api/response";

function getAccessToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

export async function GET(request: Request) {
  const response = await getCustomerOrders(getAccessToken(request));
  return Response.json(response.result, { status: response.status });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return Response.json(apiError("Invalid JSON payload"), { status: 400 });
  }

  const response = await createOrder(getAccessToken(request), payload);
  return Response.json(response.result, { status: response.status });
}
