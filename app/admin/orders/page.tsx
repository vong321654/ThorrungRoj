"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import { useRequireAdmin, MANAGER_ONLY } from "../useRequireAdmin";
import { useAutoRefresh } from "../useAutoRefresh";

type AdminOrder = {
  id: string; totalAmount: number | string; paymentMethod: string | null; paymentStatus: string; status: string; deliveryAddress: string | null; createdAt: string;
  // ประเภทราคาที่ใช้ตอนสั่ง
  customerType?: "individual" | "shop";
  users: { name: string; phone: string | null; shopName: string | null } | null;
  payments?: Array<{ id: string; method: string; status: string; transferSlips: Array<{ id: string; status: string; createdAt: string }> }>;
  // API ส่งมาเฉพาะ superAdmin
  orderItems?: Array<{ id: string; productNameSnapshot: string; quantity: number; saleType: string }>;
};

type OrderUpdateResult = Pick<AdminOrder, "id" | "paymentMethod" | "paymentStatus" | "status"> & {
  debtsCreated: number;
  debtWarning: string | null;
};

type OrderPaymentStatus = "awaitingPayment" | "paid" | "pendingPayment" | "pendingCart" | "pendingBoth";
type OrderStatus = "pending" | "preparing" | "delivering" | "delivered" | "cancelled";

const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  awaitingPayment: "รอชำระเงิน",
  paid: "ชำระแล้ว",
  pendingPayment: "ค้างชำระ",
  pendingCart: "ค้างถัง",
  pendingBoth: "ค้างทั้งถังและเงิน",
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "รอดำเนินการ",
  preparing: "กำลังเตรียมสินค้า",
  delivering: "กำลังจัดส่ง",
  delivered: "จัดส่งแล้ว",
  cancelled: "ยกเลิก",
};

// ใช้ "ซื้อใหม่" เพราะรายการซื้อครอบคลุมทั้งถังและอะไหล่
const SALE_TYPE_CHIPS: Record<string, { label: string; color: "default" | "info" | "warning" }> = {
  sell: { label: "ซื้อใหม่", color: "default" },
  exchange: { label: "เปลี่ยนถัง", color: "info" },
  refill: { label: "ฝากเติม", color: "warning" },
};

function OrderItemsCell({ items }: { items: NonNullable<AdminOrder["orderItems"]> }) {
  if (items.length === 0) return <TableCell>-</TableCell>;
  return <TableCell sx={{ minWidth: 220 }}>
    <Stack spacing={0.75}>
      {items.map((item) => {
        const chip = SALE_TYPE_CHIPS[item.saleType] ?? { label: item.saleType, color: "default" as const };
        return <Box key={item.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip size="small" label={chip.label} color={chip.color} />
          <Typography variant="body2">{item.productNameSnapshot} × {item.quantity}</Typography>
        </Box>;
      })}
    </Stack>
  </TableCell>;
}

function getOrderPaymentStatus(order: AdminOrder): OrderPaymentStatus {
  if (order.paymentStatus === "paid") return "paid";
  if (order.paymentMethod === "pendingPayment") return "pendingPayment";
  if (order.paymentMethod === "pendingCart") return "pendingCart";
  if (order.paymentMethod === "pendingBoth") return "pendingBoth";
  return "awaitingPayment";
}

export default function AdminOrdersPage() {
  const { admin, isAllowed } = useRequireAdmin(MANAGER_ONLY);
  const isSuperAdmin = admin?.role === ADMINROLE.SUPER_ADMIN;
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [debtNotice, setDebtNotice] = useState<string | null>(null);

  function showDebtResult(result: OrderUpdateResult) {
    if (result.debtWarning) setError(result.debtWarning);
    setDebtNotice(result.debtsCreated > 0 ? "บันทึกรายการหนี้ให้อัตโนมัติแล้ว ดูได้ที่หน้าหนี้ค้าง" : null);
  }

  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  // null = ยังไม่เคยโหลด รอบแรกไม่นับว่าเป็นออเดอร์ใหม่
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  // background = รอบอัปเดตอัตโนมัติ ถ้าพลาดไม่ทับ error ที่แอดมินกำลังอ่านอยู่ รอบหน้าจะลองใหม่เอง
  const loadOrders = useCallback(async (background = false) => {
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/orders", { cache: "no-store", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const result = await response.json() as APIRESULT<AdminOrder[]>;
      if (!response.ok || result.status === "error") {
        if (!background) setError(result.message);
        return;
      }
      const known = knownOrderIdsRef.current;
      if (known) {
        const added = result.results.filter((order) => !known.has(order.id)).map((order) => order.id);
        if (added.length > 0) setNewOrderIds((current) => new Set([...current, ...added]));
      }
      knownOrderIdsRef.current = new Set(result.results.map((order) => order.id));
      setOrders(result.results);
    } catch {
      if (!background) setError("ไม่สามารถโหลดคำสั่งซื้อได้");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) void loadOrders();
  }, [isAllowed, loadOrders]);

  const refreshInBackground = useCallback(() => loadOrders(true), [loadOrders]);
  useAutoRefresh(refreshInBackground, isAllowed);

  async function updatePaymentStatus(orderId: string, paymentStatus: OrderPaymentStatus) {
    setUpdatingOrderId(orderId);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ orderId, paymentStatus }),
      });
      const result = await response.json() as APIRESULT<OrderUpdateResult>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, ...result.results } : order));
      showDebtResult(result.results);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "ไม่สามารถอัปเดตสถานะการชำระเงินได้");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function updateOrderStatus(orderId: string, orderStatus: OrderStatus) {
    setUpdatingOrderId(orderId);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ orderId, orderStatus }),
      });
      const result = await response.json() as APIRESULT<OrderUpdateResult>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, ...result.results } : order));
      showDebtResult(result.results);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "ไม่สามารถอัปเดตสถานะคำสั่งซื้อได้");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return <Box sx={{ p: 4 }}>
    <Button component={Link} href="/admin" sx={{ mb: 2 }}>← กลับหน้าจัดการระบบ</Button>
    <Typography variant="h5" sx={{ mb: 2 }}>คำสั่งซื้อ</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {debtNotice && <Alert severity="success" sx={{ mb: 2 }}>{debtNotice}</Alert>}
    {newOrderIds.size > 0 && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNewOrderIds(new Set())}>มีคำสั่งซื้อใหม่ {newOrderIds.size} รายการ (แถวที่มีป้าย &quot;ใหม่&quot;)</Alert>}
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>อัปเดตอัตโนมัติทุก 15 วินาที</Typography>
    {isLoading ? <CircularProgress /> : !error && orders.length === 0 ? <Paper sx={{ p: 3 }}>ยังไม่มีคำสั่งซื้อ</Paper> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>วันที่</TableCell><TableCell>ลูกค้า</TableCell>{isSuperAdmin && <TableCell>รายการ</TableCell>}<TableCell>ยอดรวม</TableCell><TableCell>วิธีชำระเงิน</TableCell><TableCell>สถานะชำระเงิน</TableCell><TableCell>ตรวจสอบการชำระ</TableCell><TableCell>อัปเดตการชำระเงิน</TableCell><TableCell>สถานะคำสั่งซื้อ</TableCell><TableCell>อัปเดตออเดอร์</TableCell></TableRow></TableHead><TableBody>{orders.map((order) => <TableRow key={order.id} sx={newOrderIds.has(order.id) ? { bgcolor: "action.selected" } : undefined}><TableCell>{new Date(order.createdAt).toLocaleString("th-TH")}{newOrderIds.has(order.id) && <Chip size="small" color="primary" label="ใหม่" sx={{ ml: 1 }} />}</TableCell><TableCell>{order.users?.shopName || order.users?.name || "-"}{order.customerType === "shop" && <Chip size="small" color="secondary" label="ราคาร้านค้า" sx={{ ml: 1 }} />}</TableCell>{isSuperAdmin && <OrderItemsCell items={order.orderItems ?? []} />}<TableCell>{Number(order.totalAmount).toLocaleString("th-TH")} บาท</TableCell><TableCell>{order.paymentMethod === "cash" ? "เงินสด" : order.paymentMethod === "qrScan" ? "สแกน QR" : order.paymentMethod === "pendingPayment" ? "ค้างชำระ" : order.paymentMethod === "pendingCart" ? "ค้างถัง" : order.paymentMethod === "pendingBoth" ? "ค้างทั้งถังและเงิน" : "-"}</TableCell><TableCell>{PAYMENT_STATUS_LABELS[getOrderPaymentStatus(order)]}</TableCell><TableCell>{order.paymentMethod === "qrScan" ? <Button size="small" component={Link} href={`/admin/orders/${order.id}`}>ดูสลิป QR</Button> : "-"}</TableCell><TableCell><Select size="small" value={getOrderPaymentStatus(order)} disabled={updatingOrderId === order.id || order.paymentMethod === "qrScan"} onChange={(event) => void updatePaymentStatus(order.id, event.target.value as OrderPaymentStatus)}>{(Object.entries(PAYMENT_STATUS_LABELS) as [OrderPaymentStatus, string][]).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></TableCell><TableCell>{ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}</TableCell><TableCell><Select size="small" value={ORDER_STATUS_LABELS[order.status as OrderStatus] ? order.status : "pending"} disabled={updatingOrderId === order.id} onChange={(event) => void updateOrderStatus(order.id, event.target.value as OrderStatus)}>{(Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Box>;
}
