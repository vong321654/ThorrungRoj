import { apiError } from "@/app/api/response";
import { deleteAdminsPermanently } from "@/app/api/services/adminService";
import { authenticateAdmin } from "../authorization";

// ลบผู้ดูแลหลายคนแบบถาวร แยกจาก DELETE /api/admin ซึ่งเป็นแค่ปิดใช้งาน
export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (!body) return Response.json(apiError("Invalid payload"), { status: 400 });
  const result = await deleteAdminsPermanently(auth, body.ids);
  return Response.json(result, { status: result.status === "success" ? 200 : 400 });
}
