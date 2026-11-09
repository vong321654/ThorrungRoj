import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ANNOUNCEMENTTYPE, type ANNOUNCEMENT } from "@/app/models/announcement";
import { LineApiError, broadcastLineMessages, publicUrl, type LineMessage } from "./lineBotService";

const ANNOUNCEMENTS_PATH = "/productPage/announcements";
const PRIMARY_COLOR = "#15803d"; // สีหลักของหน้าร้าน (app/productPage/_shared/theme.ts)
const PROMOTION_COLOR = "#ea580c";
const MAX_ALT_TEXT_LENGTH = 400; // LINE รับได้ 1,500 ตัวอักษร แต่แจ้งเตือนบนมือถือโชว์ได้แค่ช่วงต้น
const MAX_CONTENT_LENGTH = 500; // ตัดให้การ์ดไม่ยาวเกิน รายละเอียดเต็มอยู่ในหน้าเว็บ

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

const TYPE_LABELS: Record<ANNOUNCEMENTTYPE, string> = {
  [ANNOUNCEMENTTYPE.PROMOTION]: "🎉 โปรโมชั่น",
  [ANNOUNCEMENTTYPE.ANNOUNCEMENT]: "📢 ประกาศจากร้าน",
};

// ตัดตามตัวอักษรที่มองเห็น ไม่ใช่ UTF-16 code unit กันอีโมจิขาดครึ่ง (LINE อาจตอบ 400)
// และกันวรรณยุกต์/สระบนล่างของไทยหลุดจากพยัญชนะ
// จำกัดความยาวจริงไว้ที่ 2 เท่าด้วย เพราะตัวอักษรเดียวยาวได้ไม่จำกัด (เช่น "ก้้้้้…" ซ้อนวรรณยุกต์)
// ไม่งั้นการ์ดเกิน 30KB แล้ว LINE ไม่รับทั้งข้อความ
function truncate(text: string, max: number) {
  const maxUnits = max * 2;
  const characters = Array.from(graphemes.segment(text), ({ segment }) => segment);
  if (characters.length <= max && text.length <= maxUnits) return text;

  let result = "";
  for (const [index, character] of characters.entries()) {
    if (index >= max - 1 || result.length + character.length > maxUnits - 1) break;
    result += character;
  }
  return `${result}…`;
}

// การ์ดแบบไม่มีรูปเป็นคนละข้อความกับแบบมีรูป จึงใช้ retry key คนละตัว (LINE เตือนว่าแก้ body แต่ใช้ key เดิมอาจทำงานผิด)
// ยังคำนวณจาก id เสมอ การกดส่งซ้ำจึงยังได้ 409 แทนการส่งซ้ำ
function noImageRetryKey(id: string) {
  return `${id.slice(0, -1)}${id.endsWith("0") ? "1" : "0"}`;
}

function formatThaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/** การ์ด Flex Message ของประกาศ withImage = false ใช้ตอนรูปเสียแล้ว LINE ไม่รับ */
export function buildAnnouncementMessage(announcement: ANNOUNCEMENT, withImage: boolean): LineMessage {
  const label = TYPE_LABELS[announcement.type] ?? TYPE_LABELS[ANNOUNCEMENTTYPE.ANNOUNCEMENT];
  const accent = announcement.type === ANNOUNCEMENTTYPE.PROMOTION ? PROMOTION_COLOR : PRIMARY_COLOR;
  const detailUrl = publicUrl(ANNOUNCEMENTS_PATH);
  const content = announcement.content?.trim();

  const bodyContents: Record<string, unknown>[] = [
    { type: "text", text: label, size: "xs", weight: "bold", color: accent },
    { type: "text", text: announcement.title, size: "lg", weight: "bold", wrap: true },
  ];
  if (content) {
    bodyContents.push({ type: "text", text: truncate(content, MAX_CONTENT_LENGTH), size: "sm", color: "#555555", wrap: true, maxLines: 8 });
  }
  if (announcement.expiresAt) {
    bodyContents.push({ type: "text", text: `ถึงวันที่ ${formatThaiDate(announcement.expiresAt)}`, size: "xs", color: "#999999" });
  }

  const bubble: Record<string, unknown> = {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: bodyContents },
  };
  // parseAnnouncementPayload รับเฉพาะลิงก์ https อยู่แล้ว ซึ่งเป็นเงื่อนไขของรูปใน Flex Message
  if (withImage && announcement.imageUrl) {
    bubble.hero = {
      type: "image",
      url: announcement.imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
      ...(detailUrl ? { action: { type: "uri", uri: detailUrl } } : {}),
    };
  }
  // รันในเครื่องไม่มีโดเมน https จริง จึงส่งการ์ดโดยไม่มีปุ่ม
  if (detailUrl) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [{ type: "button", style: "primary", color: accent, action: { type: "uri", label: "ดูรายละเอียด", uri: detailUrl } }],
    };
  }

  return {
    type: "flex",
    altText: truncate(`${label}: ${announcement.title}`, MAX_ALT_TEXT_LENGTH),
    contents: bubble,
  };
}

async function sendAnnouncement(announcement: ANNOUNCEMENT) {
  try {
    await broadcastLineMessages([buildAnnouncementMessage(announcement, true)], announcement.id);
  } catch (error) {
    // 400 จากการ์ดที่มีรูป มักเพราะลิงก์รูปผิดรูปแบบ (ยาวเกิน 2,000 ตัว มีช่องว่างหรือภาษาไทย) ส่งแบบไม่มีรูปแทน ลูกค้ายังได้ข่าว
    // หมายเหตุ: LINE ไม่ได้โหลดรูปตอนรับคำขอ รูปเสียหรือเป็น WebP จะผ่าน แต่ลูกค้าเห็นรูปแตกในการ์ด
    if (!(error instanceof LineApiError) || error.status !== 400 || !announcement.imageUrl) throw error;
    // eslint-disable-next-line no-console -- ให้เห็นใน Vercel logs ว่ารูปประกาศใช้ใน LINE ไม่ได้
    console.error("[announcement notify] retrying without image:", error.message);
    await broadcastLineMessages([buildAnnouncementMessage(announcement, false)], noImageRetryKey(announcement.id));
  }
}

function describeFailure(error: unknown) {
  if (error instanceof LineApiError) {
    if (error.status === 0) return "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN";
    // 429 มีสองกรณี: โควตาข้อความรายเดือนหมด หรือส่ง broadcast ถี่เกิน (60 ครั้ง/ชม.)
    if (error.status === 429) {
      return /monthly limit/i.test(error.message)
        ? "โควตาข้อความ LINE OA ของเดือนนี้หมดแล้ว"
        : "ส่งเข้า LINE ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
    }
    if (error.status === 401) return "LINE_CHANNEL_ACCESS_TOKEN ไม่ถูกต้อง";
  }
  return "เชื่อมต่อ LINE ไม่สำเร็จ";
}

/**
 * ส่งประกาศเข้าแชท LINE ของเพื่อน OA ทุกคน ครั้งแรกที่ประกาศถูกเผยแพร่ (และยังไม่หมดอายุ)
 * ประกาศบันทึกสำเร็จไปแล้ว การส่งที่ล้มเหลวจึงไม่ throw แต่คืนข้อความให้หน้าแอดมินแจ้งเตือน
 * ส่งไม่สำเร็จจะคืน lineNotifiedAt เป็น null เพื่อให้ลองใหม่ได้เมื่อบันทึกประกาศนี้อีกครั้ง
 */
export async function notifyAnnouncementIfNeeded(
  supabase: SupabaseClient,
  announcement: ANNOUNCEMENT,
): Promise<{ announcement: ANNOUNCEMENT; lineNotifyError: string | null }> {
  const isExpired = announcement.expiresAt !== null && new Date(announcement.expiresAt) <= new Date();
  if (!announcement.isPublished || announcement.lineNotifiedAt || isExpired) {
    return { announcement, lineNotifyError: null };
  }

  // จองสิทธิ์ส่งแบบ atomic: ถ้ามีคำขอสองอันมาพร้อมกัน จะมีอันเดียวที่ได้แถวกลับมาและเป็นคนส่ง
  const notifiedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("announcements")
    .update({ lineNotifiedAt: notifiedAt })
    .eq("id", announcement.id)
    .is("lineNotifiedAt", null)
    .select("id")
    .maybeSingle();
  if (claimError) {
    // eslint-disable-next-line no-console -- ให้เห็น error ใน Vercel logs
    console.error("[announcement notify] claim failed:", claimError.message);
    return { announcement, lineNotifyError: "บันทึกสถานะการส่ง LINE ไม่สำเร็จ" };
  }
  if (!claimed) {
    // ปกติคือมีคำขออื่นส่งไปแล้ว แต่ถ้า RLS ไม่ให้แก้แถวนี้ก็จะได้ผลแบบเดียวกัน จึง log ไว้ดู
    // eslint-disable-next-line no-console -- ให้เห็นใน Vercel logs
    console.warn("[announcement notify] claim returned no row (already sent or blocked by RLS):", announcement.id);
    return { announcement, lineNotifyError: null };
  }

  try {
    await sendAnnouncement(announcement);
    return { announcement: { ...announcement, lineNotifiedAt: notifiedAt }, lineNotifyError: null };
  } catch (error) {
    // eslint-disable-next-line no-console -- ให้เห็น error ใน Vercel logs
    console.error("[announcement notify]", announcement.id, error);
    // คืนสถานะเฉพาะแถวที่เราจองไว้ ถ้าคืนไม่สำเร็จ หน้าแอดมินจะขึ้นว่า "ส่ง LINE แล้ว" ทั้งที่ไม่ได้ส่ง ต้องบอกแอดมิน
    const { error: resetError } = await supabase
      .from("announcements")
      .update({ lineNotifiedAt: null })
      .eq("id", announcement.id)
      .eq("lineNotifiedAt", notifiedAt);
    if (resetError) {
      // eslint-disable-next-line no-console -- ให้เห็น error ใน Vercel logs
      console.error("[announcement notify] reset failed:", announcement.id, resetError.message);
      return {
        announcement: { ...announcement, lineNotifiedAt: notifiedAt },
        lineNotifyError: `${describeFailure(error)} และระบบบันทึกสถานะผิดเป็น "ส่งแล้ว" กรุณาแจ้งผู้ดูแลระบบ`,
      };
    }
    return { announcement, lineNotifyError: describeFailure(error) };
  }
}
