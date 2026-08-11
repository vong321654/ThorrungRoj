"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import { useRequireAdmin } from "../useRequireAdmin";

type AdminOrder = {
  id: string; totalAmount: number | string; paymentMethod: string | null; paymentStatus: string; status: string; deliveryAddress: string | null; createdAt: string;
  users: { name: string; phone: string | null; shopName: string | null } | null;
};

type OrderPaymentStatus = "paid" | "pendingPayment" | "pendingCart";
type OrderStatus = "pending" | "preparing" | "delivering" | "delivered" | "cancelled";

const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  paid: "ชำระแล้ว",
  pendingPayment: "ค้างชำระ",
  pendingCart: "ค้างถัง",
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "รอดำเนินการ",
  preparing: "กำลังเตรียมสินค้า",
  delivering: "กำลังจัดส่ง",
  delivered: "จัดส่งแล้ว",
  cancelled: "ยกเลิก",
};

function getOrderPaymentStatus(order: AdminOrder): OrderPaymentStatus {
  if (order.paymentStatus === "paid") return "paid";
  if (order.paymentMethod === "pendingPayment") return "pendingPayment";
  if (order.paymentMethod === "pendingCart") return "pendingCart";
  return "pendingPayment";
}

export default function AdminOrdersPage() {
  const { isAllowed } = useRequireAdmin();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAllowed) return;
    async function loadOrders() {
      const { data } = await createClient().auth.getSession();
      const response = await fetch("/api/admin/orders", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const result = await response.json() as ApiResult<AdminOrder[]>;
      if (!response.ok || result.status === "error") {
        setError(result.message);
      } else {
        setOrders(result.results);
      }
      setIsLoading(false);
    }
    void loadOrders();
  }, [isAllowed]);

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
      const result = await response.json() as ApiResult<Pick<AdminOrder, "id" | "paymentMethod" | "paymentStatus" | "status">>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, ...result.results } : order));
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
      const result = await response.json() as ApiResult<Pick<AdminOrder, "id" | "paymentMethod" | "paymentStatus" | "status">>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, ...result.results } : order));
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
    {isLoading ? <CircularProgress /> : !error && orders.length === 0 ? <Paper sx={{ p: 3 }}>ยังไม่มีคำสั่งซื้อ</Paper> : <TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>วันที่</TableCell><TableCell>ลูกค้า</TableCell><TableCell>ยอดรวม</TableCell><TableCell>วิธีชำระเงิน</TableCell><TableCell>สถานะชำระเงิน</TableCell><TableCell>อัปเดตการชำระเงิน</TableCell><TableCell>สถานะคำสั่งซื้อ</TableCell><TableCell>อัปเดตออเดอร์</TableCell></TableRow></TableHead><TableBody>{orders.map((order) => <TableRow key={order.id}><TableCell>{new Date(order.createdAt).toLocaleString("th-TH")}</TableCell><TableCell>{order.users?.shopName || order.users?.name || "-"}</TableCell><TableCell>{Number(order.totalAmount).toLocaleString("th-TH")} บาท</TableCell><TableCell>{order.paymentMethod === "cash" ? "เงินสด" : order.paymentMethod === "qrScan" ? "สแกน QR" : order.paymentMethod === "pendingPayment" ? "ค้างชำระ" : order.paymentMethod === "pendingCart" ? "ค้างถัง" : "-"}</TableCell><TableCell>{PAYMENT_STATUS_LABELS[getOrderPaymentStatus(order)]}</TableCell><TableCell><Select size="small" value={getOrderPaymentStatus(order)} disabled={updatingOrderId === order.id} onChange={(event) => void updatePaymentStatus(order.id, event.target.value as OrderPaymentStatus)}>{(Object.entries(PAYMENT_STATUS_LABELS) as [OrderPaymentStatus, string][]).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></TableCell><TableCell>{ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}</TableCell><TableCell><Select size="small" value={ORDER_STATUS_LABELS[order.status as OrderStatus] ? order.status : "pending"} disabled={updatingOrderId === order.id} onChange={(event) => void updateOrderStatus(order.id, event.target.value as OrderStatus)}>{(Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Box>;
}
