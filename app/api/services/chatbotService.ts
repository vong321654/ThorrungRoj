import type { SERVICERESULT } from "@/app/models/api";
import { createAuthenticatedClient } from "@/app/api/util/supabase/authenticated";
import { createPublicClient } from "@/app/api/util/supabase/public";
import { apiError, apiSuccess } from "../response";
import {
  FAQ_ENTRIES,
  FALLBACK_ANSWER,
  GREETING_ANSWER,
  PRICE_KEYWORDS,
  QUICK_REPLIES,
  extractSizeKg,
  isGasLeak,
  isGreeting,
  isPriceQuestion,
  isPromotionQuestion,
  matchFaq,
  normalizeText,
} from "./chatbotFaq";

const MAX_MESSAGE_LENGTH = 500;
const MAX_PRICE_ROWS = 12;
const MAX_PROMOTIONS = 3;
// คำที่ไม่ได้บอกว่าถามสินค้าอะไร ตัดทิ้งก่อนเอาคำที่เหลือไปเทียบชื่อสินค้า
const PRICE_FILLER_WORDS = [
  ...PRICE_KEYWORDS, "ของ", "ครับ", "ค่ะ", "คะ", "หน่อย", "ขอ", "ถาม", "ที่", "คือ", "เป็น",
  "ถัง", "แก๊ส", "ก๊าซ", "สินค้า", "ทั้งหมด",
];

export type CHATREPLY = {
  reply: string;
  imageUrl: string | null;
  quickReplies: string[];
};

type ProductRow = {
  id: number;
  name: string;
  size: number | null;
  brandId: number;
  sellPrice: number | string | null;
  exchangePrice: number | string | null;
  refillPrice: number | string | null;
  typeId: number;
};

const TANK_TYPE_ID = 14; // "ถังแก๊ส" ใน productsType

function formatBaht(value: number | string | null) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${amount.toLocaleString("th-TH")} บาท` : null;
}

// เทียบชื่อยี่ห้อโดยไม่สนจุด เพราะลูกค้าพิมพ์ "ปตท" แต่ในฐานข้อมูลคือ "ปตท."
function stripDots(value: string) {
  return value.toLowerCase().replace(/\./g, "");
}

async function buildPriceAnswer(message: string): Promise<{ text: string; matched: boolean }> {
  const supabase = createPublicClient();
  const [{ data: products, error: productsError }, { data: brands }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, size, brandId, sellPrice, exchangePrice, refillPrice, typeId")
      .eq("isActive", true),
    supabase.from("productsBrand").select("id, name"),
  ]);
  if (productsError || !products) {
    return {
      text: "ขออภัย ตอนนี้ดึงราคาสินค้าไม่ได้ กรุณาดูราคาที่เมนู \"โปรโมชั่น\" หรือสอบถามร้านโดยตรง",
      matched: false,
    };
  }

  const brandNames = new Map<number, string>((brands ?? []).map((brand) => [Number(brand.id), String(brand.name)]));
  const text = normalizeText(message);
  const textNoDots = stripDots(message);
  const size = extractSizeKg(message);
  const rows = products as ProductRow[];

  const mentionedBrandIds = new Set(
    [...brandNames]
      .filter(([, name]) => stripDots(name).length > 0 && textNoDots.includes(stripDots(name)))
      .map(([id]) => id),
  );

  // ลูกค้ามักพิมพ์ชื่อสั้นกว่าชื่อสินค้าจริง เช่น "ราคาหัวปรับ" ให้ตัดคำถามเรื่องราคาออก
  // แล้วเอาคำที่เหลือไปเทียบกับชื่อสินค้า (ต้องมีอย่างน้อย 3 ตัวอักษร กันจับคำกว้างเกินไป)
  const subject = PRICE_FILLER_WORDS.reduce((rest, word) => rest.split(word).join(" "), text)
    .replace(/\d+(?:\.\d+)?\s*(?:กก\.?|กิโล|kg)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const nameMatches = rows.filter((product) => {
    const name = product.name.toLowerCase();
    return text.includes(name) || (subject.length >= 3 && name.includes(subject));
  });
  const tankMatches = rows.filter(
    (product) =>
      product.typeId === TANK_TYPE_ID &&
      (mentionedBrandIds.size > 0 || size !== null) &&
      (mentionedBrandIds.size === 0 || mentionedBrandIds.has(Number(product.brandId))) &&
      (size === null || Number(product.size) === size),
  );

  const matched = [...new Map([...nameMatches, ...tankMatches].map((product) => [product.id, product])).values()];
  const list = matched.length > 0 ? matched : rows.filter((product) => product.typeId === TANK_TYPE_ID);
  if (list.length === 0) return { text: "ขณะนี้ยังไม่มีข้อมูลราคาสินค้า กรุณาสอบถามร้านโดยตรง", matched: false };

  const lines = list.slice(0, MAX_PRICE_ROWS).map((product) => {
    const brand = brandNames.get(Number(product.brandId));
    const label = product.typeId === TANK_TYPE_ID
      ? `${brand ?? product.name} ${product.size ?? ""}กก.`.replace(/\s+/g, " ").trim()
      : product.name;
    const prices = [
      ["ซื้อถัง", formatBaht(product.sellPrice)],
      ["เปลี่ยนถัง", formatBaht(product.exchangePrice)],
      ["เติมแก๊ส", formatBaht(product.refillPrice)],
    ]
      .filter(([, price]) => price !== null)
      .map(([type, price]) => `${type} ${price}`);
    return `• ${label}: ${prices.join(" | ") || "สอบถามราคากับร้าน"}`;
  });

  // ถามถึงสินค้า/ยี่ห้อ/ขนาดที่ไม่มีในร้านจริงๆ (ระบุอะไรบางอย่างแต่หาไม่เจอ) ให้บอกตรงๆ แล้วค่อยแสดงรายการถังแทน
  const askedSomethingSpecific = subject.length >= 3 || mentionedBrandIds.size > 0 || size !== null;
  const askedForUnknownProduct = matched.length === 0 && askedSomethingSpecific;
  const heading = matched.length > 0
    ? "ราคาสินค้าที่ตรงกับคำถามของคุณ"
    : askedForUnknownProduct
      ? "ไม่พบสินค้าที่ตรงกับคำถามพอดี ขอแสดงราคาถังแก๊สทั้งหมดของร้านแทน"
      : "ราคาถังแก๊สทั้งหมดของร้าน";
  const more = list.length > MAX_PRICE_ROWS ? `\n(แสดง ${MAX_PRICE_ROWS} รายการแรก พิมพ์ยี่ห้อหรือขนาดเพื่อดูเฉพาะรุ่น)` : "";
  return {
    text: `${heading}\n${lines.join("\n")}${more}\n\nราคาและโปรโมชั่นล่าสุดดูได้ที่เมนู "โปรโมชั่น" นะครับ`,
    matched: matched.length > 0,
  };
}

async function buildPromotionAnswer(): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await createPublicClient()
    .from("announcements")
    .select("title, type")
    .eq("isPublished", true)
    .or(`expiresAt.is.null,expiresAt.gt.${now}`)
    .order("publishedAt", { ascending: false, nullsFirst: false })
    .limit(MAX_PROMOTIONS);
  if (error || !data || data.length === 0) {
    return "ขณะนี้ยังไม่มีโปรโมชั่นใหม่ ติดตามได้ที่เมนู \"โปรโมชั่น\" ของร้านนะครับ";
  }
  const lines = data.map((item) => `• ${item.title}`);
  return `โปรโมชั่นและประกาศล่าสุดของร้าน\n${lines.join("\n")}\n\nดูรายละเอียดทั้งหมดได้ที่เมนู "โปรโมชั่น" ด้านบนครับ`;
}

export async function buildChatReply(message: string): Promise<CHATREPLY> {
  const reply = (text: string): CHATREPLY => ({ reply: text, imageUrl: null, quickReplies: QUICK_REPLIES });

  // เรื่องความปลอดภัย (แก๊สรั่ว) ตอบก่อนทุกอย่างเสมอ แม้ข้อความจะมีคำทักทายหรือคำว่า "ราคา" ปนมา
  if (isGasLeak(message)) {
    const leak = FAQ_ENTRIES.find((entry) => entry.id === "gasLeak");
    if (leak) return { reply: leak.answer, imageUrl: leak.imageUrl ?? null, quickReplies: QUICK_REPLIES };
  }
  if (isGreeting(message)) return reply(GREETING_ANSWER);
  if (isPromotionQuestion(message)) return reply(await buildPromotionAnswer());

  const faq = matchFaq(message);
  if (isPriceQuestion(message)) {
    const price = await buildPriceAnswer(message);
    // ถามเรื่องปัญหาการใช้งานที่มีคำว่า "ราคา" ปน เช่น "หัวปรับรั่ว ราคา" และไม่มีสินค้าตรงกับคำถาม ให้ตอบเรื่องปัญหาแทน
    if (!price.matched && faq) {
      return {
        reply: `ไม่พบราคาสินค้าที่ถามในระบบ ขอตอบเรื่องที่เกี่ยวข้องให้แทนนะครับ\n\n${faq.answer}`,
        imageUrl: faq.imageUrl ?? null,
        quickReplies: QUICK_REPLIES,
      };
    }
    return reply(price.text);
  }
  if (faq) return { reply: faq.answer, imageUrl: faq.imageUrl ?? null, quickReplies: QUICK_REPLIES };
  return reply(FALLBACK_ANSWER);
}

// บันทึกบทสนทนาเฉพาะลูกค้าที่ล็อกอิน การบันทึกล้มเหลวต้องไม่ทำให้แชทตอบไม่ได้
async function logConversation(accessToken: string, userMessage: string, botReply: string) {
  try {
    const supabase = createAuthenticatedClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) return;

    const { data: customer } = await supabase
      .from("users")
      .select("id")
      .eq("authId", authData.user.id)
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

export async function chat(accessToken: string | null, payload: unknown): Promise<SERVICERESULT<CHATREPLY>> {
  const message = payload && typeof payload === "object" ? (payload as { message?: unknown }).message : undefined;
  if (typeof message !== "string" || !message.trim()) {
    return { result: apiError("กรุณาพิมพ์ข้อความ"), status: 400 };
  }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return { result: apiError(`ข้อความยาวเกินไป (ไม่เกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร)`), status: 400 };
  }

  const reply = await buildChatReply(message.trim());
  if (accessToken) await logConversation(accessToken, message.trim(), reply.reply);
  return { result: apiSuccess("OK", reply), status: 200 };
}
