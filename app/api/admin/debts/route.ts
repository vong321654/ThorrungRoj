import { apiError, apiSuccess } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import type { CREATEDEBTPAYLOAD, DEBTCHOICE, SETTLEDEBTPAYLOAD } from "@/app/models/debt";
import { DEBTCHOICE as DEBTCHOICEENUM } from "@/app/enums/debt";
import { ORDERSTATUS } from "@/app/enums/order";
import {
  buildDebtRecords,
  DEBT_ORDER_FIELDS,
  isFullySettled,
  markOrderPaidIfMoneyDebtsCleared,
  type DEBTORDER,
} from "@/app/api/services/debtService";
import { authenticateAdmin } from "../authorization";


function canManageDebts(role: ADMINROLE | null) {
  return role === ADMINROLE.ADMIN || role === ADMINROLE.SUPER_ADMIN;
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!canManageDebts(auth.admin.role)) return Response.json(apiError("Only admins can view debt records"), { status: 403 });

  const { data, error } = await auth.adminSupabase
    .from("debtRecords")
    .select("id, userId, orderId, debtType, amount, status, note, createdAt, users(name, phone, shopName), products(name, size), debtTransactions(id, transactionType, amount, note, createdAt)")
    .order("createdAt", { ascending: false });
  if (error) return Response.json(apiError("Failed to fetch debt records"), { status: 500 });

  return Response.json(apiSuccess("Debt records retrieved successfully", data ?? []));
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!canManageDebts(auth.admin.role)) return Response.json(apiError("Only admins can record debts"), { status: 403 });

  const debtId = new URL(request.url).searchParams.get("id");
  if (debtId) return settleDebt(request, auth, debtId);

  const body = await request.json().catch(() => null) as CREATEDEBTPAYLOAD | null;
  if (!body || typeof body.orderId !== "string" || !Object.values(DEBTCHOICEENUM).includes(body.debtType as DEBTCHOICEENUM)) {
    return Response.json(apiError("Invalid debt record"), { status: 400 });
  }
  if (body.note !== undefined && typeof body.note !== "string") {
    return Response.json(apiError("Invalid note"), { status: 400 });
  }

  const { data, error: orderError } = await auth.adminSupabase
    .from("orders")
    .select(DEBT_ORDER_FIELDS)
    .eq("id", body.orderId)
    .maybeSingle();
  if (orderError) return Response.json(apiError("Failed to load order"), { status: 500 });
  if (!data) return Response.json(apiError("Order not found"), { status: 404 });
  const order = data as unknown as DEBTORDER;
  if (order.status !== ORDERSTATUS.DELIVERED) {
    return Response.json(apiError("Debt can only be recorded after the order is delivered"), { status: 400 });
  }

  const debtType = body.debtType as DEBTCHOICE;
  const existingTypes = new Set((order.debtRecords ?? []).map((debt) => debt.debtType));
  if ((debtType === DEBTCHOICEENUM.MONEY || debtType === DEBTCHOICEENUM.BOTH) && existingTypes.has(DEBTCHOICEENUM.MONEY)) {
    return Response.json(apiError("This order already has a money debt record"), { status: 400 });
  }
  if ((debtType === DEBTCHOICEENUM.CART || debtType === DEBTCHOICEENUM.BOTH) && existingTypes.has(DEBTCHOICEENUM.CART)) {
    return Response.json(apiError("This order already has a cart debt record"), { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const records = buildDebtRecords(order, debtType, auth.admin.id, note);
  if (
    (debtType === DEBTCHOICEENUM.CART || debtType === DEBTCHOICEENUM.BOTH) &&
    !records.some((record) => record.debtType === DEBTCHOICEENUM.CART)
  ) {
    return Response.json(apiError("ออเดอร์นี้ไม่มีรายการเปลี่ยนถัง จึงบันทึกค้างถังไม่ได้"), { status: 400 });
  }

  const { data: created, error } = await auth.adminSupabase.from("debtRecords").insert(records).select("id");
  if (error) return Response.json(apiError("Failed to create debt records"), { status: 500 });
  return Response.json(apiSuccess("Debt records created successfully", created ?? []), { status: 201 });
}

async function settleDebt(
  request: Request,
  auth: Exclude<Awaited<ReturnType<typeof authenticateAdmin>>, Response>,
  debtId: string,
) {
  const body = await request.json().catch(() => null) as SETTLEDEBTPAYLOAD | null;
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || (body?.note !== undefined && typeof body.note !== "string")) {
    return Response.json(apiError("Invalid settlement amount"), { status: 400 });
  }

  const { data: debt, error: debtError } = await auth.adminSupabase
    .from("debtRecords")
    .select("id, orderId, debtType, amount, debtTransactions(amount)")
    .eq("id", debtId)
    .maybeSingle();
  if (debtError) return Response.json(apiError("Failed to load debt record"), { status: 500 });
  if (!debt) return Response.json(apiError("Debt record not found"), { status: 404 });

  const settled = (debt.debtTransactions ?? []).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  if (amount > Number(debt.amount) - settled) {
    return Response.json(apiError("Settlement amount exceeds the remaining debt"), { status: 400 });
  }

  const { error: transactionError } = await auth.adminSupabase.from("debtTransactions").insert({
    debtRecordId: debt.id,
    transactionType: debt.debtType === DEBTCHOICEENUM.MONEY ? "payment" : "return",
    amount,
    recordedBy: auth.admin.id,
    note: typeof body?.note === "string" ? body.note.trim() || null : null,
  });
  if (transactionError) return Response.json(apiError("Failed to record settlement"), { status: 500 });

  const nextSettled = settled + amount;
  const nextStatus = isFullySettled(Number(debt.amount), nextSettled) ? "paid" : "partial";
  const { data, error: updateError } = await auth.adminSupabase
    .from("debtRecords")
    .update({ status: nextStatus, updatedAt: new Date().toISOString() })
    .eq("id", debt.id)
    .select("id, status")
    .single();
  if (updateError) return Response.json(apiError("Settlement was recorded but the debt status could not be updated"), { status: 500 });

  // รับเงินครบแล้ว ให้ออเดอร์ขึ้น "ชำระแล้ว" ด้วย ส่วนการคืนถังไม่เกี่ยวกับการจ่ายเงิน
  if (nextStatus === "paid" && debt.debtType === DEBTCHOICEENUM.MONEY && debt.orderId) {
    const synced = await markOrderPaidIfMoneyDebtsCleared(auth.adminSupabase, debt.orderId);
    if (!synced) {
      return Response.json(apiError("รับชำระครบแล้ว แต่อัปเดตสถานะออเดอร์ไม่สำเร็จ กรุณาเปลี่ยนเป็น \"ชำระแล้ว\" ในหน้าคำสั่งซื้อ"), { status: 500 });
    }
  }
  return Response.json(apiSuccess("Debt settlement recorded successfully", data));
}
