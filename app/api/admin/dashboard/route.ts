import { apiError, apiSuccess } from "@/app/api/response";
import { authenticateAdmin } from "../authorization";

export type DashboardStats = {
  monthlySales: number;
  monthlyUnitsSold: number;
  outstandingMoney: number;
  outstandingCarts: number;
};

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if (auth instanceof Response) return auth;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [ordersResult, debtsResult, debtOrdersResult] = await Promise.all([
    auth.supabase
      .from("orders")
      .select("totalAmount, orderItems(quantity)")
      .gte("createdAt", monthStart)
      .neq("status", "cancelled"),
    auth.supabase
      .from("debtRecords")
      .select("debtType, amount, debtTransactions(amount)"),
    auth.supabase
      .from("orders")
      .select("totalAmount, paymentMethod, paymentStatus, status, orderItems(quantity), debtRecords(id)")
      .in("paymentMethod", ["pendingPayment", "pendingCart"]),
  ]);

  if (ordersResult.error || debtsResult.error || debtOrdersResult.error) {
    return Response.json(apiError("Failed to load dashboard statistics"), { status: 500 });
  }

  const monthlySales = (ordersResult.data ?? []).reduce(
    (total, order) => total + Number(order.totalAmount),
    0,
  );
  const monthlyUnitsSold = (ordersResult.data ?? []).reduce(
    (total, order) => total + (order.orderItems ?? []).reduce(
      (itemTotal, item) => itemTotal + Number(item.quantity),
      0,
    ),
    0,
  );
  const debtBalances = (debtsResult.data ?? []).reduce(
    (totals, debt) => {
      const settled = (debt.debtTransactions ?? []).reduce(
        (sum, transaction) => sum + Number(transaction.amount),
        0,
      );
      const outstanding = Math.max(0, Number(debt.amount) - settled);
      if (debt.debtType === "money") totals.outstandingMoney += outstanding;
      if (debt.debtType === "cart") totals.outstandingCarts += outstanding;
      return totals;
    },
    { outstandingMoney: 0, outstandingCarts: 0 },
  );
  const unrecordedOrderDebts = (debtOrdersResult.data ?? []).reduce(
    (totals, order) => {
      const hasDebtRecord = (order.debtRecords ?? []).length > 0;
      if (hasDebtRecord || order.paymentStatus === "paid" || order.status === "cancelled") return totals;
      if (order.paymentMethod === "pendingPayment") totals.outstandingMoney += Number(order.totalAmount);
      if (order.paymentMethod === "pendingCart") {
        totals.outstandingCarts += (order.orderItems ?? []).reduce(
          (sum, item) => sum + Number(item.quantity),
          0,
        );
      }
      return totals;
    },
    { outstandingMoney: 0, outstandingCarts: 0 },
  );

  return Response.json(apiSuccess("Dashboard statistics retrieved successfully", {
    monthlySales,
    monthlyUnitsSold,
    outstandingMoney: debtBalances.outstandingMoney + unrecordedOrderDebts.outstandingMoney,
    outstandingCarts: debtBalances.outstandingCarts + unrecordedOrderDebts.outstandingCarts,
  } satisfies DashboardStats));
}
