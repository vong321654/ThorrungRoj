import { apiError } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import { deleteQrSlip, getQrPaymentForOrder, recordPartialQrPayment, rejectQrSlip, verifyQrPayment } from "@/app/api/services/paymentService";
import { authenticateAdmin } from "../authorization";

function isAdmin(role: ADMINROLE | null) {
  return role === ADMINROLE.ADMIN || role === ADMINROLE.SUPER_ADMIN;
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.admin.role)) return Response.json(apiError("Only admins can view payments"), { status: 403 });

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId?.trim()) return Response.json(apiError("Order id is required"), { status: 400 });

  const result = await getQrPaymentForOrder(orderId, auth.adminSupabase);
  return Response.json(result.result, { status: result.status });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.admin.role)) return Response.json(apiError("Only admins can verify payments"), { status: 403 });

  const body = await request.json().catch(() => null) as { paymentId?: unknown; slipId?: unknown; action?: unknown; reason?: unknown; amount?: unknown; note?: unknown } | null;
  if (!body || typeof body.paymentId !== "string" || typeof body.slipId !== "string") {
    return Response.json(apiError("Payment id and slip id are required"), { status: 400 });
  }

  if (body.action === "reject") {
    if (typeof body.reason !== "string" || !body.reason.trim()) return Response.json(apiError("A rejection reason is required"), { status: 400 });
    const result = await rejectQrSlip(body.paymentId, body.slipId, body.reason.trim(), auth.supabase);
    return Response.json(result.result, { status: result.status });
  }
  if (body.action === "partial") {
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return Response.json(apiError("A valid paid amount is required"), { status: 400 });
    if (body.note !== undefined && typeof body.note !== "string") return Response.json(apiError("Invalid note"), { status: 400 });
    const result = await recordPartialQrPayment(body.paymentId, body.slipId, amount, typeof body.note === "string" ? body.note.trim() || null : null, auth.supabase);
    return Response.json(result.result, { status: result.status });
  }
  if (body.action !== undefined && body.action !== "verify") return Response.json(apiError("Invalid payment action"), { status: 400 });
  const result = await verifyQrPayment(body.paymentId, body.slipId, auth.supabase);
  return Response.json(result.result, { status: result.status });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.admin.role)) return Response.json(apiError("Only admins can delete receipts"), { status: 403 });
  const params = new URL(request.url).searchParams;
  const paymentId = params.get("paymentId");
  const slipId = params.get("slipId");
  if (!paymentId || !slipId) return Response.json(apiError("Payment id and slip id are required"), { status: 400 });
  const result = await deleteQrSlip(paymentId, slipId, auth.adminSupabase);
  return Response.json(result.result, { status: result.status });
}
