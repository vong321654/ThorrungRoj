import { apiError, apiSuccess } from "@/app/api/response";
import { AdminRole } from "@/app/models/admin";
import { authenticateAdmin } from "../authorization";

type DebtChoice = "money" | "cart" | "both";

function canManageDebts(role: AdminRole | null) {
  return role === AdminRole.Admin || role === AdminRole.SuperAdmin;
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.supabase
    .from("debtRecords")
    .select("id, userId, orderId, debtType, amount, status, note, createdAt, users(name, phone, shopName), products(name, size), debtTransactions(id, transactionType, amount, note, createdAt)")
    .order("createdAt", { ascending: false });
  if (error) return Response.json(apiError("Failed to fetch debt records"), { status: 500 });

  return Response.json(apiSuccess("Debt records retrieved successfully", data ?? []));
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;
  if (!canManageDebts(auth.admin.role)) return Response.json(apiError("Only admins can record debts"), { status: 403 });

  const body = await request.json().catch(() => null) as { orderId?: unknown; debtType?: unknown; note?: unknown } | null;
  if (!body || typeof body.orderId !== "string" || !["money", "cart", "both"].includes(body.debtType as string)) {
    return Response.json(apiError("Invalid debt record"), { status: 400 });
  }
  if (body.note !== undefined && typeof body.note !== "string") {
    return Response.json(apiError("Invalid note"), { status: 400 });
  }

  const { data: order, error: orderError } = await auth.supabase
    .from("orders")
    .select("id, userId, totalAmount, status, orderItems(productId, quantity, saleType), debtRecords(debtType)")
    .eq("id", body.orderId)
    .maybeSingle();
  if (orderError) return Response.json(apiError("Failed to load order"), { status: 500 });
  if (!order) return Response.json(apiError("Order not found"), { status: 404 });
  if (order.status !== "delivered") {
    return Response.json(apiError("Debt can only be recorded after the order is delivered"), { status: 400 });
  }

  const debtType = body.debtType as DebtChoice;
  const existingTypes = new Set((order.debtRecords ?? []).map((debt) => debt.debtType));
  if ((debtType === "money" || debtType === "both") && existingTypes.has("money")) {
    return Response.json(apiError("This order already has a money debt record"), { status: 400 });
  }
  if ((debtType === "cart" || debtType === "both") && existingTypes.has("cart")) {
    return Response.json(apiError("This order already has a cart debt record"), { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const records: Array<Record<string, unknown>> = [];
  if (debtType === "money" || debtType === "both") {
    records.push({ userId: order.userId, orderId: order.id, recordedBy: auth.admin.id, debtType: "money", amount: order.totalAmount, note });
  }
  if (debtType === "cart" || debtType === "both") {
    for (const item of order.orderItems ?? []) {
      if ((item.saleType !== "sell" && item.saleType !== "exchange") || !item.productId || item.quantity <= 0) continue;
      records.push({ userId: order.userId, orderId: order.id, recordedBy: auth.admin.id, debtType: "cart", productId: item.productId, amount: item.quantity, note });
    }
    if (!records.some((record) => record.debtType === "cart")) {
      return Response.json(apiError("This order has no gas cylinders to record as a cart debt"), { status: 400 });
    }
  }

  const { data, error } = await auth.supabase.from("debtRecords").insert(records).select("id");
  if (error) return Response.json(apiError("Failed to create debt records"), { status: 500 });
  return Response.json(apiSuccess("Debt records created successfully", data ?? []), { status: 201 });
}
