import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { GREETING_ANSWER, QUICK_REPLIES } from "./chatbotFaq";
import { buildChatReply, type CHATREPLY } from "./chatbotService";
import { publicUrl, replyLineMessages, type LineMessage } from "./lineMessagingClient";
import { handleSlipImageMessage, handleSlipPostback } from "./lineSlipService";
import { isSlipPostback } from "./lineSlipShared";

export { publicUrl, pushLineMessages, requestPublicBase, type LineMessage } from "./lineMessagingClient";

const LINE_BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast";
const BROADCAST_TIMEOUT_MS = 10000;
const MAX_TEXT_LENGTH = 5000; // ข้อความ LINE ยาวได้ไม่เกิน 5,000 ตัวอักษร
const MAX_INPUT_LENGTH = 500; // เท่ากับขีดจำกัดของแชทบนเว็บ
const MAX_LABEL_LENGTH = 20; // label ของ quick reply ยาวได้ไม่เกิน 20 ตัวอักษร
// คำสั่งให้แอดมินดู LINE userId ของตัวเอง เอาไปใส่ใน LINE_SLIP_APPROVERS
const MY_ID_COMMANDS = new Set(["#myid", "#ไอดี"]);

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { id?: string; type?: string; text?: string; contentProvider?: { type?: string } };
  postback?: { data?: string };
};

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

const sendReply = replyLineMessages;

const TEXT_ONLY_REPLY = "ตอนนี้บอทอ่านได้เฉพาะข้อความตัวอักษรนะครับ ลองพิมพ์คำถามหรือเลือกปุ่มด้านล่างได้เลย";

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

  // ปุ่มในการ์ดสลิป (แอดมินกดยืนยัน/ปฏิเสธ หรือลูกค้าเลือกออเดอร์ที่จะแนบสลิป)
  if (event.type === "postback") {
    const data = event.postback?.data ?? "";
    if (lineUserId && isSlipPostback(data)) await handleSlipPostback(lineUserId, data, event.replyToken);
    return;
  }

  if (event.type !== "message") return;

  // รูปจากลูกค้า = สลิปโอนเงิน ถ้าไม่มีออเดอร์รอชำระ service จะคืน false แล้วตอบข้อความเดิม
  // รับเฉพาะแชทส่วนตัว ในกลุ่มคำตอบจะเปิดเผยเลขออเดอร์และยอดเงินให้คนอื่นเห็น
  if (event.message?.type === "image" && event.source?.type === "user" && lineUserId && event.message.id) {
    const handled = await handleSlipImageMessage({
      lineUserId,
      messageId: event.message.id,
      contentProviderType: event.message.contentProvider?.type,
      replyToken: event.replyToken,
    });
    if (handled) return;
  }

  if (event.message?.type !== "text" || !event.message.text?.trim()) {
    await sendReply(event.replyToken, toLineMessages({ reply: TEXT_ONLY_REPLY, imageUrl: null, quickReplies: QUICK_REPLIES }));
    return;
  }

  const text = event.message.text.trim().slice(0, MAX_INPUT_LENGTH);
  if (lineUserId && MY_ID_COMMANDS.has(text.toLowerCase())) {
    await sendReply(event.replyToken, [{ type: "text", text: `LINE userId ของคุณคือ\n${lineUserId}` }]);
    return;
  }
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
