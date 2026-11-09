import { apiError, apiSuccess } from "@/app/api/response";
import { CUSTOMERTYPE, SHOPREQUESTSTATUS } from "@/app/enums/customer";
import { ADMINROLE } from "@/app/models/admin";
import { ADMIN_CUSTOMER_FIELDS } from "@/app/models/user";
import { authenticateAdmin } from "../../authorization";

/**
 * ยืนยันหรือยกเลิกคำขอเป็นร้านค้าที่ลูกค้าเลือกตอนเข้าใช้ครั้งแรก
 * ยืนยัน = ได้ราคาร้านค้า, ยกเลิก = เป็นบ้านทั่วไป
 * จำกัดเฉพาะ super admin เหมือนการแก้ข้อมูลลูกค้าอื่นๆ (trigger "protectCustomerColumns" ก็บังคับแบบเดียวกัน)
 */
export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== ADMINROLE.SUPER_ADMIN) {
    return Response.json(apiError("Only a super admin can review shop requests"), { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
  if (!body || typeof body.id !== "string" || !body.id.trim()) {
    return Response.json(apiError("User id is required"), { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return Response.json(apiError("Invalid action"), { status: 400 });
  }

  const isApproved = body.action === "approve";
  // กรองเฉพาะคำขอที่ยังรออยู่ กันกดซ้ำหรือแอดมินสองคนกดพร้อมกัน
  const { data, error } = await auth.adminSupabase
    .from("users")
    .update({
      customerType: isApproved ? CUSTOMERTYPE.SHOP : CUSTOMERTYPE.INDIVIDUAL,
      shopRequestStatus: isApproved ? SHOPREQUESTSTATUS.APPROVED : SHOPREQUESTSTATUS.REJECTED,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("shopRequestStatus", SHOPREQUESTSTATUS.PENDING)
    .select(ADMIN_CUSTOMER_FIELDS)
    .maybeSingle();

  if (error) return Response.json(apiError("Failed to review shop request"), { status: 500 });
  if (!data) {
    return Response.json(apiError("ไม่พบคำขอที่รอตรวจสอบ อาจถูกจัดการไปแล้ว กรุณาโหลดหน้าใหม่"), { status: 409 });
  }
  return Response.json(
    apiSuccess(isApproved ? "Shop request approved" : "Shop request rejected", data),
  );
}
