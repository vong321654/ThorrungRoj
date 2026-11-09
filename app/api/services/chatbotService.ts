import type { SERVICERESULT } from "@/app/models/api";
import { createAuthenticatedClient } from "@/app/api/util/supabase/authenticated";
import { createPublicClient } from "@/app/api/util/supabase/public";
import { apiError, apiSuccess } from "../response";
import {
  FALLBACK_ANSWER,
  GREETING_ANSWER,
  PRICE_KEYWORDS,
  QUICK_REPLIES,
  SHOP_PHONES,
  extractSizeKg,
  faqAnswer,
  isGreeting,
  isPriceQuestion,
  isPromotionQuestion,
  isPartsQuestion,
  isStockQuestion,
  matchFaq,
  matchUrgentFaq,
  normalizeText,
  type FaqEntry,
} from "./chatbotFaq";
import { getOrderableStock } from "./stockService";

const MAX_MESSAGE_LENGTH = 500;
const MAX_PRICE_ROWS = 12;
const MAX_PROMOTIONS = 3;
// คำที่ไม่ได้บอกว่าถามสินค้าอะไร ตัดทิ้งก่อนเอาคำที่เหลือไปเทียบชื่อสินค้า
const PRODUCT_FILLER_WORDS = [
  ...PRICE_KEYWORDS, "ของ", "ครับ", "ค่ะ", "คะ", "หน่อย", "ขอ", "ถาม", "ที่", "คือ", "เป็น",
  "ถัง", "แก๊ส", "แก็ส", "ก๊าซ", "สินค้า", "อะไหล่", "อุปกรณ์", "ทั้งหมด", "เกี่ยวกับ", "จำหน่าย", "ชนิด", "ประเภท", "ใน",
  "หรือเปล่า", "รึเปล่า", "หรือไม่", "ป่าว", "ไหม", "มั้ย", "มั๊ย", "มีขาย", "มี", "ขาย", "เหลือ", "หมด", "กี่",
  "ยัง", "สต็อก", "สต๊อก", "พร้อมส่ง", "อะไร", "บ้าง", "ตอนนี้", "ร้าน",
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
const PART_TYPE_ID = 16; // "อะไหล่" ใน productsType
const NO_BRAND_NAME = "ไม่มี"; // ยี่ห้อของอะไหล่ ถ้าไม่ตัดออก ประโยคที่มีคำว่า "ไม่มี" จะถูกนับว่าระบุยี่ห้อ

function formatBaht(value: number | string | null) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${amount.toLocaleString("th-TH")} บาท` : null;
}

// เทียบชื่อยี่ห้อโดยไม่สนจุด เพราะลูกค้าพิมพ์ "ปตท" แต่ในฐานข้อมูลคือ "ปตท."
function stripDots(value: string) {
  return value.toLowerCase().replace(/\./g, "");
}

// บอกแค่มีหรือหมด ไม่บอกจำนวน ถ้าเช็กสต๊อกไม่ได้ห้ามตอบว่าหมด เพราะอาจทำให้ลูกค้าเข้าใจผิด
function stockLabel(product: ProductRow, stock: Map<number, number> | null) {
  if (!stock) return "สอบถามจำนวนกับร้าน";
  if ((stock.get(Number(product.id)) ?? 0) > 0) return "✅ มีสินค้า";
  // ฝากเติมใช้ถังของลูกค้า จึงยังสั่งได้แม้ถังเต็มในคลังหมด
  if (product.typeId === TANK_TYPE_ID && formatBaht(product.refillPrice)) return "❌ ถังเต็มหมดชั่วคราว (ฝากเติมได้)";
  return "❌ สินค้าหมดชั่วคราว";
}

async function buildProductAnswer(message: string): Promise<{ text: string; matched: boolean }> {
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
      text: `ขออภัย ตอนนี้ดึงข้อมูลสินค้าไม่ได้ กรุณาโทรสอบถามร้าน: ${SHOP_PHONES}`,
      matched: false,
    };
  }

  const brandNames = new Map<number, string>(
    (brands ?? []).filter((brand) => brand.name !== NO_BRAND_NAME).map((brand) => [Number(brand.id), String(brand.name)]),
  );
  const text = normalizeText(message);
  const textNoDots = stripDots(message);
  const size = extractSizeKg(message);
  const rows = products as ProductRow[];

  const mentionedBrandIds = new Set(
    [...brandNames]
      .filter(([, name]) => stripDots(name).length > 0 && textNoDots.includes(stripDots(name)))
      .map(([id]) => id),
  );

  // ลูกค้ามักพิมพ์ชื่อสั้นกว่าชื่อสินค้าจริง เช่น "ราคาหัวปรับ" ให้ตัดคำถามออก
  // แล้วเอาคำที่เหลือไปเทียบกับชื่อสินค้า (ต้องมีอย่างน้อย 3 ตัวอักษร กันจับคำกว้างเกินไป)
  const subject = PRODUCT_FILLER_WORDS.reduce((rest, word) => rest.split(word).join(" "), text)
    .replace(/\d+(?:\.\d+)?\s*(?:กก\.?|กิโล|kg)?/g, " ")
    .replace(/[?!.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const subjectWords = subject.split(" ").filter(Boolean);
  const nameMatches = rows.filter((product) => {
    const name = product.name.toLowerCase();
    return text.includes(name) || (subject.length >= 3 && subjectWords.every((word) => name.includes(word)));
  });
  const tankMatches = rows.filter(
    (product) =>
      product.typeId === TANK_TYPE_ID &&
      (mentionedBrandIds.size > 0 || size !== null) &&
      (mentionedBrandIds.size === 0 || mentionedBrandIds.has(Number(product.brandId))) &&
      (size === null || Number(product.size) === size),
  );

  const matched = [...new Map([...nameMatches, ...tankMatches].map((product) => [product.id, product])).values()];
  // ไม่ได้ระบุรุ่น: ถามอะไหล่ก็แสดงอะไหล่ ถามสินค้าก็แสดงทั้งหมด นอกนั้นแสดงถังแก๊สซึ่งเป็นสินค้าหลัก
  const askedParts = isPartsQuestion(message);
  const askedAllProducts = text.includes("สินค้า");
  const defaultList = askedParts
    ? rows.filter((product) => product.typeId === PART_TYPE_ID)
    : askedAllProducts
      ? rows
      : rows.filter((product) => product.typeId === TANK_TYPE_ID);
  const defaultLabel = askedParts ? "อะไหล่และอุปกรณ์แก๊ส" : askedAllProducts ? "สินค้า" : "ถังแก๊ส";
  const list = matched.length > 0 ? matched : defaultList;
  if (list.length === 0) return { text: `ขณะนี้ยังไม่มีข้อมูลสินค้า กรุณาโทรสอบถามร้าน: ${SHOP_PHONES}`, matched: false };

  const shown = list.slice(0, MAX_PRICE_ROWS);
  const stock = await getOrderableStock(shown.map((product) => Number(product.id)));
  const lines = shown.map((product) => {
    const isTank = product.typeId === TANK_TYPE_ID;
    const brand = brandNames.get(Number(product.brandId));
    const label = isTank
      ? `${brand ?? product.name} ${product.size ?? ""}กก.`.replace(/\s+/g, " ").trim()
      : product.name;
    const prices = isTank
      ? [
          ["ซื้อถัง", formatBaht(product.sellPrice)],
          ["เปลี่ยนถัง", formatBaht(product.exchangePrice)],
          ["ฝากเติม", formatBaht(product.refillPrice)],
        ]
      : [["ราคา", formatBaht(product.sellPrice)]];
    const priceText = prices
      .filter(([, price]) => price !== null)
      .map(([type, price]) => `${type} ${price}`)
      .join(" | ");
    return `• ${label}: ${stockLabel(product, stock)}\n   ${priceText || "สอบถามราคากับร้าน"}`;
  });

  // ถามถึงสินค้า/ยี่ห้อ/ขนาดที่ไม่มีในร้านจริงๆ (ระบุอะไรบางอย่างแต่หาไม่เจอ) ให้บอกตรงๆ แล้วค่อยแสดงรายการแทน
  const askedSomethingSpecific = subject.length >= 3 || mentionedBrandIds.size > 0 || size !== null;
  const askedForUnknownProduct = matched.length === 0 && askedSomethingSpecific;
  const heading = matched.length > 0
    ? "สินค้าที่ตรงกับคำถามของคุณ"
    : askedForUnknownProduct
      ? `ไม่พบสินค้าที่ตรงกับคำถามพอดี ขอแสดง${defaultLabel}ทั้งหมดของร้านแทน`
      : `${defaultLabel}ทั้งหมดของร้าน`;
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

  const replyWithFaq = (entry: FaqEntry, prefix = ""): CHATREPLY => ({
    reply: `${prefix}${faqAnswer(entry)}`,
    imageUrl: entry.imageUrl ?? null,
    quickReplies: QUICK_REPLIES,
  });

  // อาการอันตรายตอบก่อนทุกอย่างเสมอ แม้ข้อความจะมีคำทักทายหรือคำว่า "ราคา" ปนมา
  const urgent = matchUrgentFaq(message);
  if (urgent) return replyWithFaq(urgent);
  if (isGreeting(message)) return reply(GREETING_ANSWER);
  if (isPromotionQuestion(message)) return reply(await buildPromotionAnswer());

  const faq = matchFaq(message);
  const asksPrice = isPriceQuestion(message);
  if (asksPrice || isStockQuestion(message)) {
    const product = await buildProductAnswer(message);
    // มีคำถามเรื่องสินค้าปนกับอาการ เช่น "หัวปรับรั่ว ราคา" "แก๊สไม่ออก มีวิธีแก้ไหม" แต่ไม่มีสินค้าตรง ให้ตอบเรื่องอาการแทน
    if (!product.matched && faq) {
      return replyWithFaq(faq, asksPrice ? "ไม่พบราคาสินค้าที่ถามในระบบ ขอตอบเรื่องที่เกี่ยวข้องให้แทนนะครับ\n\n" : "");
    }
    return reply(product.text);
  }
  if (faq) return replyWithFaq(faq);
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
