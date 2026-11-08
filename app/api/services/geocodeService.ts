import "server-only";

import type { SERVICERESULT } from "@/app/models/api";
import { createAuthenticatedClient } from "@/app/api/util/supabase/authenticated";
import { isInThailand, type DELIVERYLOCATION } from "@/app/util/deliveryLocation";
import { apiError, apiSuccess } from "../response";

// ค้นหาพิกัดจากข้อความที่อยู่ด้วย Nominatim ของ OpenStreetMap (ฟรี ไม่ต้องใช้ key)
// นโยบายการใช้งาน: ไม่เกิน 1 ครั้ง/วินาที ต้องระบุ User-Agent ของแอป และควรเก็บผลไว้ใช้ซ้ำ
// https://operations.osmfoundation.org/policies/nominatim/
//
// ข้อจำกัดที่ต้องรู้: OSM แทบไม่มีเลขที่บ้านในไทย เราจึงตัดเลขที่บ้านทิ้งก่อนค้น
// ผลที่ได้จึงเป็น "ตำแหน่งโดยประมาณ" เสมอ ห้ามบอกลูกค้าว่าตรงบ้าน ลูกค้าต้องลากหมุดปรับเอง
//
// Nominatim ต้องเจอ "ทุกคำ" ในคำค้น ใส่คำเกิน (ชื่อถนน ตำบล จังหวัด "ใกล้" "ตรงข้าม") จะค้นไม่เจอเลย
// จึงแยกที่อยู่เป็น ซอย/ถนน, ชื่อสถานที่, และเขตปกครอง แล้วค้นทีละแบบด้วยคำให้น้อยที่สุด
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const SITE_URL =
  process.env.LINE_PUBLIC_BASE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
// นโยบายขอให้ User-Agent มีช่องทางติดต่อ ใช้ URL เว็บร้านแทนอีเมลส่วนตัว
const USER_AGENT = `ThorRungrojGasShop/1.0 (delivery address pin${SITE_URL ? `; ${SITE_URL}` : ""})`;
const MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 5000;
// เวลารวมทุกรอบค้นของคำขอหนึ่ง ไม่ให้ลูกค้ารอนานและไม่ชนเวลาจำกัดของ function
const TOTAL_BUDGET_MS = 9000;
// เหลือเวลาน้อยกว่านี้ไม่ยิงคำขอใหม่ (Nominatim ตอบปกติภายในไม่ถึง 1 วินาที)
const MIN_REQUEST_MS = 1500;
const MAX_ATTEMPTS = 7;
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 300;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 200;
const RESULT_LIMIT = 5;
// ให้ผลแถวประจวบคีรีขันธ์/หัวหินขึ้นก่อน เมื่อชื่อสถานที่ซ้ำกับจังหวัดอื่น (ไม่ได้ตัดผลนอกกรอบทิ้ง)
const SHOP_AREA_VIEWBOX = "99.3,13.3,100.3,11.5";
// พื้นที่ส่งของจริง (ชะอำ–หัวหิน–ปราณบุรี) ใช้ "จำกัด" ผลตอนค้นด้วยชื่อสถานที่อย่างเดียว ไม่ให้ไปเจอชื่อซ้ำจังหวัดอื่น
const DELIVERY_AREA_VIEWBOX = "99.75,12.85,100.1,12.25";
// คำที่ถ้าเหลือโดด ๆ หลังตัดเลขแล้วค้นอะไรไม่ได้
const LONE_KEYWORDS = new Set(["ซอย", "ถนน", "หมู่บ้าน", "บ้าน", "soi", "moo", "rd", "road", "m."]);
// ใช้ชั่วคราวเพื่อมัด "ซอย 5" หรือ "ถนน 4" ไว้เป็นคำเดียว ไม่ให้เลขซอย/ถนนถูกตัดทิ้งไปกับเลขที่บ้าน
const GLUE = "\u0000";
// ทำเครื่องหมายคำที่ตามหลัง ต./อ./จ. ว่าเป็นชื่อเขตปกครอง
const ADMIN_MARK = "\u0001";
const STREET_PREFIX = /^(ซอย|ถนน|หมู่บ้าน)/;
// ชื่อเขตปกครองในพื้นที่ส่งของที่ลูกค้ามักพิมพ์โดยไม่มี ต./อ./จ. นำหน้า
const LOCAL_ADMIN_NAMES = new Set([
  "หัวหิน", "หนองแก", "หินเหล็กไฟ", "ทับใต้", "หนองพลับ", "บึงนคร", "ห้วยสัตว์ใหญ่", "วังก์พง",
  "ปราณบุรี", "ชะอำ", "ประจวบคีรีขันธ์", "ประจวบ", "เพชรบุรี",
]);
// ชื่อจังหวัดทำให้ค้นพลาดบ่อย (เช่น สนามบินหัวหินอยู่ใน อ.ชะอำ จ.เพชรบุรี ตาม OSM) ใช้ viewbox แทน
const PROVINCE_NAMES = new Set(["ประจวบคีรีขันธ์", "ประจวบ", "เพชรบุรี"]);
// คำบอกตำแหน่งที่ลูกค้าพิมพ์นำหน้าชื่อสถานที่ เช่น "ใกล้สถานีรถไฟหัวหิน" "ตรงข้ามวังไกลกังวล"
const LOCATOR_PREFIX = /^(ใกล้กับ|ใกล้|ตรงข้ามกับ|ตรงข้าม|ข้างๆ|ข้าง|เยื้อง|แถว|ติดกับ|หน้า|หลัง)/;

// ไม่มีระดับ "ตรงบ้าน" เพราะเราไม่ได้ส่งเลขที่บ้านไปค้น
export type GEOCODEPRECISION = "street" | "area" | "district";

export type GEOCODERESULT = DELIVERYLOCATION & {
  displayName: string;
  precision: GEOCODEPRECISION;
  // คำค้นที่เจอผลจริง หน้าเว็บใช้บอกลูกค้าว่าหาเจอจากคำไหน
  matchedQuery: string;
};

// any = ทุกอย่าง, place = เฉพาะชื่อหมู่บ้าน/ชุมชน/ตำบล (place/* หรือเขตปกครอง), settlement = featureType ของ Nominatim
export type QUERYFILTER = "any" | "place" | "settlement";

export type GEOCODEQUERY = {
  query: string;
  maxPrecision: GEOCODEPRECISION;
  filter: QUERYFILTER;
  // จำกัดผลให้อยู่ในพื้นที่ส่งของ (ใช้กับคำค้นที่ไม่มีชื่อเขตปกครองกำกับ)
  bounded: boolean;
  // ค้นรอบนี้เฉพาะเมื่อผลดีที่สุดที่มีตอนนี้ยังหยาบกว่าระดับนี้ (null = ค้นเสมอ)
  runIfBestCoarserThan: GEOCODEPRECISION | null;
  // ค้นด้วยชื่อสถานที่ที่ลูกค้าพิมพ์เอง เจอแล้วใช้ทันที ไม่ไปแทนด้วยจุดสุ่มบนถนนที่ลูกค้าพิมพ์มาด้วย
  preferred: boolean;
};

export type PARSEDADDRESS = {
  streets: string[];
  landmarks: string[];
  admin: string[];
};

type NominatimRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
  place_rank?: number;
  category?: string;
  type?: string;
};

type PICKEDROW = { row: NominatimRow; location: DELIVERYLOCATION };

const NON_DELIVERABLE_CATEGORIES = new Set(["natural", "waterway", "water", "boundary"]);
// ทางหลวงสายยาว (เช่น เพชรเกษม) Nominatim คืนจุดใดจุดหนึ่งบนเส้น ห่างบ้านลูกค้าได้หลายกิโลเมตร
const LONG_ROAD_TYPES = new Set([
  "motorway", "trunk", "primary", "secondary",
  "motorway_link", "trunk_link", "primary_link", "secondary_link",
]);

type RUNRESULT = { value: GEOCODERESULT | null; complete: boolean };

const PRECISION_ORDER: GEOCODEPRECISION[] = ["street", "area", "district"];
const SKIPPED = Symbol("skipped");

const cache = new Map<string, { value: GEOCODERESULT | null; expiresAt: number }>();
// คำขอที่อยู่เดียวกันซึ่งเข้ามาพร้อมกัน ให้รอผลชุดเดียวกัน ไม่ยิง Nominatim ซ้ำ
const inFlight = new Map<string, Promise<RUNRESULT>>();
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

/**
 * place_rank ของ Nominatim: 26-29 = ถนน/ซอย, 17-25 = หมู่บ้าน/ตำบล, ต่ำกว่านั้น = อำเภอ/จังหวัด
 * rank 30 คือสถานที่/อาคารที่ "ชื่อ" ตรงกับคำค้น เช่นโรงแรมหรือสถานีรถไฟ ไม่ได้แปลว่าเป็นบ้านลูกค้า จึงถือเป็นระดับย่าน
 */
export function toPrecision(placeRank: number | undefined): GEOCODEPRECISION {
  const rank = placeRank ?? 0;
  if (rank >= 26 && rank < 30) return "street";
  if (rank >= 17) return "area";
  return "district";
}

/** ผลจากคำค้นที่หยาบ ห้ามอ้างว่าแม่นกว่าคำค้นนั้น */
export function capPrecision(precision: GEOCODEPRECISION, max: GEOCODEPRECISION): GEOCODEPRECISION {
  return PRECISION_ORDER[Math.max(PRECISION_ORDER.indexOf(precision), PRECISION_ORDER.indexOf(max))];
}

/** a หยาบกว่า b หรือไม่ (district หยาบกว่า area หยาบกว่า street) */
export function isCoarser(a: GEOCODEPRECISION, b: GEOCODEPRECISION) {
  return PRECISION_ORDER.indexOf(a) > PRECISION_ORDER.indexOf(b);
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function toArabicDigits(text: string) {
  return text.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));
}

function dedupe(tokens: string[]) {
  return tokens.filter((token, index) => tokens.indexOf(token) === index);
}

/**
 * แยกที่อยู่ไทยเป็น 3 ส่วนเพื่อค้นใน OSM:
 * - streets: ซอย/ถนน/หมู่บ้าน (เก็บเลขซอย/เลขถนนไว้)
 * - landmarks: ชื่อสถานที่อื่น ๆ (ตัดคำบอกตำแหน่ง "ใกล้" "ตรงข้าม" ออก)
 * - admin: ตำบล/อำเภอ/จังหวัด (คำที่ตามหลัง ต./อ./จ. หรือชื่อที่รู้จักในพื้นที่ส่งของ)
 * ตัดเลขที่บ้าน หมู่ที่ และรหัสไปรษณีย์ทิ้ง เพราะ OSM แทบไม่มีข้อมูลระดับนี้
 */
export function parseAddress(address: string): PARSEDADDRESS {
  const cleaned = toArabicDigits(address)
    .replace(/[\r\n,]+/g, " ")
    // ขยายคำย่อก่อนตัดเลข: ตามด้วยเลข → "ซอย 94" (เว้นวรรค ให้มัดเลขได้), ตามด้วยชื่อ → "ถนนเพชรเกษม" (ติดกัน)
    .replace(/(^|\s)ซ\.\s*(?=\d)/g, "$1ซอย ")
    .replace(/(^|\s)ซ\.\s*/g, "$1ซอย")
    .replace(/(^|\s)ถ\.\s*(?=\d)/g, "$1ถนน ")
    .replace(/(^|\s)ถ\.\s*/g, "$1ถนน")
    // "ถนน เพชรเกษม" / "ซอย หัวหิน 102" ที่พิมพ์เว้นวรรค ให้ติดกับชื่อ ไม่งั้นคำว่าถนน/ซอยจะเหลือโดด ๆ แล้วถูกทิ้ง
    // ยกเว้นคำถัดไปเป็นคำนำหน้าเขตปกครอง เช่น "ซอย ต.หนองแก" (พิมพ์ซอยค้างไว้)
    .replace(/(^|\s)(ซอย|ถนน)\s+(?=[^\d\s])(?!(ต|อ|จ)\.|ตำบล|อำเภอ|จังหวัด)/g, "$1$2")
    // มัดเลขไว้กับคำว่าซอย/ถนน ("ซอย 5", "ซอยหัวหิน 102", "ถนน 4") ก่อนที่ขั้นตอนถัดไปจะตัดตัวเลขทิ้ง
    .replace(/((?:ซอย|ถนน)\S*)\s+(\d+(?:\/\d+)?)(?=\s|$)/g, `$1${GLUE}$2`)
    .replace(/\b\d{5}\b/g, " ")
    .replace(/(บ้านเลขที่|เลขที่)\s*[\d/-]+/g, " ")
    .replace(/(หมู่ที่|หมู่|ม\.)\s*\d+/g, " ")
    .replace(/(^|\s)\d+(?:[/-]\d+)*(?=\s|$)/g, " ")
    // ทำเครื่องหมายคำที่ตามหลังคำนำหน้าเขตปกครอง ไม่รวม "เขต" เพราะชนกับชื่อจริงอย่าง "เขตอุตสาหกรรม"
    .replace(/(^|\s)(ตำบล|อำเภอ|จังหวัด|แขวง|ต\.|อ\.|จ\.)\s*/g, `$1${ADMIN_MARK}`);

  const streets: string[] = [];
  const landmarks: string[] = [];
  const admin: string[] = [];
  for (const raw of cleaned.split(/\s+/)) {
    const isMarkedAdmin = raw.startsWith(ADMIN_MARK);
    const token = raw.split(ADMIN_MARK).join("").split(GLUE).join(" ").trim();
    if (token.length <= 1 || LONE_KEYWORDS.has(token.toLowerCase())) continue;
    if (isMarkedAdmin || LOCAL_ADMIN_NAMES.has(token)) admin.push(token);
    else if (STREET_PREFIX.test(token)) streets.push(token);
    else {
      const stripped = token.replace(LOCATOR_PREFIX, "").trim();
      landmarks.push(stripped.length > 1 ? stripped : token);
    }
  }
  return { streets: dedupe(streets), landmarks: dedupe(landmarks), admin: dedupe(admin) };
}

/** ทุกคำที่ใช้ค้นได้ เรียงตามที่พิมพ์ (ใช้ในการทดสอบและเป็นกุญแจ cache) */
export function addressTokens(address: string): string[] {
  const { streets, landmarks, admin } = parseAddress(address);
  return [...streets, ...landmarks, ...admin];
}

// ชื่อซอยใน OSM ของหัวหินมักไม่มีคำนำหน้า เช่น "ซอยหัวหิน 102" → "หัวหิน 102", "ซอยหมู่บ้านเขาน้อย" → "เขาน้อย"
// ตัดคำนำหน้าทีละตัว ไม่ตัด "บ้าน" ที่เป็นส่วนของชื่อจริง เช่น "หมู่บ้านบ้านสวน" → "บ้านสวน"
function stripPrefixes(token: string) {
  const stripped = token.replace(/^ซอย/, "").replace(/^ถนน/, "").replace(/^หมู่บ้าน/, "").trim();
  // "ซอย 94" ตัดแล้วเหลือแต่ "94" ค้นไม่ได้ คงคำเดิมไว้
  if (stripped.length <= 1 || /^[\d/\s]+$/.test(stripped)) return token;
  return stripped;
}

/**
 * ลำดับการค้น:
 * 1) ชื่อสถานที่ + อำเภอ                                   (เจอแล้วใช้ทันที เพราะลูกค้าบอกจุดนี้เอง)
 * 2) ชื่อสถานที่อย่างเดียว จำกัดในพื้นที่ส่งของ            (เจอแล้วใช้ทันที)
 * 3) ซอย/ถนน (ตัดคำนำหน้าแบบชื่อ OSM) + อำเภอ             (เจอระดับถนน/ซอยใช้ทันที)
 * 4) ซอย/ถนน (เต็ม) + อำเภอ                                (เจอระดับถนน/ซอยใช้ทันที)
 * 5) ถนนเส้นหลัง (ตัดซอยออก) + อำเภอ                      (ถ้ายังไม่ได้ผลระดับย่าน)
 * 6) ตำบล/อำเภอ เฉพาะชื่อหมู่บ้าน/ชุมชน/ตำบล                (ถ้ายังไม่ได้ผลระดับย่าน)
 * 7) อำเภอ แบบชื่อเมือง                                    (ถ้ายังไม่ได้ผลอะไรเลย)
 * ไม่ค้นชื่อเขตปกครองแบบไม่กรอง เพราะจะได้ร้านค้าที่บังเอิญมีชื่อเมืองในชื่อ เช่น "โรงพยาบาลสัตว์ ... หัวหิน"
 */
export function buildQueries(address: string): GEOCODEQUERY[] {
  const { streets, landmarks, admin } = parseAddress(address);
  const areaTokens = admin.filter((token) => !PROVINCE_NAMES.has(token));
  const area = areaTokens.length > 0 ? areaTokens : admin;
  // อำเภอ (คำเขตปกครองตัวท้ายที่ไม่ใช่จังหวัด) ใช้กำกับคำค้นให้แคบลงพอดี ไม่ยาวจนค้นไม่เจอ
  const town = areaTokens.length > 0 ? [areaTokens[areaTokens.length - 1]] : [];

  const queries: GEOCODEQUERY[] = [];
  const add = (
    tokens: string[],
    maxPrecision: GEOCODEPRECISION,
    filter: QUERYFILTER,
    options: { bounded?: boolean; runIfBestCoarserThan?: GEOCODEPRECISION | null; preferred?: boolean } = {},
  ) => {
    const list = dedupe(tokens.filter((token) => token.length > 0));
    if (list.length === 0) return;
    const query = list.join(" ");
    const bounded = options.bounded ?? false;
    if (queries.some((item) => item.query === query && item.filter === filter && item.bounded === bounded)) return;
    queries.push({
      query,
      maxPrecision,
      filter,
      bounded,
      runIfBestCoarserThan: options.runIfBestCoarserThan ?? null,
      preferred: options.preferred ?? false,
    });
  };

  // ชื่อสถานที่ก่อนถนน: "ใกล้สถานีรถไฟหัวหิน ถ.ดำเนินเกษม" ควรได้สถานี ไม่ใช่จุดใดจุดหนึ่งบนถนนดำเนินเกษม
  if (landmarks.length > 0) {
    if (town.length > 0) add([...landmarks, ...town], "area", "any", { preferred: true });
    add(landmarks, "area", "any", { bounded: true, preferred: true });
  }
  if (streets.length > 0) {
    add([...streets.map(stripPrefixes), ...town], "street", "any");
    add([...streets, ...town], "street", "any");
  }
  // ตัดซอยออกเหลือแค่ถนนเส้นหลัง หมุดจะอยู่ตรงไหนก็ได้บนถนนเส้นนั้น จึงบอกได้แค่ระดับย่าน
  if (streets.length > 1) add([...streets.slice(1), ...town], "area", "any", { runIfBestCoarserThan: "area" });
  if (area.length > 0) add(area, "area", "place", { runIfBestCoarserThan: "area" });
  if (town.length > 0) add(town, "district", "settlement", { runIfBestCoarserThan: "district" });

  return queries.slice(0, MAX_ATTEMPTS);
}

// เรียก Nominatim ทีละครั้งและเว้นระยะตามนโยบาย แม้จะมีหลายคำขอเข้ามาพร้อมกันใน instance เดียว
// (บน Vercel แต่ละ instance มีคิวของตัวเอง แต่ปริมาณสั่งซื้อของร้านต่ำมาก จึงไม่เกินโควตาในทางปฏิบัติ)
// task เรียก markCall() เฉพาะตอนยิงจริง คำขอที่ข้ามเพราะหมดเวลาจะไม่กินช่วงเว้นระยะของคนถัดไป
function throttled<T>(task: (markCall: () => void) => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return task(() => {
      lastCallAt = Date.now();
    });
  });
  queue = run.catch(() => undefined);
  return run;
}

function validRows(rows: NominatimRow[]): PICKEDROW[] {
  return rows.flatMap((row) => {
    if (!row?.lat || !row.lon) return [];
    const location = { lat: Number(row.lat), lng: Number(row.lon) };
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng) || !isInThailand(location)) return [];
    return [{ row, location }];
  });
}

/**
 * เลือกผลที่เหมาะเป็นจุดส่งของ: เลื่อนสิ่งทางธรรมชาติ (ภูเขา แม่น้ำ ทะเล) และเส้นเขตปกครองไปท้าย
 * เพราะไม่มีใครสั่งแก๊สไปส่งบนยอดเขา นอกนั้นคงลำดับความเกี่ยวข้องของ Nominatim ไว้
 */
export function pickDeliverableRow(rows: NominatimRow[]): PICKEDROW | null {
  const valid = validRows(rows);
  return valid.find((item) => !NON_DELIVERABLE_CATEGORIES.has(item.row.category ?? "")) ?? valid[0] ?? null;
}

/** สำหรับค้นชื่อตำบล/หมู่บ้าน: เอาเฉพาะ place/* ก่อน ไม่มีค่อยใช้เขตปกครอง ไม่เอาร้านค้า/อาคาร */
export function pickPlaceRow(rows: NominatimRow[]): PICKEDROW | null {
  const valid = validRows(rows);
  return (
    valid.find((item) => item.row.category === "place") ??
    valid.find((item) => item.row.category === "boundary" && item.row.type === "administrative") ??
    null
  );
}

async function searchOnce(
  { query, maxPrecision, filter, bounded }: GEOCODEQUERY,
  deadline: number,
): Promise<GEOCODERESULT | null | typeof SKIPPED> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "th",
    // ขอหลายรายการเพื่อเลือกที่เหมาะกับการส่งของ เช่น "เขาน้อย" ผลแรกคือยอดเขา ผลที่สองคือชุมชนเขาน้อย
    limit: String(RESULT_LIMIT),
    "accept-language": "th",
    viewbox: bounded ? DELIVERY_AREA_VIEWBOX : SHOP_AREA_VIEWBOX,
  });
  if (bounded) params.set("bounded", "1");
  if (filter === "settlement") params.set("featureType", "settlement");

  // ตรวจเวลาที่เหลือหลังรอคิวเสร็จ (รวมเวลารอคนอื่นใน instance เดียวกันด้วย) และให้ timeout ไม่เกินเวลาที่เหลือ
  const rows = await throttled<NominatimRow[] | typeof SKIPPED>(async (markCall) => {
    const remaining = deadline - Date.now();
    if (remaining < MIN_REQUEST_MS) return SKIPPED;
    const timeout = Math.min(REQUEST_TIMEOUT_MS, remaining);
    markCall();
    try {
      const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
      // อ่าน body ภายใต้ timeout เดียวกัน
      return (await response.json()) as NominatimRow[];
    } catch (error) {
      // หมดเวลาเพราะงบเวลารวมใกล้หมด (ไม่ใช่ Nominatim ช้าผิดปกติ) ถือว่าค้นไม่ครบ ไม่ใช่ล้มเหลว
      if (error instanceof Error && error.name === "TimeoutError" && timeout < REQUEST_TIMEOUT_MS) return SKIPPED;
      throw error;
    }
  });
  if (rows === SKIPPED) return SKIPPED;
  if (!Array.isArray(rows)) return null;

  const picked = filter === "any" ? pickDeliverableRow(rows) : pickPlaceRow(rows);
  if (!picked) return null;
  const { row, location } = picked;
  // ทางหลวงสายยาว หมุดอาจห่างบ้านลูกค้าหลายกิโลเมตร บอกได้แค่ระดับอำเภอ และใช้เป็นตัวสำรองสุดท้าย
  const isLongRoad = row.category === "highway" && LONG_ROAD_TYPES.has(row.type ?? "");
  return {
    ...location,
    displayName: row.display_name ?? query,
    precision: capPrecision(toPrecision(row.place_rank), isLongRoad ? "district" : maxPrecision),
    matchedQuery: query,
  };
}

function readCache(key: string) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache(key: string, value: GEOCODERESULT | null) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * ค้นตามลำดับภายในงบเวลา
 * - เจอจากชื่อสถานที่ที่ลูกค้าพิมพ์ หรือเจอระดับถนน/ซอย → ใช้ทันที
 * - เจอหยาบกว่านั้น → เก็บผลที่ละเอียดที่สุดไว้ แล้วค้นรอบถัดไปเฉพาะรอบที่อาจได้ผลดีกว่า
 * - รอบไหนล้มเหลว (429/5xx) → throw ให้ตอบ 502 และไม่ cache
 * - เวลาหมดก่อนค้นครบ → complete = false ไม่ cache ผล
 */
async function runQueries(queries: GEOCODEQUERY[]): Promise<RUNRESULT> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let best: GEOCODERESULT | null = null;

  for (const query of queries) {
    if (best && query.runIfBestCoarserThan && !isCoarser(best.precision, query.runIfBestCoarserThan)) continue;
    const found = await searchOnce(query, deadline);
    if (found === SKIPPED) return { value: best, complete: false };
    if (!found) continue;
    if (query.preferred || found.precision === "street") return { value: found, complete: true };
    if (!best || isCoarser(best.precision, found.precision)) best = found;
  }
  return { value: best, complete: true };
}

/** ผู้ใช้ที่ล็อกอินแล้วเท่านั้น กันคนนอกใช้ API นี้ยิง Nominatim จน IP ของเว็บถูกบล็อก */
export async function geocodeAddress(
  accessToken: string | null,
  rawAddress: unknown,
): Promise<SERVICERESULT<GEOCODERESULT | null>> {
  if (!accessToken) return failure("Missing access token", 401);
  if (typeof rawAddress !== "string") return failure("กรุณากรอกที่อยู่จัดส่ง", 400);
  const address = rawAddress.trim();
  if (address.length < MIN_QUERY_LENGTH) return failure("กรุณากรอกที่อยู่จัดส่ง", 400);
  if (address.length > MAX_QUERY_LENGTH) return failure("ที่อยู่ยาวเกินไป", 400);

  const { data, error } = await createAuthenticatedClient(accessToken).auth.getUser(accessToken);
  if (error || !data.user) return failure("Invalid session", 401);

  const queries = buildQueries(address);
  if (queries.length === 0) {
    return { result: apiSuccess("Address not found", null), status: 200 };
  }

  const cacheKey = queries.map((item) => `${item.filter}:${item.bounded ? "B:" : ""}${item.query}`).join("|");
  const cached = readCache(cacheKey);
  if (cached !== undefined) {
    return { result: apiSuccess(cached ? "Address found" : "Address not found", cached), status: 200 };
  }

  let pending = inFlight.get(cacheKey);
  if (!pending) {
    pending = runQueries(queries);
    inFlight.set(cacheKey, pending);
    void pending.then(
      // เก็บผลเฉพาะที่ค้นครบตามลำดับแล้ว ผลที่หยุดเพราะหมดเวลาให้ลองใหม่ได้
      ({ value, complete }) => { if (complete) writeCache(cacheKey, value); },
      () => undefined,
    ).finally(() => inFlight.delete(cacheKey));
  }

  try {
    const { value: found, complete } = await pending;
    // ค้นไม่ครบเพราะหมดเวลาและยังไม่เจออะไร บอกให้ลองใหม่ ไม่ใช่บอกว่าที่อยู่นี้ไม่มีบนแผนที่
    if (!found && !complete) {
      return failure("ระบบค้นหาที่อยู่ไม่ว่างชั่วคราว กรุณากดลองใหม่อีกครั้ง", 503);
    }
    return { result: apiSuccess(found ? "Address found" : "Address not found", found), status: 200 };
  } catch {
    // บริการแผนที่ล่ม ช้า หรือถูกจำกัดจำนวนครั้ง ไม่เก็บลง cache เพื่อให้ลองใหม่ได้
    return failure("ค้นหาที่อยู่บนแผนที่ไม่สำเร็จ กรุณาลองใหม่ หรือแตะบนแผนที่เพื่อปักหมุดเอง", 502);
  }
}
