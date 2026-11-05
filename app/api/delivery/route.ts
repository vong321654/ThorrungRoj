import { apiError } from "@/app/api/response";
import { authenticateAdmin } from "@/app/api/admin/authorization";
import {
  getOrderTracking,
  listDeliveryJobs,
  listDrivers,
  updateDelivery,
} from "@/app/api/services/deliveryService";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

// GET ?orderId=...   ลูกค้า/คนส่ง/แอดมิน ดูสถานะขนส่งของออเดอร์เดียว
// GET ?scope=all     แอดมิน ดูงานส่งทั้งหมดที่ยังไม่เสร็จ
// GET ?scope=mine    พนักงาน ดูงานที่ได้รับมอบหมาย
// GET ?drivers=1     แอดมิน ดูรายชื่อคนที่มอบหมายงานได้
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const orderId = params.get("orderId");
  const scope = params.get("scope");

  if (orderId) {
    const response = await getOrderTracking(getBearerToken(request), orderId);
    return Response.json(response.result, { status: response.status });
  }

  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  if (params.get("drivers")) {
    const response = await listDrivers(auth);
    return Response.json(response.result, { status: response.status });
  }
  if (scope === "all" || scope === "mine") {
    const response = await listDeliveryJobs(auth, scope);
    return Response.json(response.result, { status: response.status });
  }
  return Response.json(apiError("orderId, scope or drivers is required"), { status: 400 });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const payload = await request.json().catch(() => null);
  const response = await updateDelivery(auth, payload);
  return Response.json(response.result, { status: response.status });
}
