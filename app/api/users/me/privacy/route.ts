import { apiError } from "@/app/api/response";
import { acknowledgePrivacyPolicy } from "@/app/api/services/userService";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";
import { PRIVACY_POLICY_VERSION } from "@/app/privacy/policyVersion";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return Response.json(apiError("Missing access token"), { status: 401 });

  // บันทึกเฉพาะฉบับปัจจุบัน หน้าเว็บเก่าที่ค้างอยู่ต้องโหลดใหม่ก่อน เพื่อให้หลักฐานตรงกับฉบับที่ลูกค้าเห็นจริง
  const body = (await request.json().catch(() => null)) as { version?: unknown } | null;
  if (body?.version !== PRIVACY_POLICY_VERSION) {
    return Response.json(apiError("Privacy policy version is out of date"), { status: 409 });
  }

  const { result, status } = await acknowledgePrivacyPolicy(accessToken, PRIVACY_POLICY_VERSION);
  return Response.json(result, { status });
}
