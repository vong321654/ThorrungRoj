import { apiError, apiSuccess } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import { randomUUID } from "node:crypto";
import type { CREATEDEBTPAYLOAD, DEBTCHOICE, DEBTRECORDINSERT, MANUALDEBTPAYLOAD, SETTLEDEBTPAYLOAD } from "@/app/models/debt";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { DEBTCHOICE as DEBTCHOICEENUM } from "@/app/enums/debt";
import { ORDERSTATUS } from "@/app/enums/order";
import {
  buildDebtRecords,
  DEBT_ORDER_FIELDS,
  isFullySettled,
  markOrderPaidIfMoneyDebtsCleared,
  type DEBTORDER,
} from "@/app/api/services/debtService";
import { isGasCylinderProduct, PRODUCT_TYPE_EMBED } from "@/app/util/productType";
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

  const body = await request.json().catch(() => null) as (CREATEDEBTPAYLOAD & MANUALDEBTPAYLOAD) | null;
  if (body && typeof body.customer === "object" && body.customer !== null) return createManualDebt(auth, body);
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

type ADMINDEBTAUTH = Exclude<Awaited<ReturnType<typeof authenticateAdmin>>, Response>;

const THAI_PHONE = /^(?:\+66\d{8,9}|0\d{8,9})$/;

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return { ok: true as const, value: null };
  if (typeof value !== "string" || value.trim().length > maxLength) return { ok: false as const };
  return { ok: true as const, value: value.trim() || null };
}

/** ลูกค้าโทรสั่งกับเจ้าของร้าน ไม่มีออเดอร์ในระบบ ให้ superAdmin บันทึกหนี้เองจากชื่อ/ที่อยู่/เบอร์ */
async function createManualDebt(auth: ADMINDEBTAUTH, body: MANUALDEBTPAYLOAD) {
  if (auth.admin.role !== ADMINROLE.SUPER_ADMIN) {
    return Response.json(apiError("Only a super admin can record debts for phone orders"), { status: 403 });
  }

  const name = optionalText(body.customer?.name, 200);
  const address = optionalText(body.customer?.address, 500);
  const phoneInput = optionalText(body.customer?.phone, 20);
  const note = optionalText(body.note, 500);
  if (!name.ok || !name.value) return Response.json(apiError("กรุณากรอกชื่อลูกค้า"), { status: 400 });
  if (!address.ok) return Response.json(apiError("ที่อยู่ยาวเกิน 500 ตัวอักษร"), { status: 400 });
  if (!note.ok) return Response.json(apiError("หมายเหตุยาวเกิน 500 ตัวอักษร"), { status: 400 });
  const rawPhone = phoneInput.ok ? phoneInput.value ?? "" : "";
  const phone = rawPhone.replace(/[\s-]/g, "");
  if (!THAI_PHONE.test(phone)) return Response.json(apiError("เบอร์โทรไม่ถูกต้อง"), { status: 400 });

  const debtType = body.debtType as DEBTCHOICE;
  if (!Object.values(DEBTCHOICEENUM).includes(debtType)) return Response.json(apiError("Invalid debt type"), { status: 400 });
  const needsMoney = debtType === DEBTCHOICEENUM.MONEY || debtType === DEBTCHOICEENUM.BOTH;
  const needsCart = debtType === DEBTCHOICEENUM.CART || debtType === DEBTCHOICEENUM.BOTH;

  const moneyAmount = Number(body.moneyAmount);
  if (needsMoney && (!Number.isFinite(moneyAmount) || moneyAmount <= 0)) {
    return Response.json(apiError("กรุณากรอกจำนวนเงินที่ค้าง"), { status: 400 });
  }
  const productId = Number(body.productId);
  const cartQuantity = Number(body.cartQuantity);
  if (needsCart) {
    if (!Number.isInteger(productId) || productId <= 0) return Response.json(apiError("กรุณาเลือกถังที่ค้าง"), { status: 400 });
    if (!Number.isInteger(cartQuantity) || cartQuantity <= 0) return Response.json(apiError("จำนวนถังต้องเป็นจำนวนเต็มมากกว่า 0"), { status: 400 });
    const { data: product, error: productError } = await auth.adminSupabase
      .from("products").select(`id, typeId, ${PRODUCT_TYPE_EMBED}`).eq("id", productId).maybeSingle();
    if (productError) return Response.json(apiError("Failed to load product"), { status: 500 });
    if (!product || !isGasCylinderProduct(product)) return Response.json(apiError("สินค้าที่เลือกไม่ใช่ถังแก๊ส"), { status: 400 });
  }

  // ลูกค้าเดิมที่มีเบอร์นี้อยู่แล้ว (รวมลูกค้า LINE) ใช้คนเดิม หนี้จะได้ไปรวมกับบัญชีเขา
  const { data: existing, error: findError } = await auth.adminSupabase
    .from("users")
    .select("id")
    .in("phone", Array.from(new Set([phone, rawPhone])))
    .not("lineUserId", "like", "erased:%")
    .order("createdAt", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) return Response.json(apiError("Failed to look up customer"), { status: 500 });

  let userId = existing?.id as string | undefined;
  if (!userId) {
    // users ไม่มี RLS ให้พนักงาน insert และ lineUserId ห้ามว่าง จึงสร้างผ่าน service role
    // ด้วย lineUserId "manual:<uuid>" (ไอดี LINE จริงขึ้นต้นด้วย U จึงไม่ชนกัน)
    const { data: created, error: createError } = await createAdminClient()
      .from("users")
      .insert({ lineUserId: `manual:${randomUUID()}`, name: name.value, phone, address: address.value })
      .select("id")
      .single();
    if (createError || !created) return Response.json(apiError("Failed to create customer"), { status: 500 });
    userId = created.id as string;
  }

  const records: DEBTRECORDINSERT[] = [];
  if (needsMoney) {
    records.push({ userId, orderId: null, recordedBy: auth.admin.id, debtType: DEBTCHOICEENUM.MONEY, amount: moneyAmount, note: note.value });
  }
  if (needsCart) {
    records.push({ userId, orderId: null, recordedBy: auth.admin.id, debtType: DEBTCHOICEENUM.CART, productId, amount: cartQuantity, note: note.value });
  }

  const { data: inserted, error } = await auth.adminSupabase.from("debtRecords").insert(records).select("id");
  if (error) return Response.json(apiError("Failed to create debt records"), { status: 500 });
  return Response.json(apiSuccess("Debt records created successfully", inserted ?? []), { status: 201 });
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
