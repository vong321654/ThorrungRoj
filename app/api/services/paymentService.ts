import type { SupabaseClient } from "@supabase/supabase-js";
import { apiError, apiSuccess } from "@/app/api/response";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { MANUALSLIPOUTCOME, ORDERSTATUS, PAYMENTMETHOD } from "@/app/enums/order";
import type { SERVICERESULT } from "@/app/models/api";
import { DEBT_ORDER_FIELDS, isCartDebtItem, recordDebtForDeliveredOrder, type DEBTORDER } from "./debtService";
import { RECEIPT_IMAGE_BUCKET } from "./imageService";

export type PAYMENTSLIP = {
  id: string;
  slipImageUrl: string;
  status: string;
  rejectReason: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export type ORDERPAYMENTVIEW = {
  order: {
    id: string;
    totalAmount: number | string;
    paymentMethod: string | null;
    paymentStatus: string;
    status: string;
    users: { name: string; phone: string | null; shopName: string | null } | null;
    debtRecords: Array<{ id: string; debtType: string; status: string }>;
  };
  /** รายการชำระแบบสแกนจ่ายของออเดอร์ null = ยังไม่มี (ออเดอร์เงินสด/ค้างชำระที่ยังไม่มีใครแนบสลิป) */
  payment: {
    id: string;
    amount: number | string;
    method: string;
    status: string;
    verifiedAt: string | null;
    createdAt: string;
    transferSlips: PAYMENTSLIP[];
  } | null;
};

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** ข้อมูลออเดอร์ + รายการชำระสแกนจ่ายและสลิป สำหรับหน้าตรวจการชำระของแอดมิน (ใช้ได้ทุกวิธีชำระ) */
export async function getOrderPaymentView(
  orderId: string,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<ORDERPAYMENTVIEW>> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, totalAmount, paymentMethod, paymentStatus, status, users(name, phone, shopName), debtRecords(id, debtType, status), payments(id, amount, method, status, verifiedAt, createdAt, transferSlips(id, slipImageUrl, status, rejectReason, verifiedBy, verifiedAt, createdAt))",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) return failure("Failed to load order payment", 500);
  if (!data) return failure("Order not found", 404);

  const payments = (data.payments ?? []) as Array<NonNullable<ORDERPAYMENTVIEW["payment"]>>;
  const payment = payments.find((row) => row.method === PAYMENTMETHOD.QR_SCAN) ?? null;
  const view: ORDERPAYMENTVIEW = {
    order: {
      id: data.id,
      totalAmount: data.totalAmount,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      status: data.status,
      users: firstRow(data.users as ORDERPAYMENTVIEW["order"]["users"] | ORDERPAYMENTVIEW["order"]["users"][]),
      debtRecords: (data.debtRecords ?? []) as ORDERPAYMENTVIEW["order"]["debtRecords"],
    },
    payment: payment
      ? {
          ...payment,
          transferSlips: [...(payment.transferSlips ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        }
      : null,
  };
  return { result: apiSuccess("Order payment retrieved successfully", view), status: 200 };
}

export type MANUALSLIPINPUT = {
  orderId: string;
  /** รูปสลิปที่แปลงเป็น JPEG แล้ว */
  image: Buffer;
  outcome: MANUALSLIPOUTCOME;
  /** ยอดที่ได้รับจริง ใช้เฉพาะ outcome ที่ได้รับเงินบางส่วน */
  paidAmount: number | null;
  note: string | null;
  adminId: string;
};

export type MANUALSLIPRESULT = {
  slipId: string;
  paymentId: string;
  outcome: MANUALSLIPOUTCOME;
  debtsCreated: number;
  warning: string | null;
};

type MANUALSLIPORDER = DEBTORDER & { payments: Array<{ id: string; method: string; status: string }> | null };

const PARTIAL_OUTCOMES = new Set([MANUALSLIPOUTCOME.PENDING_PAYMENT, MANUALSLIPOUTCOME.PENDING_BOTH]);
const CART_OUTCOMES = new Set([MANUALSLIPOUTCOME.PENDING_CART, MANUALSLIPOUTCOME.PENDING_BOTH]);
// วิธีชำระของออเดอร์หลังบันทึก ค้างเงินอย่างเดียว ฟังก์ชันใน DB ตั้งเป็น pendingPayment ให้แล้ว
const FINAL_PAYMENT_METHOD: Partial<Record<MANUALSLIPOUTCOME, PAYMENTMETHOD>> = {
  [MANUALSLIPOUTCOME.PAID]: PAYMENTMETHOD.QR_SCAN,
  [MANUALSLIPOUTCOME.PENDING_CART]: PAYMENTMETHOD.PENDING_CART,
  [MANUALSLIPOUTCOME.PENDING_BOTH]: PAYMENTMETHOD.PENDING_BOTH,
};

/**
 * superAdmin อัปโหลดสลิปแทนลูกค้า (เช่น ลูกค้าส่งสลิปมาในแชท LINE ของร้าน) แล้วบันทึกผลทันที
 * - ใช้ได้ทุกวิธีชำระ ถ้าออเดอร์ยังไม่มีรายการชำระแบบสแกนจ่าย จะสร้างให้แล้วเปลี่ยนวิธีชำระตามผลที่เลือก
 * - ยืนยัน/รับชำระบางส่วนผ่านฟังก์ชันเดียวกับปุ่มในหน้านี้ (verify_qr_payment / record_partial_qr_payment) ซึ่งทำใน transaction เดียว
 * - ถ้าขั้นยืนยันพลาด จะลบสลิป ไฟล์ และรายการชำระที่เพิ่งสร้างออก ให้ออเดอร์กลับเป็นเหมือนเดิม
 * ใช้ service role เพราะ RLS ให้เฉพาะลูกค้าเจ้าของออเดอร์ insert payments/transferSlips ผู้เรียกต้องตรวจว่าเป็น superAdmin แล้ว
 */
export async function recordManualSlipPayment(input: MANUALSLIPINPUT): Promise<SERVICERESULT<MANUALSLIPRESULT>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`${DEBT_ORDER_FIELDS}, payments(id, method, status)`)
    .eq("id", input.orderId)
    .maybeSingle();
  if (error) return failure("Failed to load order", 500);
  if (!data) return failure("ไม่พบคำสั่งซื้อ", 404);
  const order = data as unknown as MANUALSLIPORDER;

  if (order.status === ORDERSTATUS.CANCELLED) return failure("ออเดอร์นี้ถูกยกเลิกแล้ว", 409);
  if (order.paymentStatus === "paid") return failure("ออเดอร์นี้ชำระเงินแล้ว", 409);
  if ((order.debtRecords ?? []).length > 0) {
    return failure("ออเดอร์นี้มีรายการหนี้แล้ว กรุณาบันทึกรับชำระในหน้าหนี้ค้าง", 409);
  }
  const payments = order.payments ?? [];
  if (payments.some((row) => row.status === "paid")) return failure("ออเดอร์นี้บันทึกรับชำระไปแล้ว", 409);

  const total = Number(order.totalAmount);
  if (PARTIAL_OUTCOMES.has(input.outcome)) {
    const amount = input.paidAmount;
    if (amount === null || !Number.isFinite(amount) || amount <= 0 || amount >= total) {
      return failure("ยอดที่ได้รับต้องมากกว่า 0 และน้อยกว่ายอดออเดอร์", 400);
    }
  }
  if (CART_OUTCOMES.has(input.outcome) && !(order.orderItems ?? []).some(isCartDebtItem)) {
    return failure("ออเดอร์นี้ไม่มีรายการเปลี่ยนถัง จึงบันทึกค้างถังไม่ได้", 400);
  }

  // ใช้รายการชำระสแกนจ่ายเดิมถ้ามี ไม่มีก็สร้างใหม่ (ออเดอร์เงินสด/ค้างชำระที่ลูกค้าโอนมาภายหลัง)
  let paymentId = payments.find((row) => row.method === PAYMENTMETHOD.QR_SCAN)?.id ?? null;
  let createdPaymentId: string | null = null;
  if (!paymentId) {
    const { data: created, error: paymentError } = await supabase
      .from("payments")
      .insert({ orderId: order.id, amount: total, method: PAYMENTMETHOD.QR_SCAN })
      .select("id")
      .single();
    if (paymentError || !created) return failure("สร้างรายการชำระเงินไม่สำเร็จ", 500);
    paymentId = createdPaymentId = created.id as string;

    // กดบันทึกพร้อมกัน 2 ครั้ง (เช่น superAdmin 2 คน) จะได้รายการสแกนจ่าย 2 แถวแล้วรับเงินซ้ำ
    // เช็กหลังสร้าง: ถ้ามีมากกว่า 1 แถว ให้ลบของตัวเองแล้วให้ลองใหม่ (คำขอที่เช็กทีหลังจะเห็นแถวของอีกฝั่งเสมอ)
    const { data: qrPayments, error: qrPaymentsError } = await supabase
      .from("payments")
      .select("id")
      .eq("orderId", order.id)
      .eq("method", PAYMENTMETHOD.QR_SCAN);
    if (qrPaymentsError || (qrPayments ?? []).length !== 1) {
      await supabase.from("payments").delete().eq("id", createdPaymentId).eq("status", "pending");
      return failure("มีการบันทึกการชำระของออเดอร์นี้พร้อมกัน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง", 409);
    }
  }

  const path = `receipts/${order.userId}/${paymentId}/admin-${crypto.randomUUID()}.jpg`;
  let slipId: string | null = null;
  const rollback = async () => {
    if (slipId) {
      // ลบเฉพาะสลิปที่ยัง pending: ถ้า RPC ทำสำเร็จใน DB แต่คำตอบหลุดกลางทาง สลิปจะเป็น verified แล้ว ห้ามลบหลักฐานการรับเงิน
      const { data: removed } = await supabase
        .from("transferSlips")
        .delete()
        .eq("id", slipId)
        .eq("status", "pending")
        .select("id");
      if ((removed ?? []).length === 0) return;
    }
    await supabase.storage.from(RECEIPT_IMAGE_BUCKET).remove([path]);
    if (createdPaymentId) await supabase.from("payments").delete().eq("id", createdPaymentId).eq("status", "pending");
  };

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_IMAGE_BUCKET)
    .upload(path, input.image, { contentType: "image/jpeg", upsert: false });
  if (uploadError) {
    await rollback();
    return failure("อัปโหลดรูปสลิปไม่สำเร็จ", 500);
  }

  const { data: slip, error: slipError } = await supabase
    .from("transferSlips")
    .insert({ paymentId, userId: order.userId, slipImageUrl: path })
    .select("id")
    .single();
  if (slipError || !slip) {
    await rollback();
    return failure("บันทึกสลิปไม่สำเร็จ", 500);
  }
  slipId = slip.id as string;

  const { error: rpcError } = PARTIAL_OUTCOMES.has(input.outcome)
    ? await supabase.rpc("record_partial_qr_payment", {
        p_payment_id: paymentId,
        p_slip_id: slipId,
        p_paid_amount: input.paidAmount,
        p_note: input.note,
        p_admin_id: input.adminId,
      })
    : await supabase.rpc("verify_qr_payment", {
        p_payment_id: paymentId,
        p_slip_id: slipId,
        p_admin_id: input.adminId,
      });
  if (rpcError) {
    await rollback();
    return failure(`บันทึกการชำระไม่สำเร็จ: ${rpcError.message}`, 400);
  }

  // รับเงินบันทึกแล้ว ขั้นต่อจากนี้ถ้าพลาดให้เตือนแทน error เพราะห้ามให้กดซ้ำจนรับเงินซ้ำ
  let warning: string | null = null;
  const finalMethod = FINAL_PAYMENT_METHOD[input.outcome];
  // รับชำระบางส่วน: ฟังก์ชันใน DB เพิ่งเปลี่ยนเป็น pendingPayment จึงเทียบกับค่าเดิมก่อนบันทึกไม่ได้
  // (เช่น ออเดอร์ที่ลูกค้าเลือกค้างทั้งถังและเงินไว้แต่แรก ถ้าข้ามไปจะไม่ได้บันทึกหนี้ถังตอนจัดส่ง)
  if (finalMethod && (PARTIAL_OUTCOMES.has(input.outcome) || order.paymentMethod !== finalMethod)) {
    const { error: methodError } = await supabase
      .from("orders")
      .update({ paymentMethod: finalMethod, updatedAt: new Date().toISOString() })
      .eq("id", order.id);
    if (methodError) warning = "บันทึกรับชำระแล้ว แต่เปลี่ยนวิธีชำระของออเดอร์ไม่สำเร็จ กรุณาตรวจสอบในหน้าคำสั่งซื้อ";
  }
  // ออเดอร์ที่จัดส่งแล้วต้องบันทึกหนี้ถังทันที ถ้ายังไม่ส่งจะบันทึกเองตอนเปลี่ยนเป็นจัดส่งแล้ว
  const debtResult = await recordDebtForDeliveredOrder(supabase, order.id, input.adminId);

  return {
    result: apiSuccess("บันทึกสลิปและการชำระเรียบร้อย", {
      slipId,
      paymentId,
      outcome: input.outcome,
      debtsCreated: debtResult.created,
      warning: warning ?? debtResult.warning,
    }),
    status: 201,
  };
}

export async function verifyQrPayment(
  paymentId: string,
  slipId: string,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase
    .rpc("verify_qr_payment_as_admin", {
      p_payment_id: paymentId,
      p_slip_id: slipId,
    })
    .single();

  if (error || !data) return failure("Unable to verify QR payment", 400);
  return { result: apiSuccess("QR payment verified successfully", data), status: 200 };
}

export async function rejectQrSlip(
  paymentId: string,
  slipId: string,
  reason: string,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase.rpc("reject_qr_payment_slip_as_admin", {
    p_payment_id: paymentId,
    p_slip_id: slipId,
    p_reason: reason,
  }).single();
  if (error || !data) return failure("Unable to reject QR payment slip", 400);
  return { result: apiSuccess("QR payment slip rejected", data), status: 200 };
}

export async function recordPartialQrPayment(
  paymentId: string,
  slipId: string,
  amount: number,
  note: string | null,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase.rpc("record_partial_qr_payment_as_admin", {
    p_payment_id: paymentId,
    p_slip_id: slipId,
    p_paid_amount: amount,
    p_note: note,
  }).single();
  if (error || !data) return failure("Unable to record partial payment", 400);
  return { result: apiSuccess("Partial payment and debt recorded successfully", data), status: 200 };
}

export async function deleteQrSlip(
  paymentId: string,
  slipId: string,
  supabase: SupabaseClient,
) : Promise<SERVICERESULT<unknown>> {
  const { data: slip, error: slipError } = await supabase
    .from("transferSlips")
    .select("id, slipImageUrl, status")
    .eq("id", slipId)
    .eq("paymentId", paymentId)
    .maybeSingle();
  if (slipError) return failure("Failed to load receipt", 500);
  if (!slip) return failure("Receipt not found", 404);
  if (slip.status === "verified") return failure("A verified receipt cannot be deleted", 400);

  const { error } = await supabase.from("transferSlips").delete().eq("id", slip.id);
  if (error) return failure("Failed to delete receipt", 500);
  const { error: storageError } = await supabase.storage.from("payment-receipts").remove([slip.slipImageUrl]);
  if (storageError) return failure("Receipt was deleted but its image could not be removed", 500);
  return { result: apiSuccess("Receipt deleted successfully", { id: slip.id }), status: 200 };
}
