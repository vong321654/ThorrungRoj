import { apiError } from "@/app/api/response";
import { geocodeAddress } from "@/app/api/services/geocodeService";
import { getBearerToken } from "@/app/api/util/supabase/authenticated";

// ค้นหลายรอบและต้องเว้นระยะ 1.1 วินาทีตามนโยบาย Nominatim (งบเวลารวมใน service คือ 9 วินาที)
export const maxDuration = 20;

// ใช้ POST เพื่อไม่ให้ที่อยู่ลูกค้าไปอยู่ใน URL และ log ของเซิร์ฟเวอร์
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: unknown } | null;
  if (!body || typeof body !== "object") {
    return Response.json(apiError("Invalid JSON payload"), { status: 400 });
  }
  const { result, status } = await geocodeAddress(getBearerToken(request), body.address);
  return Response.json(result, { status });
}
