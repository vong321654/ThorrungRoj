"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert, Box, Button, Chip, CircularProgress, Container, Divider, Paper, Stack, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import type { OrderRecord } from "@/app/models/order";

const ORDER_LABELS: Record<string, string> = { pending: "รอดำเนินการ", preparing: "กำลังเตรียมสินค้า", delivering: "กำลังจัดส่ง", delivered: "จัดส่งแล้ว", cancelled: "ยกเลิกแล้ว" };
const PAYMENT_LABELS: Record<string, string> = { pending: "รอชำระเงิน", paid: "ชำระเงินแล้ว", pendingPayment: "ค้างชำระ", pendingCart: "ค้างถัง" };
const SALE_LABELS: Record<string, string> = { sell: "ซื้อถัง", exchange: "เปลี่ยนถัง", refill: "เติมแก๊ส" };

function nextStep(order: OrderRecord) {
  if (order.status === "cancelled") return "คำสั่งซื้อนี้ถูกยกเลิกแล้ว หากมีข้อสงสัย กรุณาติดต่อร้านค้า";
  if (order.paymentStatus !== "paid" && order.paymentMethod === "qrScan") return "กรุณาแนบสลิปการชำระเงินในหน้าประวัติคำสั่งซื้อ แล้วรอผู้ดูแลตรวจสอบ";
  if (order.paymentMethod === "pendingPayment") return `มีเงินค้างชำระ ${Number(order.outstandingAmount ?? 0).toLocaleString("th-TH")} บาท กรุณาติดต่อร้านค้าเพื่อนัดหมายการชำระยอดคงเหลือ`;
  if (order.status === "pending") return "ร้านค้าได้รับคำสั่งซื้อแล้ว รอการยืนยันและเตรียมสินค้า";
  if (order.status === "preparing") return "ร้านค้ากำลังเตรียมสินค้าให้คุณ";
  if (order.status === "delivering") return "สินค้ากำลังจัดส่ง กรุณาเตรียมรับสินค้า";
  if (order.status === "delivered") return "จัดส่งสำเร็จแล้ว ขอบคุณที่ใช้บริการ";
  return "โปรดติดตามสถานะจากหน้านี้";
}

export default function CustomerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session?.access_token) { router.replace("/login"); return; }
      const response = await fetch(`/api/orders?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json() as ApiResult<OrderRecord>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setOrder(result.results);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดรายละเอียดคำสั่งซื้อได้"); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  return <Container component="main" maxWidth="sm" sx={{ py: 4, flexGrow: 1 }}>
    <Button component={Link} href="/productPage/orders" sx={{ mb: 2 }}>← กลับประวัติคำสั่งซื้อ</Button>
    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>รายละเอียดคำสั่งซื้อ</Typography>
    {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : order && <Stack spacing={2}>
      <Paper sx={{ p: 2.5 }}><Stack spacing={1}><Typography color="text.secondary">เลขที่คำสั่งซื้อ</Typography><Typography sx={{ fontWeight: 700, wordBreak: "break-all" }}>{order.id}</Typography><Typography color="text.secondary">สั่งเมื่อ {new Date(order.createdAt).toLocaleString("th-TH")}</Typography><Stack direction="row" spacing={1}><Chip color={order.status === "delivered" ? "success" : order.status === "cancelled" ? "error" : "primary"} label={ORDER_LABELS[order.status] ?? order.status} /><Chip label={PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus} /></Stack></Stack></Paper>
      <Alert severity={order.status === "cancelled" ? "error" : order.status === "delivered" ? "success" : "info"}><Typography sx={{ fontWeight: 700 }}>สิ่งที่ต้องทำต่อ</Typography>{nextStep(order)}</Alert>
      {Number(order.outstandingAmount ?? 0) > 0 && <Alert severity="warning"><Typography sx={{ fontWeight: 700 }}>ยอดค้างชำระ</Typography>เหลือชำระ {Number(order.outstandingAmount).toLocaleString("th-TH")} บาท</Alert>}
      <Paper sx={{ p: 2.5 }}><Typography variant="h6" sx={{ mb: 1 }}>รายการสินค้า</Typography>{(order.orderItems ?? []).map((item) => <Box key={item.id} sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 1 }}><Typography>{item.productNameSnapshot} · {SALE_LABELS[item.saleType] ?? item.saleType} × {item.quantity}</Typography><Typography>{Number(item.totalPrice).toLocaleString("th-TH")} บาท</Typography></Box>)}<Divider sx={{ my: 1 }} /><Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><Typography>ยอดรวม</Typography><Typography>{Number(order.totalAmount).toLocaleString("th-TH")} บาท</Typography></Box></Paper>
      <Paper sx={{ p: 2.5 }}><Typography variant="h6">จัดส่งไปที่</Typography><Typography>{order.deliveryAddress || "-"}</Typography>{order.note && <><Typography variant="h6" sx={{ mt: 2 }}>หมายเหตุ</Typography><Typography>{order.note}</Typography></>}</Paper>
      <Button variant="outlined" onClick={() => void loadOrder()}>รีเฟรชสถานะ</Button>
    </Stack>}
  </Container>;
}
