import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

const QR_IMAGE_PATH = "/api/qr/promptpay";
const QR_IMAGE_WIDTH = 600;
const DAY_SECONDS = 24 * 60 * 60;
const LINK_LIFETIME_SECONDS = 7 * DAY_SECONDS;

function promptPayPhone(): string | null {
  const phone = (process.env.PROMPTPAY_PHONE ?? "").replace(/\D/g, "");
  return /^0\d{9}$/.test(phone) ? phone : null;
}

function signLink(orderId: string, expiresAt: number, secret: string) {
  return createHmac("sha256", secret).update(`${orderId}:${expiresAt}`).digest("base64url");
}

/** path ของรูป QR ที่ลงลายเซ็นแล้ว คืน null ถ้ายังตั้งค่าพร้อมเพย์ไม่ครบ */
export function buildPromptPayQrPath(orderId: string): string | null {
  const secret = process.env.PROMPTPAY_QR_SECRET;
  if (!secret || !promptPayPhone()) return null;
  // ปัดวันหมดอายุเป็นรายวัน เพื่อให้ URL ไม่เปลี่ยนทุกครั้งที่หน้าเว็บดึงข้อมูลออเดอร์ใหม่ รูปจะได้ไม่กะพริบ
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Math.ceil(now / DAY_SECONDS) * DAY_SECONDS + LINK_LIFETIME_SECONDS;
  const params = new URLSearchParams({
    orderId,
    exp: String(expiresAt),
    sig: signLink(orderId, expiresAt, secret),
  });
  return `${QR_IMAGE_PATH}?${params.toString()}`;
}

export function verifyPromptPayQrLink(orderId: string, exp: string, signature: string): boolean {
  const secret = process.env.PROMPTPAY_QR_SECRET;
  if (!secret || !/^\d{1,12}$/.test(exp)) return false;
  const expiresAt = Number(exp);
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signLink(orderId, expiresAt, secret));
  const received = Buffer.from(signature);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** สร้างรูป QR พร้อมเพย์ที่ฝังยอดเงิน ลูกค้าสแกนแล้วยอดขึ้นเองในแอปธนาคาร */
export async function buildPromptPayQrPng(amount: number): Promise<Uint8Array | null> {
  const phone = promptPayPhone();
  if (!phone || !Number.isFinite(amount) || amount <= 0) return null;
  const png = await QRCode.toBuffer(generatePayload(phone, { amount }), {
    type: "png",
    width: QR_IMAGE_WIDTH,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return new Uint8Array(png);
}
