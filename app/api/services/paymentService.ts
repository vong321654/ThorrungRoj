import type { SupabaseClient } from "@supabase/supabase-js";
import { apiError, apiSuccess } from "@/app/api/response";
import type { SERVICERESULT } from "@/app/models/api";

export type QrPaymentDetails = {
  id: string;
  orderId: string;
  amount: number | string;
  method: "qrScan";
  status: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  orders: {
    id: string;
    totalAmount: number | string;
    paymentStatus: string;
    status: string;
    users: { name: string; phone: string | null; shopName: string | null } | null;
  } | null;
  transferSlips: Array<{
    id: string;
    slipImageUrl: string;
    status: string;
    rejectReason: string | null;
    verifiedBy: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }>;
};

function failure<T>(message: string, status: number): SERVICERESULT<T> {
  return { result: apiError(message), status };
}

export async function getQrPaymentForOrder(
  orderId: string,
  supabase: SupabaseClient,
): Promise<SERVICERESULT<QrPaymentDetails>> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, orderId, amount, method, status, verifiedBy, verifiedAt, createdAt, orders!inner(id, totalAmount, paymentStatus, status, users(name, phone, shopName)), transferSlips(id, slipImageUrl, status, rejectReason, verifiedBy, verifiedAt, createdAt)",
    )
    .eq("orderId", orderId)
    .eq("method", "qrScan")
    .maybeSingle();

  if (error) return failure("Failed to load QR payment", 500);
  if (!data) return failure("QR payment was not found for this order", 404);

  return {
    result: apiSuccess("QR payment retrieved successfully", {
      ...data,
      orders: Array.isArray(data.orders) ? data.orders[0] ?? null : data.orders,
      transferSlips: data.transferSlips ?? [],
    } as unknown as QrPaymentDetails),
    status: 200,
  };
}

export async function verifyQrPayment(
  paymentId: string,
  slipId: string,
  supabase: SupabaseClient,
  adminId: string,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase
    .rpc("verify_qr_payment", {
      p_payment_id: paymentId,
      p_slip_id: slipId,
      p_admin_id: adminId,
    })
    .single();

  if (error || !data) return failure("Unable to verify QR payment", 400);
  return { result: apiSuccess("QR payment verified successfully", data), status: 200 };
}

export async function rejectQrSlip(
  paymentId: string,
  slipId: string,
  reason: string,
  supabase: SupabaseClient,
  adminId: string,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase.rpc("reject_qr_payment_slip", {
    p_payment_id: paymentId,
    p_slip_id: slipId,
    p_reason: reason,
    p_admin_id: adminId,
  }).single();
  if (error || !data) return failure("Unable to reject QR payment slip", 400);
  return { result: apiSuccess("QR payment slip rejected", data), status: 200 };
}

export async function recordPartialQrPayment(
  paymentId: string,
  slipId: string,
  amount: number,
  note: string | null,
  supabase: SupabaseClient,
  adminId: string,
): Promise<SERVICERESULT<unknown>> {
  const { data, error } = await supabase.rpc("record_partial_qr_payment", {
    p_payment_id: paymentId,
    p_slip_id: slipId,
    p_paid_amount: amount,
    p_note: note,
    p_admin_id: adminId,
  }).single();
  if (error || !data) return failure("Unable to record partial payment", 400);
  return { result: apiSuccess("Partial payment and debt recorded successfully", data), status: 200 };
}

export async function deleteQrSlip(
  paymentId: string,
  slipId: string,
  supabase: SupabaseClient,
) : Promise<SERVICERESULT<unknown>> {
  const { data: slip, error: slipError } = await supabase
    .from("transferSlips")
    .select("id, slipImageUrl, status")
    .eq("id", slipId)
    .eq("paymentId", paymentId)
    .maybeSingle();
  if (slipError) return failure("Failed to load receipt", 500);
  if (!slip) return failure("Receipt not found", 404);
  if (slip.status === "verified") return failure("A verified receipt cannot be deleted", 400);

  const { error } = await supabase.from("transferSlips").delete().eq("id", slip.id);
  if (error) return failure("Failed to delete receipt", 500);
  const { error: storageError } = await supabase.storage.from("payment-receipts").remove([slip.slipImageUrl]);
  if (storageError) return failure("Receipt was deleted but its image could not be removed", 500);
  return { result: apiSuccess("Receipt deleted successfully", { id: slip.id }), status: 200 };
}
