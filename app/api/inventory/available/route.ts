import { apiError, apiSuccess } from "@/app/api/response";
import { getOrderableStock } from "@/app/api/services/stockService";

// จำนวนที่ลูกค้ายังสั่งได้ต่อสินค้า ใช้ตัวเลขชุดเดียวกับที่ createOrder ใช้ตรวจ
// สินค้าที่ไม่อยู่ในรายการ = คงเหลือ 0
export async function GET() {
  const stock = await getOrderableStock();
  if (!stock) return Response.json(apiError("Failed to fetch available stock"), { status: 500 });

  const results = [...stock].map(([productId, availableQuantity]) => ({ productId, availableQuantity }));
  return Response.json(apiSuccess("Available stock retrieved successfully", results), {
    headers: { "Cache-Control": "no-store" },
  });
}
