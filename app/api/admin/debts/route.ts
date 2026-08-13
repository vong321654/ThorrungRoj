import { apiError, apiSuccess } from "@/app/api/response";
import { AdminRole } from "@/app/models/admin";
import type { CREATEDEBTPAYLOAD, DEBTCHOICE, DEBTRECORDINSERT, SETTLEDEBTPAYLOAD } from "@/app/models/debt";
import { DEBTCHOICE as DEBTCHOICEENUM } from "@/app/enums/debt";
import { ORDERSTATUS, SALETYPE } from "@/app/enums/order";
import { authenticateAdmin } from "../authorization";


function canManageDebts(role: AdminRole | null) {
  return role === AdminRole.Admin || role === AdminRole.SuperAdmin;
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.supabase
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

  const { data: order, error: orderError } = await auth.supabase
    .from("orders")
    .select("id, userId, totalAmount, status, orderItems(productId, quantity, saleType), debtRecords(debtType)")
    .eq("id", body.orderId)
    .maybeSingle();
  if (orderError) return Response.json(apiError("Failed to load order"), { status: 500 });
  if (!order) return Response.json(apiError("Order not found"), { status: 404 });
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
  const records: DEBTRECORDINSERT[] = [];
  if (debtType === DEBTCHOICEENUM.MONEY || debtType === DEBTCHOICEENUM.BOTH) {
    records.push({ userId: order.userId, orderId: order.id, recordedBy: auth.admin.id, debtType: DEBTCHOICEENUM.MONEY, amount: order.totalAmount, note });
  }
  if (debtType === DEBTCHOICEENUM.CART || debtType === DEBTCHOICEENUM.BOTH) {
    for (const item of order.orderItems ?? []) {
      if ((item.saleType !== SALETYPE.SELL && item.saleType !== SALETYPE.EXCHANGE) || !item.productId || item.quantity <= 0) continue;
      records.push({ userId: order.userId, orderId: order.id, recordedBy: auth.admin.id, debtType: DEBTCHOICEENUM.CART, productId: item.productId, amount: item.quantity, note });
    }
    if (!records.some((record) => record.debtType === DEBTCHOICEENUM.CART)) {
      return Response.json(apiError("This order has no gas cylinders to record as a cart debt"), { status: 400 });
    }
  }

  const { data, error } = await auth.supabase.from("debtRecords").insert(records).select("id");
  if (error) return Response.json(apiError("Failed to create debt records"), { status: 500 });
  return Response.json(apiSuccess("Debt records created successfully", data ?? []), { status: 201 });
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

  const { data: debt, error: debtError } = await auth.supabase
    .from("debtRecords")
    .select("id, debtType, amount, debtTransactions(amount)")
    .eq("id", debtId)
    .maybeSingle();
  if (debtError) return Response.json(apiError("Failed to load debt record"), { status: 500 });
  if (!debt) return Response.json(apiError("Debt record not found"), { status: 404 });

  const settled = (debt.debtTransactions ?? []).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  if (amount > Number(debt.amount) - settled) {
    return Response.json(apiError("Settlement amount exceeds the remaining debt"), { status: 400 });
  }

  const { error: transactionError } = await auth.supabase.from("debtTransactions").insert({
    debtRecordId: debt.id,
    transactionType: debt.debtType === DEBTCHOICEENUM.MONEY ? "payment" : "return",
    amount,
    recordedBy: auth.admin.id,
    note: typeof body?.note === "string" ? body.note.trim() || null : null,
  });
  if (transactionError) return Response.json(apiError("Failed to record settlement"), { status: 500 });

  const nextSettled = settled + amount;
  const nextStatus = nextSettled === Number(debt.amount) ? "paid" : "partial";
  const { data, error: updateError } = await auth.supabase
    .from("debtRecords")
    .update({ status: nextStatus, updatedAt: new Date().toISOString() })
    .eq("id", debt.id)
    .select("id, status")
    .single();
  if (updateError) return Response.json(apiError("Settlement was recorded but the debt status could not be updated"), { status: 500 });
  return Response.json(apiSuccess("Debt settlement recorded successfully", data));
}
