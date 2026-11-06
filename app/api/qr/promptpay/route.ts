import { apiError } from "@/app/api/response";
import { buildPromptPayQrPng, verifyPromptPayQrLink } from "@/app/api/services/promptPayService";
import { createAdminClient } from "@/app/api/util/supabase/admin";

// LINE ดึงรูปจาก URL นี้โดยไม่มี token จึงใช้ลายเซ็นในลิงก์แทนการล็อกอิน
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const orderId = params.get("orderId") ?? "";
  if (!verifyPromptPayQrLink(orderId, params.get("exp") ?? "", params.get("sig") ?? "")) {
    return Response.json(apiError("Invalid or expired link"), { status: 403 });
  }

  const { data: order, error } = await createAdminClient()
    .from("orders")
    .select("totalAmount, paymentMethod, paymentStatus, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return Response.json(apiError("Failed to load order"), { status: 500 });
  if (!order || order.paymentMethod !== "qrScan") {
    return Response.json(apiError("Order not found"), { status: 404 });
  }
  // จ่ายแล้วหรือยกเลิกแล้ว ไม่แสดง QR อีก กันลูกค้าโอนซ้ำ
  if (order.paymentStatus === "paid" || order.status === "cancelled") {
    return Response.json(apiError("This order no longer needs payment"), { status: 410 });
  }

  const png = await buildPromptPayQrPng(Number(order.totalAmount));
  if (!png) return Response.json(apiError("PromptPay is not configured"), { status: 500 });

  return new Response(png.buffer as ArrayBuffer, {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
