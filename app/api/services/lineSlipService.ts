import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { convertBufferToJpeg, RECEIPT_IMAGE_BUCKET, storagePathFromUrl } from "./imageService";
import { lineAccessToken, publicUrl, pushLineMessages, replyLineMessages, type LineMessage } from "./lineMessagingClient";
import {
  buildSlipPostback,
  formatBaht,
  isLineUserId,
  orderShortId,
  parseSlipApprovers,
  parseSlipPostback,
  quickReplyLabel,
  SLIP_ACTION,
  SLIP_REJECT_REASONS,
  type SLIPPOSTBACK,
} from "./lineSlipShared";

// ระบบรับสลิปโอนเงินผ่านแชท LINE OA
// 1) ลูกค้าส่งรูปในแชท → ผูกกับออเดอร์สแกนจ่ายที่รอชำระ → เก็บรูปใน bucket payment-receipts + แถว transferSlips (pending)
// 2) push การ์ดพร้อมปุ่ม ยืนยัน/ปฏิเสธ ไปหาแอดมินที่อยู่ใน LINE_SLIP_APPROVERS
// 3) แอดมินกดปุ่ม → เรียก verify_qr_payment / reject_qr_payment_slip (ฟังก์ชันเดียวกับที่หน้าเว็บแอดมินใช้) → แจ้งผลลูกค้า
// ลำดับสำคัญ: เมื่อบันทึกลง DB แล้ว ต้องแจ้งอีกฝ่าย (push) ก่อนตอบคนกด (reply) เพราะ reply token อาจหมดอายุแล้ว throw

const LINE_CONTENT_URL = "https://api-data.line.me/v2/bot/message";
const DOWNLOAD_TIMEOUT_MS = 15000;
const MAX_SLIP_BYTES = 10 * 1024 * 1024;
const MAX_PENDING_CHOICES = 10; // quick reply มีได้ไม่เกิน 13 ปุ่ม
// การ์ดแจ้งแอดมินโหลดรูปจากลิงก์นี้ทุกครั้งที่เปิดแชท ให้อยู่นานพอที่แอดมินจะตรวจทัน
const ADMIN_PREVIEW_URL_SECONDS = 7 * 24 * 60 * 60;
const ADMIN_ROLES = ["admin", "superAdmin"];
const SAVE_FAILED_REPLY = "บันทึกสลิปไม่สำเร็จ กรุณาส่งรูปสลิปใหม่อีกครั้ง หรือแนบที่หน้าคำสั่งซื้อครับ";

type CUSTOMER = { id: string; name: string | null };
type PENDINGPAYMENT = { id: string; amount: number | string; orderId: string };
type APPROVERPOSTBACK = Exclude<SLIPPOSTBACK, { action: typeof SLIP_ACTION.PICK }>;

function textMessage(text: string, quickReply?: { items: unknown[] }): LineMessage {
  return quickReply ? { type: "text", text, quickReply } : { type: "text", text };
}

function logError(scope: string, error: unknown) {
  // eslint-disable-next-line no-console -- ให้เห็น error ใน Vercel logs
  console.error(`[line slip] ${scope}`, error);
}

/** ตอบกลับโดยไม่ throw ใช้หลังจากบันทึกข้อมูลไปแล้ว การตอบพลาดต้องไม่ทำให้ขั้นต่อไปหาย */
async function safeReply(replyToken: string, messages: LineMessage[]) {
  try {
    await replyLineMessages(replyToken, messages);
  } catch (error) {
    logError("reply failed", error);
  }
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function findCustomer(supabase: SupabaseClient, lineUserId: string): Promise<CUSTOMER | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, isActive")
    .eq("lineUserId", lineUserId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load customer: ${error.message}`);
  if (!data || !data.isActive) return null;
  return { id: data.id, name: data.name };
}

/** ออเดอร์สแกนจ่ายของลูกค้าที่ยังไม่ได้ชำระและไม่ถูกยกเลิก ใหม่สุดก่อน */
async function listPendingQrPayments(supabase: SupabaseClient, userId: string): Promise<PENDINGPAYMENT[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, orderId, orders!inner(id, userId, status)")
    .eq("method", "qrScan")
    .eq("status", "pending")
    .eq("orders.userId", userId)
    .neq("orders.status", "cancelled")
    .order("createdAt", { ascending: false })
    .limit(MAX_PENDING_CHOICES);
  if (error) throw new Error(`Failed to load pending payments: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, amount: row.amount, orderId: row.orderId }));
}

type DOWNLOADRESULT = { ok: true; image: Buffer } | { ok: false; reason: "expired" | "tooLarge" };

async function downloadLineImage(messageId: string): Promise<DOWNLOADRESULT> {
  const response = await fetch(`${LINE_CONTENT_URL}/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${lineAccessToken()}` },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  // LINE เก็บไฟล์ไว้ระยะหนึ่งแล้วลบ ถ้าหาไม่เจอให้ลูกค้าส่งใหม่
  if (response.status === 404 || response.status === 410) return { ok: false, reason: "expired" };
  if (!response.ok) throw new Error(`LINE content download failed: ${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_SLIP_BYTES) return { ok: false, reason: "tooLarge" };
  const image = Buffer.from(await response.arrayBuffer());
  if (image.length > MAX_SLIP_BYTES) return { ok: false, reason: "tooLarge" };
  return { ok: true, image };
}

function approverMap() {
  const { approvers, invalid } = parseSlipApprovers(process.env.LINE_SLIP_APPROVERS);
  if (invalid.length > 0) logError("ignored invalid LINE_SLIP_APPROVERS entries", invalid.length);
  return approvers;
}

/** LINE userId ของผู้อนุมัติที่ยังเป็นแอดมินที่ใช้งานอยู่จริง (คนที่ถูกปิดบัญชีหรือลดสิทธิ์แล้วต้องไม่ได้รับรูปสลิป) */
async function activeApproverLineIds(supabase: SupabaseClient) {
  const approvers = approverMap();
  if (approvers.size === 0) return [];
  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .in("id", [...new Set(approvers.values())])
    .eq("isActive", true)
    .in("role", ADMIN_ROLES);
  if (error) throw new Error(`Failed to load approvers: ${error.message}`);
  const activeIds = new Set((data ?? []).map((row) => String(row.id).toLowerCase()));
  return [...approvers].filter(([, employeeId]) => activeIds.has(employeeId)).map(([lineUserId]) => lineUserId);
}

/** ชื่อไฟล์ใช้ messageId ของ LINE ทำให้ event เดียวกันที่ LINE ส่งซ้ำ (redelivery) หรือกดเลือกซ้ำ ไม่สร้างสลิปซ้ำ */
function slipPath(customerId: string, paymentId: string, messageId: string) {
  return `receipts/${customerId}/${paymentId}/line-${messageId}.jpg`;
}

async function slipExists(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.from("transferSlips").select("id").eq("slipImageUrl", path).limit(1);
  if (error) throw new Error(`Failed to check duplicate slip: ${error.message}`);
  return (data ?? []).length > 0;
}

function isDuplicateUpload(error: { message?: string; statusCode?: string | number } & object) {
  return String(error.statusCode) === "409" || /already exists|duplicate/i.test(error.message ?? "");
}

type ATTACHRESULT =
  | { kind: "saved"; slipId: string }
  | { kind: "duplicate" }
  | { kind: "expired" }
  | { kind: "tooLarge" }
  | { kind: "notImage" };

/** ดึงรูปจาก LINE แปลงเป็น JPEG เก็บลง storage และสร้างแถว transferSlips */
async function saveSlipFromLine(
  supabase: SupabaseClient,
  customer: CUSTOMER,
  payment: PENDINGPAYMENT,
  messageId: string,
): Promise<ATTACHRESULT> {
  const path = slipPath(customer.id, payment.id, messageId);
  if (await slipExists(supabase, path)) return { kind: "duplicate" };

  const download = await downloadLineImage(messageId);
  if (!download.ok) return { kind: download.reason };
  const jpeg = await convertBufferToJpeg(download.image);
  if (!jpeg) return { kind: "notImage" };

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_IMAGE_BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (uploadError && isDuplicateUpload(uploadError)) {
    // ไฟล์มีอยู่แล้ว: ถ้ามีแถวสลิปแล้วคือรายการซ้ำจริง
    // ถ้ายังไม่มีแถว (ครั้งก่อนบันทึกค้างกลางทาง) ไฟล์นั้นคือรูปเดียวกันเพราะชื่อไฟล์ผูกกับ messageId จึงบันทึกแถวต่อได้เลย
    if (await slipExists(supabase, path)) return { kind: "duplicate" };
  } else if (uploadError) {
    throw new Error(`Failed to upload slip: ${uploadError.message}`);
  }

  const { data: slip, error: insertError } = await supabase
    .from("transferSlips")
    .insert({ paymentId: payment.id, userId: customer.id, slipImageUrl: path })
    .select("id")
    .single();
  if (insertError || !slip) {
    await supabase.storage.from(RECEIPT_IMAGE_BUCKET).remove([path]);
    throw new Error(`Failed to save slip: ${insertError?.message ?? "no row returned"}`);
  }
  return { kind: "saved", slipId: slip.id };
}

async function attachSlipFromLine(
  supabase: SupabaseClient,
  customer: CUSTOMER,
  payment: PENDINGPAYMENT,
  messageId: string,
  replyToken: string,
) {
  let result: ATTACHRESULT;
  try {
    result = await saveSlipFromLine(supabase, customer, payment, messageId);
  } catch (error) {
    // บอกลูกค้าว่าไม่สำเร็จ ดีกว่าเงียบไป แล้วให้ handleLineEvents log error ต่อ
    await safeReply(replyToken, [textMessage(SAVE_FAILED_REPLY)]);
    throw error;
  }

  if (result.kind === "saved") {
    // แจ้งแอดมินก่อน เพราะสลิปบันทึกแล้ว ต่อให้ตอบลูกค้าไม่สำเร็จแอดมินก็ต้องรู้
    await notifyApproversNewSlip(result.slipId);
    await safeReply(replyToken, [textMessage(
      [
        "ได้รับสลิปแล้วครับ 🙏",
        `ออเดอร์ ${orderShortId(payment.orderId)} ยอด ${formatBaht(payment.amount)}`,
        "รอร้านตรวจสอบสักครู่ ตรวจเสร็จแล้วจะแจ้งในแชทนี้ครับ",
      ].join("\n"),
    )]);
    return;
  }

  const messages: Record<Exclude<ATTACHRESULT["kind"], "saved">, string> = {
    duplicate: "ได้รับสลิปนี้แล้วครับ รอร้านตรวจสอบสักครู่",
    expired: "ไม่พบรูปสลิปแล้ว (ระบบ LINE ลบรูปเก่าออก) กรุณาส่งรูปสลิปใหม่อีกครั้งครับ",
    tooLarge: "รูปมีขนาดใหญ่เกิน 10 MB กรุณาส่งรูปสลิปที่เล็กกว่านี้ครับ",
    notImage: "ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้ กรุณาส่งรูปสลิปเป็นรูปภาพครับ",
  };
  await safeReply(replyToken, [textMessage(messages[result.kind])]);
}

/**
 * รูปที่ลูกค้าส่งเข้าแชท คืน true เมื่อจัดการเป็นสลิปแล้ว
 * คืน false เมื่อไม่ใช่เรื่องสลิป (ไม่พบลูกค้าหรือไม่มีออเดอร์รอชำระ) ให้แชทบอทตอบตามปกติ
 */
export async function handleSlipImageMessage(input: {
  lineUserId: string;
  messageId: string;
  contentProviderType?: string;
  replyToken: string;
}): Promise<boolean> {
  const supabase = createAdminClient();
  const customer = await findCustomer(supabase, input.lineUserId);
  if (!customer) return false;
  const payments = await listPendingQrPayments(supabase, customer.id);
  if (payments.length === 0) return false;

  // รูปที่ส่งผ่านลิงก์ภายนอก (ไม่ใช่อัปโหลดเข้า LINE) ดึงไฟล์ผ่าน API ไม่ได้
  if (input.contentProviderType && input.contentProviderType !== "line") {
    await replyLineMessages(input.replyToken, [textMessage("รูปนี้เปิดจากระบบไม่ได้ กรุณาส่งรูปสลิปจากอัลบั้มในเครื่องอีกครั้งครับ")]);
    return true;
  }

  if (payments.length === 1) {
    await attachSlipFromLine(supabase, customer, payments[0], input.messageId, input.replyToken);
    return true;
  }

  // มีหลายออเดอร์รอชำระ ห้ามเดา ให้ลูกค้าเลือกเอง
  const items = payments.map((payment) => ({
    type: "action",
    action: {
      type: "postback",
      label: quickReplyLabel(`${orderShortId(payment.orderId)} ${formatBaht(payment.amount).replace(" บาท", "฿")}`),
      data: buildSlipPostback({ action: SLIP_ACTION.PICK, messageId: input.messageId, paymentId: payment.id }),
      displayText: `แนบสลิปกับออเดอร์ ${orderShortId(payment.orderId)}`,
    },
  }));
  await replyLineMessages(input.replyToken, [textMessage(
    "คุณมีหลายออเดอร์ที่รอชำระ สลิปนี้เป็นของออเดอร์ไหนครับ? เลือกจากปุ่มด้านล่างได้เลย",
    { items },
  )]);
  return true;
}

async function handleCustomerPick(lineUserId: string, messageId: string, paymentId: string, replyToken: string) {
  const supabase = createAdminClient();
  const customer = await findCustomer(supabase, lineUserId);
  if (!customer) {
    await replyLineMessages(replyToken, [textMessage("ไม่พบบัญชีลูกค้า กรุณาเปิดเมนูสั่งซื้อในแชทนี้ก่อนครับ")]);
    return;
  }
  // ตรวจว่า payment เป็นของคนที่กดจริงและยังรอชำระอยู่ ไม่เชื่อ paymentId จาก postback ตรงๆ
  const payment = (await listPendingQrPayments(supabase, customer.id)).find((row) => row.id === paymentId);
  if (!payment) {
    await replyLineMessages(replyToken, [textMessage("ออเดอร์นี้ไม่ได้รอชำระแล้วครับ (อาจชำระแล้วหรือถูกยกเลิก)")]);
    return;
  }
  await attachSlipFromLine(supabase, customer, payment, messageId, replyToken);
}

type SLIPDETAILS = {
  id: string;
  status: string;
  rejectReason: string | null;
  slipImageUrl: string;
  createdAt: string;
  paymentId: string;
  paymentStatus: string;
  amount: number | string;
  orderId: string;
  orderStatus: string;
  orderTotal: number | string;
  customerName: string | null;
  customerLineUserId: string | null;
};

async function loadSlip(supabase: SupabaseClient, slipId: string): Promise<SLIPDETAILS | null> {
  const { data, error } = await supabase
    .from("transferSlips")
    .select(
      "id, status, rejectReason, slipImageUrl, createdAt, paymentId, payments!inner(id, status, amount, orderId, orders!inner(id, status, totalAmount, users(name, shopName, lineUserId)))",
    )
    .eq("id", slipId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load slip: ${error.message}`);
  if (!data) return null;
  const payment = firstRow(data.payments as unknown as Record<string, unknown> | Record<string, unknown>[]);
  const order = firstRow(payment?.orders as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const user = firstRow(order?.users as Record<string, unknown> | Record<string, unknown>[] | undefined);
  if (!payment || !order) return null;
  return {
    id: data.id,
    status: data.status,
    rejectReason: data.rejectReason,
    slipImageUrl: data.slipImageUrl,
    createdAt: data.createdAt,
    paymentId: data.paymentId,
    paymentStatus: String(payment.status),
    amount: payment.amount as number | string,
    orderId: String(order.id),
    orderStatus: String(order.status),
    orderTotal: order.totalAmount as number | string,
    customerName: (user?.shopName as string | null) || (user?.name as string | null) || null,
    customerLineUserId: (user?.lineUserId as string | null) ?? null,
  };
}

function infoRow(label: string, value: string) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 3 },
      { type: "text", text: value || "-", size: "sm", color: "#222222", flex: 5, wrap: true },
    ],
  };
}

function formatThaiTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}

/**
 * แจ้งแอดมินที่อยู่ใน LINE_SLIP_APPROVERS (และยังเป็นแอดมินที่ใช้งานอยู่) ว่ามีสลิปใหม่ พร้อมปุ่มยืนยัน/ปฏิเสธ
 * ใช้ทั้งสลิปจากแชท LINE และสลิปที่ลูกค้าแนบบนหน้าเว็บ ส่งไม่สำเร็จจะ log ไว้ ไม่ throw
 * ลิงก์หน้าแอดมินสร้างจาก env เท่านั้น ไม่ใช้โดเมนจาก request เพราะลูกค้าปลอม header ได้
 */
export async function notifyApproversNewSlip(slipId: string) {
  try {
    const supabase = createAdminClient();
    const approverLineIds = await activeApproverLineIds(supabase);
    if (approverLineIds.length === 0) {
      logError("no active LINE_SLIP_APPROVERS, admin was not notified for slip", slipId);
      return;
    }
    const slip = await loadSlip(supabase, slipId);
    // ไม่ส่งการ์ดที่กดอะไรไม่ได้ (สลิปตรวจแล้ว ออเดอร์ชำระแล้ว หรือถูกยกเลิก)
    if (!slip || slip.status !== "pending" || slip.paymentStatus === "paid" || slip.orderStatus === "cancelled") return;

    // การ์ด Flex แสดงได้เฉพาะ JPEG/PNG สลิปจากหน้าเว็บเป็น WebP จึงแสดงเป็นปุ่มเปิดหน้าแอดมินแทนรูป
    const path = storagePathFromUrl(slip.slipImageUrl, RECEIPT_IMAGE_BUCKET) ?? slip.slipImageUrl;
    let imageUrl: string | null = null;
    if (/\.(jpe?g|png)$/i.test(path)) {
      const { data } = await supabase.storage.from(RECEIPT_IMAGE_BUCKET).createSignedUrl(path, ADMIN_PREVIEW_URL_SECONDS);
      imageUrl = data?.signedUrl ?? null;
    }
    const adminUrl = publicUrl(`/admin/orders/${slip.orderId}`);
    const shortId = orderShortId(slip.orderId);

    const footer: Record<string, unknown>[] = [
      {
        type: "button",
        style: "primary",
        color: "#2E7D32",
        height: "sm",
        action: {
          type: "postback",
          label: "✅ ยืนยันการชำระ",
          data: buildSlipPostback({ action: SLIP_ACTION.VERIFY, paymentId: slip.paymentId, slipId: slip.id }),
          displayText: `ยืนยันสลิป ${shortId}`,
        },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "postback",
          label: "❌ ปฏิเสธ",
          data: buildSlipPostback({ action: SLIP_ACTION.REJECT_ASK, paymentId: slip.paymentId, slipId: slip.id }),
          displayText: `ปฏิเสธสลิป ${shortId}`,
        },
      },
    ];
    if (adminUrl) footer.push({ type: "button", style: "link", height: "sm", action: { type: "uri", label: "เปิดในหน้าแอดมิน", uri: adminUrl } });

    const bubble: Record<string, unknown> = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "🧾 สลิปใหม่รอตรวจ", weight: "bold", size: "lg" },
          infoRow("ลูกค้า", slip.customerName ?? "-"),
          infoRow("ออเดอร์", shortId),
          infoRow("ยอดที่ต้องชำระ", formatBaht(slip.amount)),
          infoRow("ส่งเมื่อ", formatThaiTime(slip.createdAt)),
          ...(imageUrl ? [] : [{ type: "text", text: "ดูรูปสลิปได้ที่หน้าแอดมิน", size: "xs", color: "#888888", wrap: true }]),
        ],
      },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: footer },
    };
    if (imageUrl) {
      bubble.hero = {
        type: "image",
        url: imageUrl,
        size: "full",
        aspectRatio: "3:4",
        aspectMode: "fit",
        backgroundColor: "#F2F2F2",
        action: { type: "uri", uri: imageUrl },
      };
    }

    const message: LineMessage = {
      type: "flex",
      altText: `สลิปใหม่รอตรวจ ${shortId} ยอด ${formatBaht(slip.amount)}`,
      contents: bubble,
    };
    const results = await Promise.allSettled(approverLineIds.map((lineUserId) => pushLineMessages(lineUserId, [message])));
    for (const result of results) if (result.status === "rejected") logError("notify approver failed", result.reason);
  } catch (error) {
    logError("notifyApproversNewSlip", error);
  }
}

/**
 * แจ้งลูกค้าในแชท LINE เมื่อสลิปถูกยืนยัน (เต็มจำนวนหรือบางส่วน) หรือถูกปฏิเสธ ทั้งจากปุ่มในแชทและจากหน้าเว็บแอดมิน
 * ข้ามลูกค้าที่ไม่มี LINE จริง (สร้างมือ manual: หรือถูกลบข้อมูล erased:) ส่งไม่สำเร็จจะ log ไว้ ไม่ throw
 */
export async function notifyCustomerSlipResult(slipId: string) {
  try {
    const slip = await loadSlip(createAdminClient(), slipId);
    if (!slip || !isLineUserId(slip.customerLineUserId)) return;
    const shortId = orderShortId(slip.orderId);
    let text: string;
    if (slip.status === "verified") {
      const remaining = Number(slip.orderTotal) - Number(slip.amount);
      text = [
        "✅ ร้านยืนยันการชำระเงินแล้วครับ",
        `ออเดอร์ ${shortId} ยอดที่ได้รับ ${formatBaht(slip.amount)}`,
        // รับชำระบางส่วน: ส่วนที่เหลือถูกบันทึกเป็นค้างชำระ
        ...(remaining > 0 ? [`ยอดคงเหลือ ${formatBaht(remaining)} บันทึกเป็นค้างชำระ`] : []),
        "ขอบคุณที่ใช้บริการครับ",
      ].join("\n");
    } else if (slip.status === "rejected") {
      text = [
        `❌ สลิปของออเดอร์ ${shortId} ไม่ผ่านการตรวจสอบ`,
        `เหตุผล: ${slip.rejectReason ?? "-"}`,
        "กรุณาส่งรูปสลิปที่ถูกต้องในแชทนี้ หรือแนบที่หน้าคำสั่งซื้อครับ",
      ].join("\n");
    } else {
      return;
    }
    await pushLineMessages(slip.customerLineUserId, [textMessage(text)]);
  } catch (error) {
    logError("notifyCustomerSlipResult", error);
  }
}

/** เช็กว่าคนกดปุ่มเป็นแอดมินที่ยังใช้งานอยู่ คืน employeeId หรือ null */
async function resolveApprover(supabase: SupabaseClient, lineUserId: string) {
  const employeeId = approverMap().get(lineUserId);
  if (!employeeId) return null;
  const { data, error } = await supabase
    .from("employees")
    .select("id, role, isActive")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load approver: ${error.message}`);
  return data && data.isActive && ADMIN_ROLES.includes(data.role) ? data.id as string : null;
}

/** อธิบายว่าทำไมยืนยัน/ปฏิเสธไม่ได้ เช่น มีคนกดไปก่อนแล้ว หรือออเดอร์ถูกยกเลิก */
function describeSlipState(slip: SLIPDETAILS | null) {
  if (!slip) return "ไม่พบสลิปนี้แล้ว (อาจถูกลบไปจากหน้าแอดมิน)";
  const shortId = orderShortId(slip.orderId);
  if (slip.status === "verified") return `สลิปออเดอร์ ${shortId} ถูกยืนยันไปแล้ว`;
  if (slip.status === "rejected") return `สลิปออเดอร์ ${shortId} ถูกปฏิเสธไปแล้ว (${slip.rejectReason ?? "-"})`;
  if (slip.paymentStatus === "paid") return `ออเดอร์ ${shortId} ชำระเรียบร้อยแล้ว`;
  if (slip.orderStatus === "cancelled") return `ออเดอร์ ${shortId} ถูกยกเลิกแล้ว ยืนยันการชำระไม่ได้ ตรวจสอบที่หน้าแอดมิน`;
  return `ทำรายการสลิปออเดอร์ ${shortId} ไม่สำเร็จ ลองอีกครั้งหรือทำที่หน้าแอดมิน`;
}

function isActionable(slip: SLIPDETAILS | null, paymentId: string): slip is SLIPDETAILS {
  return slip !== null && slip.paymentId === paymentId && slip.status === "pending" &&
    slip.paymentStatus !== "paid" && slip.orderStatus !== "cancelled";
}

async function handleApproverAction(lineUserId: string, postback: APPROVERPOSTBACK, replyToken: string) {
  const supabase = createAdminClient();
  const employeeId = await resolveApprover(supabase, lineUserId);
  if (!employeeId) {
    await replyLineMessages(replyToken, [textMessage("บัญชี LINE นี้ไม่มีสิทธิ์ยืนยันสลิปครับ")]);
    return;
  }

  // การ์ดในแชทไม่มีวันหมดอายุ ต้องเช็กสถานะล่าสุดก่อนทุกครั้ง (เช่น ออเดอร์ถูกยกเลิกไปแล้ว)
  const slip = await loadSlip(supabase, postback.slipId);
  if (!isActionable(slip, postback.paymentId)) {
    await replyLineMessages(replyToken, [textMessage(describeSlipState(slip))]);
    return;
  }

  if (postback.action === SLIP_ACTION.REJECT_ASK) {
    const items = SLIP_REJECT_REASONS.map(({ label, reason }, reasonIndex) => ({
      type: "action",
      action: {
        type: "postback",
        label: quickReplyLabel(label),
        data: buildSlipPostback({ action: SLIP_ACTION.REJECT, paymentId: postback.paymentId, slipId: postback.slipId, reasonIndex }),
        displayText: `ปฏิเสธ: ${reason}`,
      },
    }));
    await replyLineMessages(replyToken, [textMessage(
      `เลือกเหตุผลที่ปฏิเสธสลิปออเดอร์ ${orderShortId(slip.orderId)} (ต้องการเหตุผลอื่นให้ปฏิเสธที่หน้าแอดมิน)`,
      { items },
    )]);
    return;
  }

  const { error } = postback.action === SLIP_ACTION.VERIFY
    ? await supabase.rpc("verify_qr_payment", {
        p_payment_id: postback.paymentId,
        p_slip_id: postback.slipId,
        p_admin_id: employeeId,
      })
    : await supabase.rpc("reject_qr_payment_slip", {
        p_payment_id: postback.paymentId,
        p_slip_id: postback.slipId,
        p_reason: SLIP_REJECT_REASONS[postback.reasonIndex].reason,
        p_admin_id: employeeId,
      });

  if (error) {
    // ส่วนใหญ่คือมีคนกดไปพร้อมกัน (ฟังก์ชันใน DB ล็อกแถวและเช็กสถานะ จึงไม่ยืนยันซ้ำ)
    logError(`${postback.action} rejected by database`, error.message);
    await replyLineMessages(replyToken, [textMessage(describeSlipState(await loadSlip(supabase, postback.slipId)))]);
    return;
  }

  // บันทึกแล้ว แจ้งลูกค้าก่อน ต่อให้ตอบแอดมินไม่สำเร็จลูกค้าก็ต้องรู้ผล
  await notifyCustomerSlipResult(postback.slipId);
  const shortId = orderShortId(slip.orderId);
  await safeReply(replyToken, [textMessage(
    postback.action === SLIP_ACTION.VERIFY
      ? `✅ ยืนยันการชำระออเดอร์ ${shortId} แล้ว ยอด ${formatBaht(slip.amount)}`
      : `❌ ปฏิเสธสลิปออเดอร์ ${shortId} แล้ว แจ้งลูกค้าให้ส่งสลิปใหม่เรียบร้อย`,
  )]);
}

/** ปุ่ม postback ของระบบสลิป (ลูกค้าเลือกออเดอร์ / แอดมินยืนยันหรือปฏิเสธ) */
export async function handleSlipPostback(lineUserId: string, data: string, replyToken: string) {
  const postback = parseSlipPostback(data);
  if (!postback) {
    await replyLineMessages(replyToken, [textMessage("ปุ่มนี้ใช้ไม่ได้แล้วครับ")]);
    return;
  }
  if (postback.action === SLIP_ACTION.PICK) {
    await handleCustomerPick(lineUserId, postback.messageId, postback.paymentId, replyToken);
    return;
  }
  await handleApproverAction(lineUserId, postback, replyToken);
}
