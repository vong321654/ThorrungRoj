import "server-only";

import type { DELIVERYLOCATION } from "@/app/util/deliveryLocation";

// คำนวณเวลาขับรถจากร้านถึงบ้านลูกค้าด้วย OSRM (บริการเส้นทางฟรีบนข้อมูล OpenStreetMap ไม่ต้องใช้ key)
// เซิร์ฟเวอร์สาธารณะของ OSRM เป็นเซิร์ฟเวอร์สาธิต: ไม่เกิน 1 ครั้ง/วินาที และไม่รับประกันว่าจะใช้ได้ตลอด
// จึงมีวิธีสำรองจากระยะทางตรงเสมอ https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const USER_AGENT = "ThorRungrojGasShop/1.0 (delivery ETA)";
const REQUEST_TIMEOUT_MS = 5000;
const MIN_INTERVAL_MS = 1100;

// เวลาเผื่อจอดรถ ยกถัง หาบ้าน (ร้านตกลงไว้ 5 นาที)
export const ETA_BUFFER_MINUTES = 5;
export const MAX_ETA_MINUTES = 600;
// วิธีสำรอง: ถนนจริงคดเคี้ยวกว่าระยะทางตรงประมาณ 1.4 เท่า และใช้ความเร็วเฉลี่ย 40 กม./ชม. (ใกล้ค่าที่ OSRM ให้ในหัวหิน 37-55 กม./ชม. ไม่ให้เวลาสองวิธีต่างกันมาก)
const ROAD_FACTOR = 1.4;
const FALLBACK_SPEED_KMH = 40;

export type ETASOURCE = "osrm" | "estimate";

export type ETARESULT = {
  minutes: number;
  distanceKm: number;
  // osrm = คิดตามถนนจริง, estimate = ประมาณจากระยะทางตรงเพราะ OSRM ใช้ไม่ได้
  source: ETASOURCE;
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{ duration?: number; distance?: number }>;
};

let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

// เว้นระยะการเรียก OSRM ตามนโยบายของเซิร์ฟเวอร์สาธิต แม้หลายคนกดพร้อมกัน
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

export function haversineKm(from: DELIVERYLOCATION, to: DELIVERYLOCATION) {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** นาทีขับรถ (ปัดขึ้น) + เวลาเผื่อ ไม่ต่ำกว่าเวลาเผื่อ และไม่เกินเพดานที่ระบบรับได้ */
export function toEtaMinutes(driveSeconds: number) {
  const minutes = Math.ceil(Math.max(0, driveSeconds) / 60) + ETA_BUFFER_MINUTES;
  return Math.min(MAX_ETA_MINUTES, minutes);
}

function roundKm(km: number) {
  return Math.round(km * 10) / 10;
}

export function estimateFromStraightLine(from: DELIVERYLOCATION, to: DELIVERYLOCATION): ETARESULT {
  const roadKm = haversineKm(from, to) * ROAD_FACTOR;
  return {
    minutes: toEtaMinutes((roadKm / FALLBACK_SPEED_KMH) * 3600),
    distanceKm: roundKm(roadKm),
    source: "estimate",
  };
}

async function routeWithOsrm(from: DELIVERYLOCATION, to: DELIVERYLOCATION): Promise<ETARESULT | null> {
  // OSRM รับพิกัดเป็น ลองจิจูด,ละติจูด
  const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false&steps=false`;
  const response = await throttled(() =>
    fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  );
  if (!response.ok) return null;
  const body = (await response.json()) as OsrmResponse;
  const route = body.code === "Ok" ? body.routes?.[0] : undefined;
  if (
    !route ||
    typeof route.duration !== "number" ||
    typeof route.distance !== "number" ||
    !Number.isFinite(route.duration) ||
    !Number.isFinite(route.distance) ||
    route.duration < 0 ||
    route.distance < 0
  ) {
    return null;
  }
  return { minutes: toEtaMinutes(route.duration), distanceKm: roundKm(route.distance / 1000), source: "osrm" };
}

/** ไม่ throw เสมอ: OSRM ล่ม ช้า หรือหาเส้นทางไม่ได้ จะใช้วิธีประมาณจากระยะทางตรงแทน */
export async function estimateDeliveryEta(from: DELIVERYLOCATION, to: DELIVERYLOCATION): Promise<ETARESULT> {
  try {
    const routed = await routeWithOsrm(from, to);
    if (routed) return routed;
  } catch {
    // ตกไปใช้วิธีสำรองด้านล่าง
  }
  return estimateFromStraightLine(from, to);
}
