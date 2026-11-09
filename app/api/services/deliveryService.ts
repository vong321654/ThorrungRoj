import "server-only";

import type { ADMINAUTH } from "@/app/models/admin";
import { ADMINROLE } from "@/app/models/admin";
import type { SERVICERESULT } from "@/app/models/api";
import {
  DELIVERY_STATUSES,
  type DELIVERYDRIVER,
  type DELIVERYETADETAIL,
  type DELIVERYJOB,
  type DELIVERYSTATUS,
  type DELIVERYTRACKING,
  type DELIVERYUPDATEPAYLOAD,
} from "@/app/models/delivery";
import { createAdminClient } from "@/app/api/util/supabase/admin";
import { createAuthenticatedClient } from "@/app/api/util/supabase/authenticated";
import { apiError, apiSuccess } from "../response";
import { isAdminOrSuperAdmin } from "./adminService";
import { recordDebtForDeliveredOrder } from "./debtService";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// ออเดอร์ที่ยังต้องจัดส่ง
const OPEN_ORDER_STATUSES = ["pending", "preparing", "delivering"];
const MAX_ETA_MINUTES = 600;

const TRACKING_FIELDS = "orderId, status, driverId, estimatedMinutes, lastSyncedAt, updatedAt";
const JOB_ORDER_FIELDS =
  "id, status, deliveryAddress, deliveryLat, deliveryLng, totalAmount, paymentMethod, users(name, phone, shopName), orderItems(productNameSnapshot, quantity)";

type TrackingRow = {
  orderId: string;
  status: DELIVERYSTATUS;
  driverId: string | null;
  estimatedMinutes: number | null;
  lastSyncedAt: string | null;
  updatedAt: string;
};

type JobOrderRow = {
  id: string;
  status: string;
  deliveryAddress: string | null;
  deliveryLat: number | string | null;
  deliveryLng: number | string | null;
  totalAmount: number | string;
  paymentMethod: string | null;
  users: { name: string; phone: string | null; shopName: string | null } | null;
  orderItems: Array<{ productNameSnapshot: string; quantity: number }> | null;
};

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function loadDriverNames(driverIds: Array<string | null>) {
  const ids = [...new Set(driverIds.filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  // ชื่อคนส่งเปิดให้ลูกค้าเห็นได้ แต่ RLS ของ employees ไม่ให้ลูกค้าอ่าน จึงดึงเฉพาะ id/name ด้วย service role
  const { data } = await createAdminClient().from("employees").select("id, name").in("id", ids);
  for (const row of data ?? []) names.set(row.id as string, row.name as string);
  return names;
}

function toTracking(row: TrackingRow, driverNames: Map<string, string>): DELIVERYTRACKING {
  return {
    orderId: row.orderId,
    status: row.status,
    driverId: row.driverId,
    driverName: row.driverId ? driverNames.get(row.driverId) ?? null : null,
    estimatedMinutes: row.estimatedMinutes,
    etaSetAt: row.lastSyncedAt,
    updatedAt: row.updatedAt,
  };
}

function toJob(order: JobOrderRow, tracking: DELIVERYTRACKING | null): DELIVERYJOB {
  const location = toDeliveryLocation(order.deliveryLat, order.deliveryLng);
  return {
    orderId: order.id,
    orderStatus: order.status,
    deliveryAddress: order.deliveryAddress,
    deliveryLat: location?.lat ?? null,
    deliveryLng: location?.lng ?? null,
    customerName: order.users?.shopName || order.users?.name || null,
    customerPhone: order.users?.phone ?? null,
    totalAmount: Number(order.totalAmount),
    paymentMethod: order.paymentMethod,
    items: (order.orderItems ?? []).map((item) => ({ name: item.productNameSnapshot, quantity: item.quantity })),
    tracking,
  };
}

/** ลูกค้าเจ้าของออเดอร์ คนส่งที่ถูกมอบหมาย และแอดมิน เรียกดูสถานะขนส่งของออเดอร์เดียวได้ */
export async function getOrderTracking(
  accessToken: string | null,
  orderId: string,
): Promise<SERVICERESULT<DELIVERYTRACKING | null>> {
  if (!accessToken) return failure("Missing access token", 401);
  if (!UUID_PATTERN.test(orderId)) return failure("A valid orderId is required", 400);

  const supabase = createAuthenticatedClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return failure("Invalid or expired session", 401);

  // RLS ของ deliveryTracking จำกัดให้เห็นเฉพาะเจ้าของออเดอร์ คนส่ง และแอดมิน
  const { data, error } = await supabase
    .from("deliveryTracking")
    .select(TRACKING_FIELDS)
    .eq("orderId", orderId)
    .maybeSingle();
  if (error) return failure("Failed to load delivery status", 500);
  if (!data) return { result: apiSuccess("No delivery information yet", null), status: 200 };

  const row = data as TrackingRow;
  const names = await loadDriverNames([row.driverId]);
  return { result: apiSuccess("Delivery status retrieved", toTracking(row, names)), status: 200 };
}

/** scope=all: แอดมินเห็นงานส่งที่ยังไม่เสร็จทั้งหมด / scope=mine: เห็นเฉพาะงานที่ตัวเองได้รับมอบหมาย */
export async function listDeliveryJobs(
  auth: ADMINAUTH,
  scope: "all" | "mine",
): Promise<SERVICERESULT<DELIVERYJOB[]>> {
  if (scope === "all" && !isAdminOrSuperAdmin(auth)) {
    return failure("Only admins can view every delivery", 403);
  }

  const supabase = createAdminClient();

  if (scope === "all") {
    const { data, error } = await supabase
      .from("orders")
      .select(`${JOB_ORDER_FIELDS}, deliveryTracking(${TRACKING_FIELDS})`)
      .in("status", OPEN_ORDER_STATUSES)
      .order("createdAt", { ascending: true });
    if (error) return failure("Failed to load deliveries", 500);

    const rows = (data ?? []) as unknown as Array<JobOrderRow & { deliveryTracking: TrackingRow | TrackingRow[] | null }>;
    const names = await loadDriverNames(rows.map((row) => first(row.deliveryTracking)?.driverId ?? null));
    const jobs = rows.map((row) => {
      const tracking = first(row.deliveryTracking);
      return toJob(row, tracking ? toTracking(tracking, names) : null);
    });
    return { result: apiSuccess("Deliveries retrieved", jobs), status: 200 };
  }

  // งานของฉัน: กรองตาม driverId ของผู้เรียกเสมอ พนักงานจึงเห็นแต่งานของตัวเอง
  const { data, error } = await supabase
    .from("deliveryTracking")
    .select(`${TRACKING_FIELDS}, orders!inner(${JOB_ORDER_FIELDS})`)
    .eq("driverId", auth.admin.id)
    .in("orders.status", OPEN_ORDER_STATUSES);
  if (error) return failure("Failed to load deliveries", 500);

  const rows = (data ?? []) as unknown as Array<TrackingRow & { orders: JobOrderRow | JobOrderRow[] }>;
  const names = await loadDriverNames(rows.map((row) => row.driverId));
  const jobs = rows.flatMap((row) => {
    const order = first(row.orders);
    return order ? [toJob(order, toTracking(row, names))] : [];
  });
  return { result: apiSuccess("Deliveries retrieved", jobs), status: 200 };
}

/** รายชื่อคนที่มอบหมายงานส่งได้ (พนักงานที่ยังใช้งานอยู่) สำหรับแอดมินเท่านั้น */
export async function listDrivers(auth: ADMINAUTH): Promise<SERVICERESULT<DELIVERYDRIVER[]>> {
  if (!isAdminOrSuperAdmin(auth)) return failure("Only admins can view drivers", 403);
  const { data, error } = await createAdminClient()
    .from("employees")
    .select("id, name, role")
    .eq("isActive", true)
    .order("name", { ascending: true });
  if (error) return failure("Failed to load drivers", 500);
  return { result: apiSuccess("Drivers retrieved", (data ?? []) as DELIVERYDRIVER[]), status: 200 };
}

function parseUpdate(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "Invalid delivery payload" } as const;
  }
  const input = payload as DELIVERYUPDATEPAYLOAD;

  const orderId = input.orderId;
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId)) {
    return { ok: false, message: "A valid orderId is required" } as const;
  }

  let status: DELIVERYSTATUS | undefined;
  if (input.status !== undefined) {
    if (!DELIVERY_STATUSES.includes(input.status as DELIVERYSTATUS)) {
      return { ok: false, message: "Invalid delivery status" } as const;
    }
    status = input.status as DELIVERYSTATUS;
  }

  // "auto" = ให้ระบบคำนวณจากที่ตั้งร้านถึงหมุดลูกค้า
  let estimatedMinutes: number | null | "auto" | undefined;
  if (input.estimatedMinutes !== undefined) {
    if (input.estimatedMinutes === null || input.estimatedMinutes === "") {
      estimatedMinutes = null;
    } else if (input.estimatedMinutes === "auto") {
      if (status === "delivered") return { ok: false, message: "Cannot estimate arrival time for a delivered order" } as const;
      estimatedMinutes = "auto";
    } else {
      // รับเฉพาะตัวเลขหรือสตริงตัวเลขล้วน กัน true / [] / "1e2" ที่ Number() แปลงเป็นเลขได้
      const raw = input.estimatedMinutes;
      const minutes =
        typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_ETA_MINUTES) {
        return { ok: false, message: `Estimated minutes must be a whole number from 0 to ${MAX_ETA_MINUTES}` } as const;
      }
      estimatedMinutes = minutes;
    }
  }

  let driverId: string | null | undefined;
  if (input.driverId !== undefined) {
    if (input.driverId === null || input.driverId === "") {
      driverId = null;
    } else if (typeof input.driverId === "string" && UUID_PATTERN.test(input.driverId)) {
      driverId = input.driverId;
    } else {
      return { ok: false, message: "Invalid driver id" } as const;
    }
  }

  if (status === undefined && estimatedMinutes === undefined && driverId === undefined) {
    return { ok: false, message: "No delivery updates supplied" } as const;
  }
  return { ok: true, orderId, status, estimatedMinutes, driverId } as const;
}

/**
 * แอดมิน: มอบหมายคนส่ง/ตั้งสถานะ/เวลาที่จะถึง ได้ทุกออเดอร์
 * พนักงาน: แก้สถานะและเวลาที่จะถึงได้เฉพาะงานที่ตัวเองถูกมอบหมาย และเปลี่ยนคนส่งไม่ได้
 * ตาราง deliveryTracking ไม่มี RLS policy สำหรับ INSERT จึงเขียนด้วย service role หลังตรวจสิทธิ์ในโค้ดนี้แล้ว
 */
export async function updateDelivery(
  auth: ADMINAUTH,
  payload: unknown,
): Promise<SERVICERESULT<DELIVERYTRACKING & { debtWarning: string | null }>> {
  const parsed = parseUpdate(payload);
  if (!parsed.ok) return failure(parsed.message, 400);

  const supabase = createAdminClient();
  const isManager = isAdminOrSuperAdmin(auth);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, deliveryLat, deliveryLng")
    .eq("id", parsed.orderId)
    .maybeSingle();
  if (orderError) return failure("Failed to load order", 500);
  if (!order) return failure("Order not found", 404);
  if (!OPEN_ORDER_STATUSES.includes(order.status as string)) {
    return failure("This order is already closed", 409);
  }

  const { data: existing, error: existingError } = await supabase
    .from("deliveryTracking")
    .select(TRACKING_FIELDS)
    .eq("orderId", parsed.orderId)
    .maybeSingle();
  if (existingError) return failure("Failed to load delivery", 500);
  const current = existing as TrackingRow | null;

  if (!isManager) {
    if (auth.admin.role !== ADMINROLE.EMPLOYEE) return failure("Not allowed", 403);
    if (!current || current.driverId !== auth.admin.id) {
      return failure("You can only update deliveries assigned to you", 403);
    }
    if (parsed.driverId !== undefined) {
      return failure("Only an admin can change the driver", 403);
    }
  }

  if (parsed.driverId) {
    const { data: driver, error: driverError } = await supabase
      .from("employees")
      .select("id")
      .eq("id", parsed.driverId)
      .eq("isActive", true)
      .maybeSingle();
    if (driverError) return failure("Failed to validate driver", 500);
    if (!driver) return failure("Driver not found or inactive", 400);
  }

  // ส่งถึงแล้ว = ออเดอร์จัดส่งแล้ว: ตัดสต๊อกและปิดออเดอร์ในทรานแซกชันเดียวกับปุ่ม "จัดส่งแล้ว" ในหน้าคำสั่งซื้อ
  // ทำก่อนบันทึกสถานะขนส่ง ถ้าถังเต็มไม่พอจะได้ไม่ค้างว่า "ส่งถึงแล้ว" ทั้งที่ออเดอร์ยังไม่ปิด
  // ฟังก์ชันล็อกแถวออเดอร์และปฏิเสธออเดอร์ที่จัดส่งแล้ว/ยกเลิก จึงไม่ตัดสต๊อกซ้ำแม้กดพร้อมกันสองหน้า
  // ใช้ service role เพราะคนส่งที่เป็นพนักงานเรียก fulfill_order_as_admin (เฉพาะแอดมิน) ไม่ได้ สิทธิ์ตรวจแล้วข้างบน
  if (parsed.status === "delivered") {
    const { error: fulfillError } = await supabase
      .rpc("fulfill_order_and_deduct_inventory", { p_order_id: parsed.orderId, p_admin_id: auth.admin.id })
      .single();
    if (fulfillError) {
      return failure("Unable to mark as delivered because inventory could not be updated (not enough full cylinders?)", 400);
    }
  }

  const now = new Date().toISOString();
  const values: Record<string, unknown> = { updatedAt: now };
  if (parsed.status !== undefined) values.status = parsed.status;
  if (parsed.driverId !== undefined) values.driverId = parsed.driverId;
  if (estimatedMinutes !== undefined) {
    values.estimatedMinutes = estimatedMinutes;
    // lastSyncedAt = เวลาที่ประเมิน ETA ล่าสุด หน้าลูกค้าแสดงเป็น "ประเมินเมื่อ HH:MM"
    values.lastSyncedAt = estimatedMinutes === null ? null : now;
  }

  const query = current
    ? supabase.from("deliveryTracking").update(values).eq("orderId", parsed.orderId)
    : supabase.from("deliveryTracking").insert({ orderId: parsed.orderId, ...values });
  const { data: saved, error: saveError } = await query.select(TRACKING_FIELDS).single();
  if (saveError || !saved) {
    if (parsed.status === "delivered") return failure("Order was marked as delivered but the delivery status could not be saved", 500);
    if (saveError?.code === "23505") return failure("Delivery was just created by someone else, please retry", 409);
    return failure("Failed to save delivery", 500);
  }

  // เริ่มนำส่งแล้ว ให้สถานะออเดอร์ที่ลูกค้าเห็นเป็น "กำลังจัดส่ง"
  // เงื่อนไข status ในคำสั่ง update กันกรณีแอดมินเพิ่งยืนยัน "จัดส่งแล้ว"/ยกเลิก ระหว่างที่เรากำลังบันทึก
  // (ถ้าเขียนทับเป็น delivering จะทำให้ออเดอร์ถูกตัดสต๊อกซ้ำได้)
  if (parsed.status === "inTransit" && ["pending", "preparing"].includes(order.status as string)) {
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({ status: "delivering", updatedAt: now })
      .eq("id", parsed.orderId)
      .in("status", ["pending", "preparing"]);
    if (orderUpdateError) {
      return failure("Delivery was saved but the order status could not be updated", 500);
    }
  }

  // บันทึกหนี้อัตโนมัติ (ค้างเงิน/ค้างถัง) เหมือนการยืนยันจัดส่งในหน้าคำสั่งซื้อ
  // ออเดอร์ปิดและตัดสต๊อกไปแล้ว ถ้าขั้นนี้พลาดจึงแจ้งเตือนแทนการตอบ error ไม่ให้กดซ้ำ
  let debtWarning: string | null = null;
  if (parsed.status === "delivered") {
    debtWarning = (await recordDebtForDeliveredOrder(supabase, parsed.orderId, auth.admin.id)).warning;
  }

  const row = saved as TrackingRow;
  const names = await loadDriverNames([row.driverId]);
  return { result: apiSuccess("Delivery updated", { ...toTracking(row, names), debtWarning }), status: 200 };
}
