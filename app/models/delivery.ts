export type DELIVERYSTATUS = "pending" | "inTransit" | "delivered";

export const DELIVERY_STATUSES: DELIVERYSTATUS[] = ["pending", "inTransit", "delivered"];

export type DELIVERYTRACKING = {
  orderId: string;
  status: DELIVERYSTATUS;
  driverId: string | null;
  driverName: string | null;
  // เวลาที่คนส่ง/ระบบประเมินว่าจะถึง (นาที) ประเมินไว้เมื่อ etaSetAt
  estimatedMinutes: number | null;
  etaSetAt: string | null;
  updatedAt: string;
};

// รายการงานส่งที่แอดมินและพนักงานเห็นในหน้า "งานจัดส่ง"
export type DELIVERYJOB = {
  orderId: string;
  orderStatus: string;
  deliveryAddress: string | null;
  // หมุดที่ลูกค้าปักตอนสั่งซื้อ null ถ้าไม่ได้ปัก
  deliveryLat: number | null;
  deliveryLng: number | null;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  paymentMethod: string | null;
  items: Array<{ name: string; quantity: number }>;
  tracking: DELIVERYTRACKING | null;
};

export type DELIVERYDRIVER = { id: string; name: string; role: string };

// รายละเอียดตอนระบบคำนวณเวลาที่จะถึงให้ (ส่งกลับเฉพาะตอนอัปเดตด้วย estimatedMinutes = "auto")
export type DELIVERYETADETAIL = {
  distanceKm: number;
  // osrm = คิดตามเส้นทางถนนจริง, estimate = ประมาณจากระยะทางตรงเพราะบริการเส้นทางใช้ไม่ได้
  source: "osrm" | "estimate";
  bufferMinutes: number;
};

export type DELIVERYUPDATEPAYLOAD = {
  orderId?: unknown;
  status?: unknown;
  driverId?: unknown;
  estimatedMinutes?: unknown;
};
