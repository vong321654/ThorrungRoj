export type DELIVERYSTATUS = "pending" | "inTransit" | "delivered";

export const DELIVERY_STATUSES: DELIVERYSTATUS[] = ["pending", "inTransit", "delivered"];

export type DELIVERYTRACKING = {
  orderId: string;
  status: DELIVERYSTATUS;
  driverId: string | null;
  driverName: string | null;
  // เวลาที่คนส่งคาดว่าจะถึง (นาที) นับจาก etaSetAt
  estimatedMinutes: number | null;
  etaSetAt: string | null;
  updatedAt: string;
  serverNow: string;
};

// รายการงานส่งที่แอดมินและพนักงานเห็นในหน้า "งานจัดส่ง"
export type DELIVERYJOB = {
  orderId: string;
  orderStatus: string;
  deliveryAddress: string | null;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  paymentMethod: string | null;
  items: Array<{ name: string; quantity: number }>;
  tracking: DELIVERYTRACKING | null;
};

export type DELIVERYDRIVER = { id: string; name: string; role: string };

export type DELIVERYUPDATEPAYLOAD = {
  orderId?: unknown;
  status?: unknown;
  driverId?: unknown;
  estimatedMinutes?: unknown;
};
