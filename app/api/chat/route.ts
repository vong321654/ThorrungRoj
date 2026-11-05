import { chat } from "@/app/api/services/chatbotService";
import { apiError } from "@/app/api/response";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

// ใครก็ถามได้ (ไม่บังคับล็อกอิน) แต่จะบันทึกประวัติแชทเฉพาะลูกค้าที่ล็อกอิน
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) return Response.json(apiError("Invalid JSON payload"), { status: 400 });

  const response = await chat(getBearerToken(request), payload);
  return Response.json(response.result, { status: response.status });
}
