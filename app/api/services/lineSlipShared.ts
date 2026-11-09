// ฟังก์ชันล้วนของระบบสลิปผ่านแชท LINE (ไม่ import อะไร) เพื่อให้ทดสอบได้ตรงๆ โดยไม่ต้องรัน Next

/** ปุ่ม postback ที่ระบบสลิปใช้ ค่า a= ในข้อมูล postback */
export const SLIP_ACTION = {
  /** ลูกค้าเลือกออเดอร์ที่จะแนบสลิป (มีหลายออเดอร์รอชำระ) */
  PICK: "slipPick",
  /** แอดมินกดยืนยัน */
  VERIFY: "slipOk",
  /** แอดมินกดปฏิเสธ → ให้เลือกเหตุผล */
  REJECT_ASK: "slipNoAsk",
  /** แอดมินเลือกเหตุผลแล้ว */
  REJECT: "slipNo",
} as const;

/**
 * เหตุผลปฏิเสธแบบเลือกได้ในแชท (reject function ใน DB บังคับต้องมีเหตุผล) อ้างด้วย index ใน postback
 * label = ข้อความบนปุ่ม quick reply (ไม่เกิน 20 ตัวอักษร) reason = ข้อความเต็มที่บันทึกและแจ้งลูกค้า
 */
export const SLIP_REJECT_REASONS = [
  { label: "ยอดไม่ตรง", reason: "ยอดเงินไม่ตรงกับคำสั่งซื้อ" },
  { label: "สลิปไม่ชัด", reason: "สลิปไม่ชัด อ่านไม่ออก" },
  { label: "ไม่พบยอดเข้า", reason: "ไม่พบยอดเงินเข้าบัญชีร้าน" },
  { label: "สลิปซ้ำ", reason: "สลิปซ้ำหรือเคยใช้แล้ว" },
  { label: "โอนผิดบัญชี", reason: "โอนผิดบัญชี" },
] as const;

export type SLIPPOSTBACK =
  | { action: typeof SLIP_ACTION.PICK; messageId: string; paymentId: string }
  | { action: typeof SLIP_ACTION.VERIFY; paymentId: string; slipId: string }
  | { action: typeof SLIP_ACTION.REJECT_ASK; paymentId: string; slipId: string }
  | { action: typeof SLIP_ACTION.REJECT; paymentId: string; slipId: string; reasonIndex: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// message id ของ LINE เป็นตัวเลขล้วน ต้องเช็กก่อนเอาไปต่อ URL ดึงรูป
const LINE_MESSAGE_ID = /^\d{1,30}$/;
const LINE_USER_ID = /^U[0-9a-f]{32}$/;
const MAX_POSTBACK_LENGTH = 300; // LINE จำกัดข้อมูล postback ไม่เกิน 300 ตัวอักษร
const MAX_QUICK_REPLY_LABEL = 20;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isLineUserId(value: unknown): value is string {
  return typeof value === "string" && LINE_USER_ID.test(value);
}

export function isSlipPostback(data: string) {
  return Object.values(SLIP_ACTION).includes(new URLSearchParams(data).get("a") as never);
}

export function buildSlipPostback(postback: SLIPPOSTBACK): string {
  const params = new URLSearchParams({ a: postback.action, p: postback.paymentId });
  if (postback.action === SLIP_ACTION.PICK) params.set("m", postback.messageId);
  else params.set("s", postback.slipId);
  if (postback.action === SLIP_ACTION.REJECT) params.set("r", String(postback.reasonIndex));
  const data = params.toString();
  if (data.length > MAX_POSTBACK_LENGTH) throw new Error("Slip postback data is too long");
  return data;
}

/** แปลงข้อมูล postback กลับ คืน null ถ้าข้อมูลไม่ครบหรือรูปแบบผิด (ห้ามเชื่อค่าจาก postback โดยไม่ตรวจ) */
export function parseSlipPostback(data: string): SLIPPOSTBACK | null {
  if (typeof data !== "string" || data.length > MAX_POSTBACK_LENGTH) return null;
  const params = new URLSearchParams(data);
  const action = params.get("a");
  const paymentId = params.get("p");
  if (!isUuid(paymentId)) return null;

  if (action === SLIP_ACTION.PICK) {
    const messageId = params.get("m");
    return messageId && LINE_MESSAGE_ID.test(messageId) ? { action, messageId, paymentId } : null;
  }

  const slipId = params.get("s");
  if (!isUuid(slipId)) return null;
  if (action === SLIP_ACTION.VERIFY || action === SLIP_ACTION.REJECT_ASK) return { action, paymentId, slipId };
  if (action === SLIP_ACTION.REJECT) {
    const raw = params.get("r");
    if (!raw || !/^\d+$/.test(raw)) return null;
    const reasonIndex = Number(raw);
    return reasonIndex < SLIP_REJECT_REASONS.length ? { action, paymentId, slipId, reasonIndex } : null;
  }
  return null;
}

/**
 * อ่าน env LINE_SLIP_APPROVERS รูปแบบ "<LINE userId>:<employees.id>" คั่นหลายคนด้วยจุลภาคหรือขึ้นบรรทัดใหม่
 * เก็บการจับคู่ไว้ใน env แทนการเพิ่ม lineUserId ลงตาราง employees (ตาราง employees ใช้ login ด้วยอีเมลเท่านั้น)
 * คืน Map lineUserId → employeeId รายการที่รูปแบบผิดจะถูกข้ามและคืนไว้ใน invalid
 */
export function parseSlipApprovers(raw: string | undefined | null) {
  const approvers = new Map<string, string>();
  const invalid: string[] = [];
  for (const entry of (raw ?? "").split(/[,\n]/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [lineUserId, employeeId, ...rest] = trimmed.split(":").map((part) => part.trim());
    if (rest.length === 0 && isLineUserId(lineUserId) && isUuid(employeeId)) approvers.set(lineUserId, employeeId.toLowerCase());
    else invalid.push(trimmed);
  }
  return { approvers, invalid };
}

export function orderShortId(orderId: string) {
  return `#${orderId.slice(0, 8)}`;
}

export function formatBaht(amount: number | string | null | undefined) {
  const value = Number(amount);
  return `${(Number.isFinite(value) ? value : 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท`;
}

export function quickReplyLabel(text: string) {
  return Array.from(text).slice(0, MAX_QUICK_REPLY_LABEL).join("");
}
