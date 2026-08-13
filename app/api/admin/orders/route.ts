import { apiError, apiSuccess } from "@/app/api/response";
import { AdminRole } from "@/app/models/admin";
import type { ADMINORDERUPDATEPAYLOAD, ORDERUPDATEVALUES } from "@/app/models/order";
import { ORDERPAYMENTSTATUS, ORDERSTATUS, PAYMENTMETHOD } from "@/app/enums/order";
import { authenticateAdmin } from "../authorization";
import { fulfillOrderInventory } from "@/app/api/services/inventoryService";

const ORDER_PAYMENT_STATUSES = new Set<string>(Object.values(ORDERPAYMENTSTATUS));
const ORDER_STATUSES = new Set<string>(Object.values(ORDERSTATUS));

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.supabase
    .from("orders")
    .select("id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, createdAt, users(name, phone, shopName), payments(id, method, status, transferSlips(id, status, createdAt))")
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

  const body = await request.json().catch(() => null) as ADMINORDERUPDATEPAYLOAD | null;
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

  const values: ORDERUPDATEVALUES = { updatedAt: new Date().toISOString() };
  if (body.paymentStatus !== undefined) {
    if (!ORDER_PAYMENT_STATUSES.has(body.paymentStatus as string)) {
      return Response.json(apiError("Invalid order payment status"), { status: 400 });
    }
    if (body.paymentStatus === ORDERPAYMENTSTATUS.PAID) {
      if (existingOrder.paymentMethod === PAYMENTMETHOD.QR_SCAN) {
        return Response.json(apiError("Verify the QR payment slip from the payment details page"), { status: 400 });
      }
      values.paymentStatus = ORDERPAYMENTSTATUS.PAID;
    } else if (body.paymentStatus === ORDERPAYMENTSTATUS.AWAITING_PAYMENT) {
      if (existingOrder.paymentMethod === PAYMENTMETHOD.PENDING_PAYMENT || existingOrder.paymentMethod === PAYMENTMETHOD.PENDING_CART) {
        return Response.json(apiError("A debt payment must be updated to paid instead"), { status: 400 });
      }
      values.paymentStatus = ORDERPAYMENTSTATUS.PENDING;
    } else {
      if (body.paymentStatus === ORDERPAYMENTSTATUS.PENDING_PAYMENT && existingOrder.status !== ORDERSTATUS.DELIVERED) {
        return Response.json(apiError("An order can be marked as unpaid only after delivery"), { status: 400 });
      }
      values.paymentStatus = ORDERPAYMENTSTATUS.PENDING;
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

  if (
    body.orderStatus === ORDERSTATUS.DELIVERED &&
    existingOrder.status !== ORDERSTATUS.DELIVERED
  ) {
    const inventoryResult = await fulfillOrderInventory(
      body.orderId,
      auth.supabase,
      auth.admin.id,
    );
    if (inventoryResult.result.status === "error") {
      return Response.json(inventoryResult.result, { status: inventoryResult.status });
    }
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
