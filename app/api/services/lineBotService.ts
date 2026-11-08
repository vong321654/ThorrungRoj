import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { GREETING_ANSWER, QUICK_REPLIES } from "./chatbotFaq";
import { buildChatReply, type CHATREPLY } from "./chatbotService";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast";
const PUSH_TIMEOUT_MS = 5000;
const BROADCAST_TIMEOUT_MS = 10000;
const MAX_TEXT_LENGTH = 5000; // ข้อความ LINE ยาวได้ไม่เกิน 5,000 ตัวอักษร
const MAX_INPUT_LENGTH = 500; // เท่ากับขีดจำกัดของแชทบนเว็บ
const MAX_LABEL_LENGTH = 20; // label ของ quick reply ยาวได้ไม่เกิน 20 ตัวอักษร

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};

export type LineMessage =
  | { type: "text"; text: string; quickReply?: { items: unknown[] } }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string }
  // Flex Message = ข้อความแบบการ์ด (รูป หัวข้อ ปุ่ม) altText คือข้อความที่โชว์ในแจ้งเตือนและรายการแชท
  | { type: "flex"; altText: string; contents: Record<string, unknown> };

export class LineApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** ตรวจลายเซ็น x-line-signature = base64(HMAC-SHA256(channelSecret, rawBody)) */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** แปลง path ในเว็บเป็น URL เต็มแบบ https ที่ LINE ดึงได้ คืน null เมื่อไม่รู้โดเมนจริง เช่น ตอนรันในเครื่อง */
export function publicUrl(path: string): string | null {
  const base =
    process.env.LINE_PUBLIC_BASE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  if (!base || !path.startsWith("/")) return null;
  return `${base.replace(/\/$/, "")}${path}`;
}

// LINE รับรูปเฉพาะ https แบบ absolute ส่วนรูปใน FAQ เก็บเป็น path ใน public/
function absoluteImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (/^https:\/\//i.test(imageUrl)) return imageUrl;
  return publicUrl(imageUrl);
}

function toLineMessages(reply: CHATREPLY): LineMessage[] {
  const messages: LineMessage[] = [];
  const imageUrl = absoluteImageUrl(reply.imageUrl);
  if (imageUrl) messages.push({ type: "image", originalContentUrl: imageUrl, previewImageUrl: imageUrl });

  // quick reply แนบกับข้อความสุดท้ายเสมอ เพื่อให้ปุ่มโผล่ใต้คำตอบ
  const items = reply.quickReplies.slice(0, 13).map((label) => ({
    type: "action",
    action: { type: "message", label: label.slice(0, MAX_LABEL_LENGTH), text: label },
  }));
  messages.push({ type: "text", text: reply.reply.slice(0, MAX_TEXT_LENGTH), quickReply: { items } });
  return messages;
}

async function sendReply(replyToken: string, messages: LineMessage[]) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status} ${await response.text().catch(() => "")}`);
  }
}

/** ส่งข้อความหาลูกค้าโดยไม่ต้องรอให้ลูกค้าทักก่อน นับโควตาของแผน LINE OA ต่างจาก Reply */
export async function pushLineMessages(lineUserId: string, messages: LineMessage[]) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: lineUserId, messages }),
    // ผู้เรียกรอผลนี้ก่อนตอบลูกค้า LINE ช้าต้องไม่ทำให้หน้าสั่งซื้อค้าง
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`LINE push failed: ${response.status} ${await response.text().catch(() => "")}`);
  }
}

/**
 * ส่งข้อความถึงเพื่อนทุกคนของ LINE OA ในครั้งเดียว นับโควตาข้อความตามจำนวนเพื่อน (เพื่อน 100 คน = 100 ข้อความ)
 * retryKey (UUID) กันส่งซ้ำ: ถ้าคำขอแรก timeout แต่ LINE รับไปแล้ว การส่งซ้ำด้วย key เดิมภายใน 24 ชม. จะได้ 409 แทนการส่งซ้ำ
 */
export async function broadcastLineMessages(messages: LineMessage[], retryKey?: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new LineApiError("LINE_CHANNEL_ACCESS_TOKEN is not configured", 0);
  const response = await fetch(LINE_BROADCAST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}),
    },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
  });
  // 409 = คำขอที่ใช้ retryKey นี้ถูกรับไปแล้ว ถือว่าส่งสำเร็จ
  if (response.ok || response.status === 409) return;
  throw new LineApiError(
    `LINE broadcast failed: ${response.status} ${await response.text().catch(() => "")}`,
    response.status,
  );
}

// ผูกบทสนทนากับลูกค้าด้วย lineUserId (ต้องอยู่ provider เดียวกับ LIFF) ไม่เจอผู้ใช้หรือบันทึกพลาดก็ไม่กระทบการตอบ
async function logConversation(lineUserId: string, userMessage: string, botReply: string) {
  try {
    const supabase = createAdminClient();
    const { data: customer } = await supabase
      .from("users")
      .select("id")
      .eq("lineUserId", lineUserId)
      .maybeSingle();
    if (!customer) return;
    await supabase.from("chatLogs").insert([
      { userId: customer.id, senderType: "user", message: userMessage },
      { userId: customer.id, senderType: "bot", message: botReply },
    ]);
  } catch {
    // ไม่สนใจ error ของการบันทึก
  }
}

async function handleEvent(event: LineEvent) {
  if (!event.replyToken) return;
  const lineUserId = event.source?.userId;

  if (event.type === "follow") {
    await sendReply(event.replyToken, toLineMessages({ reply: GREETING_ANSWER, imageUrl: null, quickReplies: QUICK_REPLIES }));
    return;
  }

  if (event.type !== "message") return;
  if (event.message?.type !== "text" || !event.message.text?.trim()) {
    await sendReply(
      event.replyToken,
      toLineMessages({ reply: "ตอนนี้บอทอ่านได้เฉพาะข้อความตัวอักษรนะครับ ลองพิมพ์คำถามหรือเลือกปุ่มด้านล่างได้เลย", imageUrl: null, quickReplies: QUICK_REPLIES }),
    );
    return;
  }

  const text = event.message.text.trim().slice(0, MAX_INPUT_LENGTH);
  const reply = await buildChatReply(text);
  await sendReply(event.replyToken, toLineMessages(reply));
  if (lineUserId) await logConversation(lineUserId, text, reply.reply);
}

/** ประมวลผล event ทีละตัว ตัวหนึ่งพังไม่ทำให้ตัวอื่นหยุด */
export async function handleLineEvents(events: LineEvent[]) {
  await Promise.allSettled(events.map((event) => handleEvent(event))).then((results) => {
    for (const result of results) {
      // eslint-disable-next-line no-console -- ให้เห็น error ใน Vercel logs
      if (result.status === "rejected") console.error("[line webhook]", result.reason);
    }
  });
}

export type { LineEvent };
