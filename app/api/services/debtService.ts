import type { SupabaseClient } from "@supabase/supabase-js";
import { DEBTCHOICE, DEBTSTATUS } from "@/app/enums/debt";
import { ORDERPAYMENTSTATUS, ORDERSTATUS, PAYMENTMETHOD, SALETYPE } from "@/app/enums/order";
import type { DEBTRECORDINSERT } from "@/app/models/debt";

export const TANK_TYPE_ID = 14; // "ถังแก๊ส" ใน productsType

// ยอดเงินเป็นทศนิยม บวกหลายครั้งแล้วอาจคลาดเล็กน้อย จึงถือว่าครบเมื่อห่างกันไม่ถึงครึ่งสตางค์
const MONEY_EPSILON = 0.005;

export const DEBT_ORDER_FIELDS =
  "id, userId, totalAmount, status, paymentMethod, paymentStatus, orderItems(productId, quantity, saleType, products(typeId)), debtRecords(debtType)";

type DebtOrderItem = {
  productId: number | null;
  quantity: number;
  saleType: string;
  products: { typeId: number } | { typeId: number }[] | null;
};

export type DEBTORDER = {
  id: string;
  userId: string;
  totalAmount: number | string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  orderItems: DebtOrderItem[] | null;
  debtRecords: Array<{ debtType: string }> | null;
};

// ค้างถังเกิดจาก "เปลี่ยนถัง" เท่านั้น เพราะลูกค้าต้องคืนถังเปล่า ส่วนซื้อถังขาดไม่มีถังต้องคืน
export function isCartDebtItem(item: DebtOrderItem) {
  const product = Array.isArray(item.products) ? item.products[0] : item.products;
  return (
    product?.typeId === TANK_TYPE_ID &&
    item.saleType === SALETYPE.EXCHANGE &&
    !!item.productId &&
    item.quantity > 0
  );
}

/** ค้างเงิน 1 รายการเต็มยอดออเดอร์ ส่วนค้างถังแยกรายการตามสินค้า (นับเฉพาะรายการเปลี่ยนถัง) */
export function buildDebtRecords(
  order: DEBTORDER,
  debtType: DEBTCHOICE,
  recordedBy: string,
  note: string | null,
): DEBTRECORDINSERT[] {
  const records: DEBTRECORDINSERT[] = [];
  if (debtType === DEBTCHOICE.MONEY || debtType === DEBTCHOICE.BOTH) {
    records.push({ userId: order.userId, orderId: order.id, recordedBy, debtType: DEBTCHOICE.MONEY, amount: order.totalAmount, note });
  }
  if (debtType === DEBTCHOICE.CART || debtType === DEBTCHOICE.BOTH) {
    for (const item of (order.orderItems ?? []).filter(isCartDebtItem)) {
      records.push({ userId: order.userId, orderId: order.id, recordedBy, debtType: DEBTCHOICE.CART, productId: item.productId as number, amount: item.quantity, note });
    }
  }
  return records;
}

export type AUTODEBTRESULT = { created: number; warning: string | null };

/**
 * สร้างหนี้จากวิธีชำระที่ลูกค้าเลือก เมื่อออเดอร์จัดส่งแล้ว
 * เรียกซ้ำได้ปลอดภัย: ถ้าออเดอร์มีหนี้ประเภทนั้นอยู่แล้วจะไม่สร้างเพิ่ม
 */
export async function recordDebtForDeliveredOrder(
  supabase: SupabaseClient,
  orderId: string,
  recordedBy: string,
): Promise<AUTODEBTRESULT> {
  const failed = {
    created: 0,
    warning: "อัปเดตออเดอร์แล้ว แต่บันทึกหนี้อัตโนมัติไม่สำเร็จ กรุณาบันทึกเองในหน้าหนี้ค้าง",
  };

  const { data, error } = await supabase.from("orders").select(DEBT_ORDER_FIELDS).eq("id", orderId).maybeSingle();
  if (error || !data) return failed;
  const order = data as unknown as DEBTORDER;
  if (order.status !== ORDERSTATUS.DELIVERED) return { created: 0, warning: null };

  const existingTypes = new Set((order.debtRecords ?? []).map((debt) => debt.debtType));
  const wantsMoney = order.paymentMethod === PAYMENTMETHOD.PENDING_PAYMENT || order.paymentMethod === PAYMENTMETHOD.PENDING_BOTH;
  const wantsCart = order.paymentMethod === PAYMENTMETHOD.PENDING_CART || order.paymentMethod === PAYMENTMETHOD.PENDING_BOTH;
  // จ่ายเงินครบแล้วไม่มียอดให้ค้าง แต่ค้างถังยังต้องบันทึก เพราะจ่ายเงินแล้วก็ยังติดถังเปล่าได้
  const needsMoney = wantsMoney && order.paymentStatus !== ORDERPAYMENTSTATUS.PAID && !existingTypes.has(DEBTCHOICE.MONEY);
  const needsCart = wantsCart && !existingTypes.has(DEBTCHOICE.CART);
  if (!needsMoney && !needsCart) return { created: 0, warning: null };

  const debtType = needsMoney && needsCart ? DEBTCHOICE.BOTH : needsMoney ? DEBTCHOICE.MONEY : DEBTCHOICE.CART;
  const records = buildDebtRecords(order, debtType, recordedBy, "บันทึกอัตโนมัติจากวิธีชำระที่ลูกค้าเลือก");
  const noExchangeWarning = needsCart && !records.some((record) => record.debtType === DEBTCHOICE.CART)
    ? "ออเดอร์นี้เลือกค้างถังแต่ไม่มีรายการเปลี่ยนถัง จึงไม่ได้บันทึกหนี้ถัง"
    : null;
  if (records.length === 0) return { created: 0, warning: noExchangeWarning };

  const { error: insertError } = await supabase.from("debtRecords").insert(records);
  if (insertError) return failed;
  return { created: records.length, warning: noExchangeWarning };
}

/** เมื่อหนี้เงินของออเดอร์ครบทุกรายการ ให้ออเดอร์เป็น "ชำระแล้ว" ด้วย สองหน้าจะได้แสดงตรงกัน */
export async function markOrderPaidIfMoneyDebtsCleared(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from("debtRecords")
    .select("status")
    .eq("orderId", orderId)
    .eq("debtType", DEBTCHOICE.MONEY);
  if (error) return false;
  if (!data || data.length === 0 || data.some((debt) => debt.status !== DEBTSTATUS.PAID)) return true;

  const { error: updateError } = await supabase
    .from("orders")
    .update({ paymentStatus: ORDERPAYMENTSTATUS.PAID, paidAt: new Date().toISOString() })
    .eq("id", orderId)
    .neq("paymentStatus", ORDERPAYMENTSTATUS.PAID);
  return !updateError;
}

/** แอดมินกด "ชำระแล้ว" ในหน้าคำสั่งซื้อ: ปิดยอดเงินที่เหลือของออเดอร์นั้น ไม่แตะหนี้ค้างถัง */
export async function settleOrderMoneyDebts(supabase: SupabaseClient, orderId: string, recordedBy: string) {
  const { data, error } = await supabase
    .from("debtRecords")
    .select("id, amount, debtTransactions(amount)")
    .eq("orderId", orderId)
    .eq("debtType", DEBTCHOICE.MONEY)
    .neq("status", DEBTSTATUS.PAID);
  if (error) return false;

  for (const debt of data ?? []) {
    const settled = (debt.debtTransactions ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const remaining = Number(debt.amount) - settled;
    if (remaining > MONEY_EPSILON) {
      const { error: transactionError } = await supabase.from("debtTransactions").insert({
        debtRecordId: debt.id,
        transactionType: "payment",
        amount: Number(remaining.toFixed(2)),
        recordedBy,
        note: "ปิดยอดอัตโนมัติเมื่อแอดมินเปลี่ยนออเดอร์เป็นชำระแล้ว",
      });
      if (transactionError) return false;
    }
    const { error: updateError } = await supabase
      .from("debtRecords")
      .update({ status: DEBTSTATUS.PAID })
      .eq("id", debt.id);
    if (updateError) return false;
  }
  return true;
}

export function isFullySettled(total: number, settled: number) {
  return Math.abs(total - settled) < MONEY_EPSILON;
}
