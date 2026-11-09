import "server-only";

// ตัวส่งข้อความ LINE ระดับล่าง แยกไว้ให้ service อื่น (แชทบอท สลิป แจ้งออเดอร์) ใช้ร่วมกันโดยไม่ import วนกัน

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const PUSH_TIMEOUT_MS = 5000;

export type LineMessage =
  | { type: "text"; text: string; quickReply?: { items: unknown[] } }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string }
  // Flex Message = ข้อความแบบการ์ด (รูป หัวข้อ ปุ่ม) altText คือข้อความที่โชว์ในแจ้งเตือนและรายการแชท
  | { type: "flex"; altText: string; contents: Record<string, unknown>; quickReply?: { items: unknown[] } };

const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i;

/**
 * โดเมน https ที่ลูกค้าใช้เปิดเว็บอยู่จริงตอนนี้ (Vercel หรือ tunnel) ดูจาก header ที่ proxy ใส่มา
 * คืน null ถ้าเป็น http หรือ localhost เพราะ LINE ดึงรูปจากที่อยู่แบบนั้นไม่ได้
 */
export function requestPublicBase(request: Request): string | null {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", ""))
    .split(",")[0].trim();
  if (proto !== "https" || !/^[a-z0-9.-]+(:\d+)?$/i.test(host) || LOCAL_HOST.test(host)) return null;
  return `https://${host}`;
}

/**
 * แปลง path ในเว็บเป็น URL เต็มแบบ https ที่ LINE ดึงได้ คืน null เมื่อไม่รู้โดเมนจริง เช่น ตอนรันในเครื่อง
 * preferredBase (โดเมนจาก request ปัจจุบัน) มาก่อน env เพราะ env อาจค้างเป็น URL ของ tunnel ที่ปิดไปแล้ว
 */
export function publicUrl(path: string, preferredBase?: string | null): string | null {
  const base =
    preferredBase ??
    process.env.LINE_PUBLIC_BASE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  if (!base || !path.startsWith("/")) return null;
  return `${base.replace(/\/$/, "")}${path}`;
}

export function lineAccessToken() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  return token;
}

/** ตอบกลับ event ด้วย replyToken (ใช้ได้ครั้งเดียว ภายในราว 1 นาที) ไม่นับโควตาข้อความ */
export async function replyLineMessages(replyToken: string, messages: LineMessage[]) {
  const response = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineAccessToken()}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status} ${await response.text().catch(() => "")}`);
  }
}

/** ส่งข้อความหาลูกค้าโดยไม่ต้องรอให้ลูกค้าทักก่อน นับโควตาของแผน LINE OA ต่างจาก Reply */
export async function pushLineMessages(lineUserId: string, messages: LineMessage[]) {
  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineAccessToken()}` },
    body: JSON.stringify({ to: lineUserId, messages }),
    // ผู้เรียกรอผลนี้ก่อนตอบลูกค้า LINE ช้าต้องไม่ทำให้หน้าสั่งซื้อค้าง
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`LINE push failed: ${response.status} ${await response.text().catch(() => "")}`);
  }
}
