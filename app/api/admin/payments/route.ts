import { after } from "next/server";
import { apiError } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import { MANUALSLIPOUTCOME } from "@/app/enums/order";
import {
  deleteQrSlip,
  getOrderPaymentView,
  recordManualSlipPayment,
  recordPartialQrPayment,
  rejectQrSlip,
  verifyQrPayment,
} from "@/app/api/services/paymentService";
import { convertImageToJpeg } from "@/app/api/services/imageService";
import { notifyCustomerSlipResult } from "@/app/api/services/lineSlipService";
import { isUuid } from "@/app/api/services/lineSlipShared";
import { authenticateAdmin } from "../authorization";

// ต้องตรงกับ MAX_UPLOAD_BYTES ใน app/util/compressImage.ts (ต่ำกว่าเพดาน request ของ Vercel)
const MAX_SLIP_FILE_SIZE = 4 * 1024 * 1024;
const SLIP_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_NOTE_LENGTH = 500;
const MANUAL_OUTCOMES = new Set<string>(Object.values(MANUALSLIPOUTCOME));

function isAdmin(role: ADMINROLE | null) {
  return role === ADMINROLE.ADMIN || role === ADMINROLE.SUPER_ADMIN;
}

// แจ้งผลตรวจสลิปเข้าแชท LINE ของลูกค้าหลังตอบแอดมินแล้ว ไม่ให้หน้าเว็บรอ LINE
function notifyCustomerAfterResponse(slipId: string) {
  after(() => notifyCustomerSlipResult(slipId));
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.admin.role)) return Response.json(apiError("Only admins can view payments"), { status: 403 });

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId?.trim()) return Response.json(apiError("Order id is required"), { status: 400 });

  if (!isUuid(orderId)) return Response.json(apiError("Order id is invalid"), { status: 400 });

  const result = await getOrderPaymentView(orderId, auth.adminSupabase);
  return Response.json(result.result, { status: result.status });
}

/** superAdmin อัปโหลดสลิปแทนลูกค้าแล้วบันทึกผลทันที (จ่ายครบ / ค้างเงิน / ค้างถัง / ค้างทั้งสอง) */
export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== ADMINROLE.SUPER_ADMIN) {
    return Response.json(apiError("เฉพาะ superAdmin เท่านั้นที่อัปโหลดสลิปแทนลูกค้าได้"), { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json(apiError("Request must use multipart/form-data"), { status: 400 });
  const orderId = form.get("orderId");
  const outcome = form.get("outcome");
  const file = form.get("file");
  const rawAmount = form.get("amount");
  const rawNote = form.get("note");

  if (!isUuid(orderId)) return Response.json(apiError("Order id is invalid"), { status: 400 });
  if (!MANUAL_OUTCOMES.has(outcome as string)) return Response.json(apiError("กรุณาเลือกผลการชำระ"), { status: 400 });
  if (!(file instanceof File) || file.size === 0) return Response.json(apiError("กรุณาเลือกรูปสลิป"), { status: 400 });
  if (!SLIP_IMAGE_TYPES.has(file.type) || file.size > MAX_SLIP_FILE_SIZE) {
    return Response.json(apiError("รูปต้องเป็น JPEG, PNG หรือ WebP ขนาดไม่เกิน 4 MB"), { status: 400 });
  }
  if (rawNote !== null && (typeof rawNote !== "string" || rawNote.length > MAX_NOTE_LENGTH)) {
    return Response.json(apiError(`หมายเหตุยาวได้ไม่เกิน ${MAX_NOTE_LENGTH} ตัวอักษร`), { status: 400 });
  }
  const amountText = typeof rawAmount === "string" ? rawAmount.trim() : "";
  const paidAmount = amountText ? Number(amountText) : null;
  if (paidAmount !== null && (!Number.isFinite(paidAmount) || !/^\d+(\.\d{1,2})?$/.test(amountText))) {
    return Response.json(apiError("ยอดที่ได้รับไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)"), { status: 400 });
  }

  // เก็บเป็น JPEG ให้การ์ดใน LINE แสดงรูปได้เหมือนสลิปที่ลูกค้าส่งในแชท
  const image = await convertImageToJpeg(file);
  if (!image) return Response.json(apiError("ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้"), { status: 400 });

  const result = await recordManualSlipPayment({
    orderId,
    image,
    outcome: outcome as MANUALSLIPOUTCOME,
    paidAmount,
    note: typeof rawNote === "string" ? rawNote.trim() || null : null,
    adminId: auth.admin.id,
  });
  if (result.result.status === "success") notifyCustomerAfterResponse(result.result.results.slipId);
  return Response.json(result.result, { status: result.status });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.admin.role)) return Response.json(apiError("Only admins can verify payments"), { status: 403 });

  const body = await request.json().catch(() => null) as { paymentId?: unknown; slipId?: unknown; action?: unknown; reason?: unknown; amount?: unknown; note?: unknown } | null;
  if (!body || typeof body.paymentId !== "string" || typeof body.slipId !== "string") {
    return Response.json(apiError("Payment id and slip id are required"), { status: 400 });
  }

  if (body.action === "reject") {
    if (typeof body.reason !== "string" || !body.reason.trim()) return Response.json(apiError("A rejection reason is required"), { status: 400 });
    const result = await rejectQrSlip(body.paymentId, body.slipId, body.reason.trim(), auth.supabase);
    if (result.status === 200) notifyCustomerAfterResponse(body.slipId);
    return Response.json(result.result, { status: result.status });
  }
  if (body.action === "partial") {
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return Response.json(apiError("A valid paid amount is required"), { status: 400 });
    if (body.note !== undefined && typeof body.note !== "string") return Response.json(apiError("Invalid note"), { status: 400 });
    const result = await recordPartialQrPayment(body.paymentId, body.slipId, amount, typeof body.note === "string" ? body.note.trim() || null : null, auth.supabase);
    if (result.status === 200) notifyCustomerAfterResponse(body.slipId);
    return Response.json(result.result, { status: result.status });
  }
  if (body.action !== undefined && body.action !== "verify") return Response.json(apiError("Invalid payment action"), { status: 400 });
  const result = await verifyQrPayment(body.paymentId, body.slipId, auth.supabase);
  if (result.status === 200) notifyCustomerAfterResponse(body.slipId);
  return Response.json(result.result, { status: result.status });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.admin.role)) return Response.json(apiError("Only admins can delete receipts"), { status: 403 });
  const params = new URL(request.url).searchParams;
  const paymentId = params.get("paymentId");
  const slipId = params.get("slipId");
  if (!paymentId || !slipId) return Response.json(apiError("Payment id and slip id are required"), { status: 400 });
  const result = await deleteQrSlip(paymentId, slipId, auth.adminSupabase);
  return Response.json(result.result, { status: result.status });
}
