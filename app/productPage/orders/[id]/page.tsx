"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert, Box, Button, Chip, CircularProgress, Container, Divider, Paper, Stack, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import type { ORDERRECORD } from "@/app/models/order";
import type { DELIVERYTRACKING } from "@/app/models/delivery";

const DELIVERY_LABELS: Record<string, string> = { pending: "รอจัดส่ง", inTransit: "กำลังนำส่ง", delivered: "ส่งถึงแล้ว" };

// คืน null เมื่อยังไม่มีข้อมูลขนส่ง และ throw เมื่อดึงไม่สำเร็จ เพื่อให้ผู้เรียกแยกสองกรณีนี้ออกจากกันได้
async function fetchDeliveryTracking(orderId: string) {
  const { data } = await createClient().auth.getSession();
  if (!data.session?.access_token) return null;
  const response = await fetch(`/api/delivery?orderId=${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store",
  });
  const result = await response.json() as APIRESULT<DELIVERYTRACKING | null>;
  if (!response.ok || result.status === "error") throw new Error(result.message);
  return result.results;
}

// เวลาที่เหลือ = เวลาที่คนส่งคาดไว้ ลบเวลาที่ผ่านไปตั้งแต่ตั้งค่า (ไม่ต่ำกว่า 0)
function remainingMinutes(tracking: DELIVERYTRACKING, now: number) {
  if (tracking.estimatedMinutes === null || !tracking.etaSetAt) return null;
  const elapsed = Math.floor((now - new Date(tracking.etaSetAt).getTime()) / 60000);
  return Math.max(0, tracking.estimatedMinutes - Math.max(0, elapsed));
}

const ORDER_LABELS: Record<string, string> = { pending: "รอดำเนินการ", preparing: "กำลังเตรียมสินค้า", delivering: "กำลังจัดส่ง", delivered: "จัดส่งแล้ว", cancelled: "ยกเลิกแล้ว" };
const PAYMENT_LABELS: Record<string, string> = { pending: "รอชำระเงิน", paid: "ชำระเงินแล้ว", pendingPayment: "ค้างชำระ", pendingCart: "ค้างถัง" };
const SALE_LABELS: Record<string, string> = { sell: "ซื้อถัง", exchange: "เปลี่ยนถัง", refill: "เติมแก๊ส" };
const pendingOrderRequests = new Map<string, Promise<ORDERRECORD | null>>();

function fetchCustomerOrder(orderId: string) {
  const pendingRequest = pendingOrderRequests.get(orderId);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    const { data } = await createClient().auth.getSession();
    if (!data.session?.access_token) return null;
    const response = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const result = await response.json() as APIRESULT<ORDERRECORD>;
    if (!response.ok || result.status === "error") throw new Error(result.message);
    return result.results;
  })();

  pendingOrderRequests.set(orderId, request);
  void request.then(
    () => {
      if (pendingOrderRequests.get(orderId) === request) pendingOrderRequests.delete(orderId);
    },
    () => {
      if (pendingOrderRequests.get(orderId) === request) pendingOrderRequests.delete(orderId);
    },
  );
  return request;
}

function nextStep(order: ORDERRECORD) {
  if (order.status === "cancelled") return "คำสั่งซื้อนี้ถูกยกเลิกแล้ว หากมีข้อสงสัย กรุณาติดต่อร้านค้า";
  if (order.paymentStatus !== "paid" && order.paymentMethod === "qrScan") return "กรุณาแนบสลิปการชำระเงินในหน้าประวัติคำสั่งซื้อ แล้วรอผู้ดูแลตรวจสอบ";
  if (Number(order.outstandingAmount ?? 0) > 0) return `มีเงินค้างชำระ ${Number(order.outstandingAmount).toLocaleString("th-TH")} บาท กรุณาติดต่อร้านค้าเพื่อนัดหมายการชำระยอดคงเหลือ`;
  if (Number(order.outstandingCarts ?? 0) > 0) return `มีถังเปล่าค้างคืน ${Number(order.outstandingCarts).toLocaleString("th-TH")} ถัง กรุณานำถังเปล่ามาคืนร้านหรือแจ้งคนส่งมารับ`;
  if (order.status === "pending") return "ร้านค้าได้รับคำสั่งซื้อแล้ว รอการยืนยันและเตรียมสินค้า";
  if (order.status === "preparing") return "ร้านค้ากำลังเตรียมสินค้าให้คุณ";
  if (order.status === "delivering") return "สินค้ากำลังจัดส่ง กรุณาเตรียมรับสินค้า";
  if (order.status === "delivered") return "จัดส่งสำเร็จแล้ว ขอบคุณที่ใช้บริการ";
  return "โปรดติดตามสถานะจากหน้านี้";
}

export default function CustomerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<ORDERRECORD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<DELIVERYTRACKING | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // ใช้เวลาของเซิร์ฟเวอร์เป็นฐาน แล้วบวกเวลาที่ผ่านไปในเครื่อง กันนาฬิกาโทรศัพท์เดินเพี้ยน
  const applyTracking = useCallback((next: DELIVERYTRACKING | null) => {
    setTracking(next);
    setNow(next ? new Date(next.serverNow).getTime() : Date.now());
  }, []);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const result = await fetchCustomerOrder(id);
      if (!result) { router.replace("/login"); return; }
      setOrder(result);
      // ข้อมูลขนส่งเป็นส่วนเสริม ดึงไม่ได้ก็ยังต้องแสดงรายละเอียดออเดอร์ตามปกติ
      applyTracking(await fetchDeliveryTracking(id).catch(() => null));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดรายละเอียดคำสั่งซื้อได้"); }
    finally { setLoading(false); }
  }, [id, router, applyTracking]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  // ระหว่างที่ออเดอร์กำลังจัดส่ง ดึงทั้งออเดอร์และสถานะขนส่งใหม่ทุก 30 วินาที
  // เมื่อแอดมินยืนยัน "จัดส่งแล้ว" สถานะออเดอร์เปลี่ยน การดึงซ้ำจะหยุดเอง
  const isDelivering = order?.status === "delivering";
  useEffect(() => {
    if (!id || !isDelivering) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void (async () => {
        try {
          const [nextOrder, nextTracking] = await Promise.all([fetchCustomerOrder(id), fetchDeliveryTracking(id)]);
          if (nextOrder) setOrder(nextOrder);
          applyTracking(nextTracking);
        } catch {
          // เครือข่ายสะดุดชั่วคราว: คงข้อมูลเดิมไว้แล้วลองใหม่รอบหน้า
        }
      })();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [id, isDelivering, applyTracking]);

  const minutesLeft = tracking ? remainingMinutes(tracking, now) : null;

  return <Container component="main" maxWidth="sm" sx={{ py: 4, flexGrow: 1 }}>
    <Button component={Link} href="/productPage/orders" sx={{ mb: 2 }}>← กลับประวัติคำสั่งซื้อ</Button>
    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>รายละเอียดคำสั่งซื้อ</Typography>
    {loading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : order && <Stack spacing={2}>
      <Paper sx={{ p: 2.5 }}><Stack spacing={1}><Typography color="text.secondary">เลขที่คำสั่งซื้อ</Typography><Typography sx={{ fontWeight: 700, wordBreak: "break-all" }}>{order.id}</Typography><Typography color="text.secondary">สั่งเมื่อ {new Date(order.createdAt).toLocaleString("th-TH")}</Typography><Stack direction="row" spacing={1}><Chip color={order.status === "delivered" ? "success" : order.status === "cancelled" ? "error" : "primary"} label={ORDER_LABELS[order.status] ?? order.status} /><Chip label={PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus} /></Stack></Stack></Paper>
      <Alert severity={order.status === "cancelled" ? "error" : order.status === "delivered" ? "success" : "info"}><Typography sx={{ fontWeight: 700 }}>สิ่งที่ต้องทำต่อ</Typography>{nextStep(order)}</Alert>
      {order.promptPayQrUrl && <Paper sx={{ p: 2.5, textAlign: "center" }}><Typography variant="h6">สแกนจ่ายผ่านพร้อมเพย์</Typography><Box component="img" src={order.promptPayQrUrl} alt="QR พร้อมเพย์สำหรับออเดอร์นี้" sx={{ display: "block", width: "100%", maxWidth: 280, height: "auto", mx: "auto", my: 1 }} /><Typography sx={{ fontWeight: 700 }}>ยอด {Number(order.totalAmount).toLocaleString("th-TH")} บาท</Typography></Paper>}
      {tracking && order.status !== "cancelled" && <Paper sx={{ p: 2.5 }}><Stack spacing={1}><Typography variant="h6">สถานะการจัดส่ง</Typography><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Chip color={order.status === "delivered" || tracking.status === "delivered" ? "success" : tracking.status === "inTransit" ? "primary" : "default"} label={order.status === "delivered" ? "ส่งถึงแล้ว" : DELIVERY_LABELS[tracking.status] ?? tracking.status} />{tracking.driverName && <Typography variant="body2">คนส่ง: {tracking.driverName}</Typography>}</Stack>{order.status === "delivering" && tracking.status === "inTransit" && (minutesLeft !== null ? <Typography sx={{ fontWeight: 700 }}>{minutesLeft > 0 ? `จะถึงในอีกประมาณ ${minutesLeft} นาที` : "คนส่งใกล้ถึงแล้ว"}</Typography> : <Typography color="text.secondary">คนส่งกำลังนำสินค้าไปหาคุณ</Typography>)}{order.status === "delivering" && <Typography variant="caption" color="text.secondary">หน้านี้อัปเดตเวลาให้อัตโนมัติทุก 30 วินาที</Typography>}</Stack></Paper>}
      {Number(order.outstandingAmount ?? 0) > 0 && <Alert severity="warning"><Typography sx={{ fontWeight: 700 }}>ยอดค้างชำระ</Typography>เหลือชำระ {Number(order.outstandingAmount).toLocaleString("th-TH")} บาท</Alert>}
      {Number(order.outstandingCarts ?? 0) > 0 && <Alert severity="warning"><Typography sx={{ fontWeight: 700 }}>ถังค้างคืน</Typography>เหลือคืน {Number(order.outstandingCarts).toLocaleString("th-TH")} ถัง</Alert>}
      <Paper sx={{ p: 2.5 }}><Typography variant="h6" sx={{ mb: 1 }}>รายการสินค้า</Typography>{(order.orderItems ?? []).map((item) => <Box key={item.id} sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 1 }}><Typography>{item.productNameSnapshot} · {SALE_LABELS[item.saleType] ?? item.saleType} × {item.quantity}</Typography><Typography>{Number(item.totalPrice).toLocaleString("th-TH")} บาท</Typography></Box>)}<Divider sx={{ my: 1 }} /><Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><Typography>ยอดรวม</Typography><Typography>{Number(order.totalAmount).toLocaleString("th-TH")} บาท</Typography></Box></Paper>
      <Paper sx={{ p: 2.5 }}><Typography variant="h6">จัดส่งไปที่</Typography><Typography>{order.deliveryAddress || "-"}</Typography>{order.note && <><Typography variant="h6" sx={{ mt: 2 }}>หมายเหตุ</Typography><Typography>{order.note}</Typography></>}</Paper>
      <Button variant="outlined" onClick={() => void loadOrder()}>รีเฟรชสถานะ</Button>
    </Stack>}
  </Container>;
}
