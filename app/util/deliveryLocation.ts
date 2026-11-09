// พิกัดหมุดจัดส่ง ใช้ร่วมกันทั้งหน้าเว็บและ API เพื่อให้ตรวจด้วยกติกาเดียวกัน

export type DELIVERYLOCATION = { lat: number; lng: number };

// กรอบประเทศไทยแบบหลวม ๆ กันหมุดหลุดไปทะเล/ต่างประเทศจากการแตะพลาดหรือ GPS เพี้ยน
export const THAILAND_BOUNDS = { minLat: 5.6, maxLat: 20.5, minLng: 97.3, maxLng: 105.7 } as const;

// ที่ตั้งร้าน 12/213 ซอยหมู่บ้านเขาน้อย ต.หัวหิน อ.หัวหิน จ.ประจวบคีรีขันธ์ 77110
// ใช้เป็นจุดตั้งต้นของแผนที่ก่อนลูกค้าปักหมุด และเป็นจุดเริ่มต้นตอนคำนวณเวลาจัดส่ง
// พิกัดหน้าร้านจริงจาก Google Maps (ปัดเป็นทศนิยม 7 ตำแหน่งตามคอลัมน์ numeric(10,7))
export const SHOP_LOCATION: DELIVERYLOCATION = { lat: 12.5773776, lng: 99.9464974 };

// รัศมีจัดส่งวัดจากร้าน (เส้นตรง) ขอบเขตที่ร้านตกลงไว้คือไม่เกินหนองแก บ่อฝ้าย หนองขอน
// ระยะจากร้านโดยประมาณ: ชุมชนหนองแก 4.3 กม. สถานีหนองแก 5.3 กม. บ่อฝ้าย 4.6 กม. บ้านหนองขอน 5.2 กม. Lakeside หนองขอน 5.6 กม.
export const MAX_DELIVERY_RADIUS_KM = 6;
export const OUT_OF_AREA_MESSAGE = `หมุดอยู่นอกระยะการจัดส่ง (ร้านส่งได้ในรัศมี ${MAX_DELIVERY_RADIUS_KM} กม. จากร้าน ประมาณหนองแก บ่อฝ้าย หนองขอน)`;

const EARTH_RADIUS_KM = 6371.0088;

/** ระยะเส้นตรงระหว่างสองพิกัด (สูตร haversine) หน่วยกิโลเมตร */
export function distanceKm(from: DELIVERYLOCATION, to: DELIVERYLOCATION) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function isInDeliveryArea(location: DELIVERYLOCATION) {
  return distanceKm(SHOP_LOCATION, location) <= MAX_DELIVERY_RADIUS_KM;
}

// คอลัมน์ deliveryLat/deliveryLng เป็น numeric(10,7)
const COORDINATE_DECIMALS = 7;

function roundCoordinate(value: number) {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

export function isInThailand(location: DELIVERYLOCATION) {
  return (
    location.lat >= THAILAND_BOUNDS.minLat &&
    location.lat <= THAILAND_BOUNDS.maxLat &&
    location.lng >= THAILAND_BOUNDS.minLng &&
    location.lng <= THAILAND_BOUNDS.maxLng
  );
}

export type PARSEDLOCATION =
  | { ok: true; location: DELIVERYLOCATION | null }
  | { ok: false; message: string };

/**
 * ไม่ส่งพิกัดมาเลย (undefined/null ทั้งคู่) = ไม่ได้ปักหมุด คืน location: null ให้ผู้เรียกตัดสินเอง (ตอนสั่งซื้อจะปฏิเสธ)
 * ส่งมาต้องเป็นตัวเลขจริงทั้งคู่ อยู่ในประเทศไทย และอยู่ในรัศมีจัดส่ง ไม่รับสตริง เพื่อกัน "1e2" หรือค่าแปลก ๆ
 */
export function parseDeliveryLocation(lat: unknown, lng: unknown): PARSEDLOCATION {
  const latMissing = lat === undefined || lat === null;
  const lngMissing = lng === undefined || lng === null;
  if (latMissing && lngMissing) return { ok: true, location: null };
  if (latMissing || lngMissing) return { ok: false, message: "กรุณาส่งพิกัดให้ครบทั้งละติจูดและลองจิจูด" };
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, message: "พิกัดจัดส่งไม่ถูกต้อง" };
  }

  const location = { lat: roundCoordinate(lat), lng: roundCoordinate(lng) };
  if (!isInThailand(location)) {
    return { ok: false, message: "หมุดจัดส่งต้องอยู่ในประเทศไทย กรุณาปักหมุดใหม่" };
  }
  // ตรวจซ้ำฝั่งเซิร์ฟเวอร์ กันคนยิง API ตรงข้ามป๊อปอัปหน้าเว็บ
  if (!isInDeliveryArea(location)) {
    return { ok: false, message: OUT_OF_AREA_MESSAGE };
  }
  return { ok: true, location };
}

function toCoordinate(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

/**
 * แปลงค่าจากฐานข้อมูล (numeric อาจมาเป็นสตริง) เป็นพิกัด
 * คืน null ถ้าไม่มี ไม่ครบ หรืออยู่นอกประเทศไทย เช่นแถวเก่าที่เป็น 0,0 จะได้ไม่โชว์ปุ่มนำทางลงทะเล
 */
export function toDeliveryLocation(lat: unknown, lng: unknown): DELIVERYLOCATION | null {
  const location = { lat: toCoordinate(lat), lng: toCoordinate(lng) };
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
  return isInThailand(location) ? location : null;
}

// ลิงก์ Google Maps แบบ Maps URLs ไม่ต้องใช้ API key บนมือถือจะเปิดแอป Google Maps ให้
export function googleMapsDirectionsUrl(location: DELIVERYLOCATION) {
  return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
}

export function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
