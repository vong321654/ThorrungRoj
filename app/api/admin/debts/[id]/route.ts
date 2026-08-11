import { apiError, apiSuccess } from "@/app/api/response";
import { AdminRole } from "@/app/models/admin";
import { authenticateAdmin } from "../../authorization";

export async function POST(request: Request, context: RouteContext<"/api/admin/debts/[id]">) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (auth.admin.role !== AdminRole.Admin && auth.admin.role !== AdminRole.SuperAdmin) {
    return Response.json(apiError("Only admins can settle debts"), { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { amount?: unknown; note?: unknown } | null;
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || (body?.note !== undefined && typeof body.note !== "string")) {
    return Response.json(apiError("Invalid settlement amount"), { status: 400 });
  }

  const { data: debt, error: debtError } = await auth.supabase
    .from("debtRecords")
    .select("id, debtType, amount, debtTransactions(amount)")
    .eq("id", id)
    .maybeSingle();
  if (debtError) return Response.json(apiError("Failed to load debt record"), { status: 500 });
  if (!debt) return Response.json(apiError("Debt record not found"), { status: 404 });

  const settled = (debt.debtTransactions ?? []).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  if (amount > Number(debt.amount) - settled) {
    return Response.json(apiError("Settlement amount exceeds the remaining debt"), { status: 400 });
  }

  const { error: transactionError } = await auth.supabase.from("debtTransactions").insert({
    debtRecordId: debt.id,
    transactionType: debt.debtType === "money" ? "payment" : "return",
    amount,
    recordedBy: auth.admin.id,
    note: typeof body?.note === "string" ? body.note.trim() || null : null,
  });
  if (transactionError) return Response.json(apiError("Failed to record settlement"), { status: 500 });

  const nextSettled = settled + amount;
  const nextStatus = nextSettled === Number(debt.amount) ? "paid" : "partial";
  const { data, error: updateError } = await auth.supabase
    .from("debtRecords")
    .update({ status: nextStatus, updatedAt: new Date().toISOString() })
    .eq("id", debt.id)
    .select("id, status")
    .single();
  if (updateError) return Response.json(apiError("Settlement was recorded but the debt status could not be updated"), { status: 500 });
  return Response.json(apiSuccess("Debt settlement recorded successfully", data));
}
