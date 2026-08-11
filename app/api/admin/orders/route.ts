import { apiError, apiSuccess } from "@/app/api/response";
import { AdminRole } from "@/app/models/admin";
import { authenticateAdmin } from "../authorization";

const ORDER_PAYMENT_STATUSES = new Set(["awaitingPayment", "paid", "pendingPayment", "pendingCart"]);
const ORDER_STATUSES = new Set(["pending", "preparing", "delivering", "delivered", "cancelled"]);

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.supabase
    .from("orders")
    .select("id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, createdAt, users(name, phone, shopName)")
    .order("createdAt", { ascending: false });

  if (error) return Response.json(apiError("Failed to fetch orders"), { status: 500 });
  return Response.json(apiSuccess("Orders retrieved successfully", data ?? []));
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== AdminRole.SuperAdmin && auth.admin.role !== AdminRole.Admin) {
    return Response.json(apiError("Only admins can update order payment status"), { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    orderId?: unknown;
    paymentStatus?: unknown;
    orderStatus?: unknown;
  } | null;
  if (!body || typeof body.orderId !== "string") {
    return Response.json(apiError("Invalid order update"), { status: 400 });
  }

  const { data: existingOrder, error: existingOrderError } = await auth.supabase
    .from("orders")
    .select("status, paymentMethod")
    .eq("id", body.orderId)
    .maybeSingle();
  if (existingOrderError) return Response.json(apiError("Failed to load order"), { status: 500 });
  if (!existingOrder) return Response.json(apiError("Order not found"), { status: 404 });

  const values: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (body.paymentStatus !== undefined) {
    if (!ORDER_PAYMENT_STATUSES.has(body.paymentStatus as string)) {
      return Response.json(apiError("Invalid order payment status"), { status: 400 });
    }
    if (body.paymentStatus === "paid") {
      values.paymentStatus = "paid";
    } else if (body.paymentStatus === "awaitingPayment") {
      if (existingOrder.paymentMethod === "pendingPayment" || existingOrder.paymentMethod === "pendingCart") {
        return Response.json(apiError("A debt payment must be updated to paid instead"), { status: 400 });
      }
      values.paymentStatus = "pending";
    } else {
      if (body.paymentStatus === "pendingPayment" && existingOrder.status !== "delivered") {
        return Response.json(apiError("An order can be marked as unpaid only after delivery"), { status: 400 });
      }
      values.paymentStatus = "pending";
      values.paymentMethod = body.paymentStatus as string;
    }
  }
  if (body.orderStatus !== undefined) {
    if (!ORDER_STATUSES.has(body.orderStatus as string)) {
      return Response.json(apiError("Invalid order status"), { status: 400 });
    }
    values.status = body.orderStatus as string;
  }
  if (Object.keys(values).length === 1) {
    return Response.json(apiError("No order updates supplied"), { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("orders")
    .update(values)
    .eq("id", body.orderId)
    .select("id, paymentMethod, paymentStatus, status")
    .maybeSingle();

  if (error) return Response.json(apiError("Failed to update order payment status"), { status: 500 });
  return Response.json(apiSuccess("Order updated", data));
}
