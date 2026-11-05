import { apiError, apiSuccess } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import type { ADMINORDERUPDATEPAYLOAD, ORDERUPDATEVALUES } from "@/app/models/order";
import { ORDERPAYMENTSTATUS, ORDERSTATUS, PAYMENTMETHOD } from "@/app/enums/order";
import { authenticateAdmin } from "../authorization";
import { isAdminOrSuperAdmin } from "@/app/api/services/adminService";
import { fulfillOrderInventory } from "@/app/api/services/inventoryService";
import { recordDebtForDeliveredOrder, settleOrderMoneyDebts } from "@/app/api/services/debtService";

const ORDER_PAYMENT_STATUSES = new Set<string>(Object.values(ORDERPAYMENTSTATUS));
const ORDER_STATUSES = new Set<string>(Object.values(ORDERSTATUS));

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdminOrSuperAdmin(auth)) return Response.json(apiError("Only admins can view orders"), { status: 403 });

  const { data, error } = await auth.adminSupabase
    .from("orders")
    .select("id, totalAmount, paymentMethod, paymentStatus, status, deliveryAddress, createdAt, users(name, phone, shopName), payments(id, method, status, transferSlips(id, status, createdAt))")
    .order("createdAt", { ascending: false });

  if (error) return Response.json(apiError("Failed to fetch orders"), { status: 500 });
  return Response.json(apiSuccess("Orders retrieved successfully", data ?? []));
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== ADMINROLE.SUPER_ADMIN && auth.admin.role !== ADMINROLE.ADMIN) {
    return Response.json(apiError("Only admins can update order payment status"), { status: 403 });
  }

  const body = await request.json().catch(() => null) as ADMINORDERUPDATEPAYLOAD | null;
  if (!body || typeof body.orderId !== "string") {
    return Response.json(apiError("Invalid order update"), { status: 400 });
  }

  const { data: existingOrder, error: existingOrderError } = await auth.adminSupabase
    .from("orders")
    .select("status, paymentMethod, debtRecords(id)")
    .eq("id", body.orderId)
    .maybeSingle();
  if (existingOrderError) return Response.json(apiError("Failed to load order"), { status: 500 });
  if (!existingOrder) return Response.json(apiError("Order not found"), { status: 404 });

  const values: ORDERUPDATEVALUES = { updatedAt: new Date().toISOString() };
  if (body.paymentStatus !== undefined) {
    if (!ORDER_PAYMENT_STATUSES.has(body.paymentStatus as string)) {
      return Response.json(apiError("Invalid order payment status"), { status: 400 });
    }
    // มีรายการหนี้แล้ว เปลี่ยนกลับเป็นรอชำระ/ค้างแบบอื่นไม่ได้ ไม่งั้นออเดอร์กับหนี้จะไม่ตรงกัน
    if (body.paymentStatus !== ORDERPAYMENTSTATUS.PAID && (existingOrder.debtRecords ?? []).length > 0) {
      return Response.json(apiError("ออเดอร์นี้มีรายการหนี้แล้ว กรุณาจัดการยอดในหน้าหนี้ค้าง"), { status: 400 });
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
    );
    if (inventoryResult.result.status === "error") {
      return Response.json(inventoryResult.result, { status: inventoryResult.status });
    }
  }

  const { data, error } = await auth.adminSupabase
    .from("orders")
    .update(values)
    .eq("id", body.orderId)
    .select("id, paymentMethod, paymentStatus, status")
    .maybeSingle();

  if (error) return Response.json(apiError("Failed to update order payment status"), { status: 500 });

  // ออเดอร์อัปเดตสำเร็จแล้ว ถ้าขั้นตอนหนี้พลาดให้แจ้งเตือนแทนการตอบ error เพราะสต๊อกถูกตัดไปแล้ว ห้ามให้กดซ้ำ
  let debtWarning: string | null = null;
  let debtsCreated = 0;
  if (body.paymentStatus === ORDERPAYMENTSTATUS.PAID) {
    const settled = await settleOrderMoneyDebts(auth.adminSupabase, body.orderId, auth.admin.id);
    if (!settled) debtWarning = "อัปเดตออเดอร์แล้ว แต่ปิดยอดหนี้ไม่สำเร็จ กรุณาบันทึกรับชำระในหน้าหนี้ค้าง";
  }
  const debtResult = await recordDebtForDeliveredOrder(auth.adminSupabase, body.orderId, auth.admin.id);
  debtsCreated = debtResult.created;
  debtWarning = debtWarning ?? debtResult.warning;

  return Response.json(apiSuccess("Order updated", { ...data, debtsCreated, debtWarning }));
}
