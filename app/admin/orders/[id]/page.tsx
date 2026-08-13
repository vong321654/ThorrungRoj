"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { ApiResult } from "@/app/api/response";
import { useRequireAdmin } from "../../useRequireAdmin";

type Slip = {
  id: string;
  slipImageUrl: string;
  status: string;
  rejectReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

type QrPayment = {
  id: string;
  amount: number | string;
  status: string;
  verifiedAt: string | null;
  orders: { totalAmount: number | string; paymentStatus: string; status: string; users: { name: string; phone: string | null; shopName: string | null } | null } | null;
  transferSlips: Slip[];
};

export default function AdminOrderPaymentPage() {
  const params = useParams<{ id: string }>();
  const { isAllowed } = useRequireAdmin();
  const [payment, setPayment] = useState<QrPayment | null>(null);
  const [slipUrls, setSlipUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingSlipId, setVerifyingSlipId] = useState<string | null>(null);
  const [rejectingSlipId, setRejectingSlipId] = useState<string | null>(null);
  const [partialSlipId, setPartialSlipId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [note, setNote] = useState("");

  const getToken = useCallback(async () => {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const loadPayment = useCallback(async () => {
    if (!params.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/payments?orderId=${encodeURIComponent(params.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as ApiResult<QrPayment>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setPayment(result.results);

      const urls = await Promise.all(result.results.transferSlips.map(async (slip) => {
        const imageResponse = await fetch(`/api/images?type=receipt&slipId=${encodeURIComponent(slip.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const imageResult = await imageResponse.json() as ApiResult<{ url: string }>;
        return imageResponse.ok && imageResult.status === "success" ? [slip.id, imageResult.results.url] as const : null;
      }));
      setSlipUrls(Object.fromEntries(urls.filter((item): item is readonly [string, string] => item !== null)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดข้อมูลการชำระเงินได้");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, params.id]);

  useEffect(() => {
    if (isAllowed) void loadPayment();
  }, [isAllowed, loadPayment]);

  async function verifySlip(slipId: string) {
    if (!payment || !window.confirm("ยืนยันว่าได้รับเงินตามสลิปนี้แล้วใช่หรือไม่?")) return;
    setVerifyingSlipId(slipId);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: payment.id, slipId }),
      });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      await loadPayment();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "ไม่สามารถยืนยันการชำระเงินได้");
    } finally {
      setVerifyingSlipId(null);
    }
  }

  async function updatePayment(action: "reject" | "partial", slipId: string, extra: Record<string, unknown>) {
    if (!payment) return;
    setVerifyingSlipId(slipId);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: payment.id, slipId, action, ...extra }),
      });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setRejectingSlipId(null); setPartialSlipId(null); setReason(""); setPartialAmount(""); setNote("");
      await loadPayment();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ไม่สามารถอัปเดตการชำระเงินได้");
    } finally { setVerifyingSlipId(null); }
  }

  async function deleteSlip(slipId: string) {
    if (!payment || !window.confirm("ลบสลิปนี้และไฟล์รูปออกถาวรใช่หรือไม่?")) return;
    setVerifyingSlipId(slipId); setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/payments?paymentId=${encodeURIComponent(payment.id)}&slipId=${encodeURIComponent(slipId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      await loadPayment();
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "ไม่สามารถลบสลิปได้"); }
    finally { setVerifyingSlipId(null); }
  }

  return <Box sx={{ maxWidth: 1000, mx: "auto", p: { xs: 2, md: 4 } }}>
    <Button component={Link} href="/admin/orders" sx={{ mb: 2 }}>← กลับไปรายการคำสั่งซื้อ</Button>
    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>ตรวจสอบการชำระเงิน QR</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {isLoading ? <CircularProgress /> : payment && <Stack spacing={2}>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6">ข้อมูลการชำระเงิน</Typography>
        <Typography>ลูกค้า: {payment.orders?.users?.shopName || payment.orders?.users?.name || "-"}</Typography>
        <Typography>ยอดชำระ: {Number(payment.amount).toLocaleString("th-TH")} บาท</Typography>
        <Typography>สถานะ: {payment.status === "paid" ? "ยืนยันแล้ว" : "รอตรวจสอบ"}</Typography>
        {payment.verifiedAt && <Typography color="text.secondary">ยืนยันเมื่อ: {new Date(payment.verifiedAt).toLocaleString("th-TH")}</Typography>}
      </Paper>
      <Typography variant="h6">สลิปที่ส่งมา ({payment.transferSlips.length})</Typography>
      {payment.transferSlips.length === 0 ? <Alert severity="info">ลูกค้ายังไม่ได้อัปโหลดสลิป</Alert> : payment.transferSlips.map((slip) => <Card key={slip.id} variant="outlined"><CardContent><Stack spacing={1.5}>
        <Typography>ส่งเมื่อ {new Date(slip.createdAt).toLocaleString("th-TH")}</Typography>
        <Typography>สถานะสลิป: {slip.status === "verified" ? "ยืนยันแล้ว" : slip.status === "rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ"}</Typography>
        {slipUrls[slip.id] ? <Box component="img" src={slipUrls[slip.id]} alt="สลิปการโอนเงิน" sx={{ width: "100%", maxWidth: 560, maxHeight: 720, objectFit: "contain", borderRadius: 1, border: 1, borderColor: "divider" }} /> : <Typography color="text.secondary">ไม่สามารถโหลดรูปสลิปได้</Typography>}
        <Divider />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>{slip.status === "pending" && payment.status !== "paid" && <><Button variant="contained" color="success" disabled={verifyingSlipId !== null} onClick={() => void verifySlip(slip.id)}>{verifyingSlipId === slip.id ? "กำลังยืนยัน..." : "ยืนยันการชำระเงิน"}</Button><Button variant="outlined" color="warning" disabled={verifyingSlipId !== null} onClick={() => setPartialSlipId(slip.id)}>ชำระบางส่วน</Button><Button variant="outlined" color="error" disabled={verifyingSlipId !== null} onClick={() => setRejectingSlipId(slip.id)}>ไม่ผ่านการตรวจสอบ</Button></>}<Button variant="text" color="error" disabled={slip.status === "verified" || verifyingSlipId !== null} onClick={() => void deleteSlip(slip.id)}>ลบสลิป</Button></Stack>
      </Stack></CardContent></Card>)}</Stack>}
    <Dialog open={!!rejectingSlipId} onClose={() => !verifyingSlipId && setRejectingSlipId(null)} fullWidth maxWidth="xs"><DialogTitle>ไม่ผ่านการตรวจสอบสลิป</DialogTitle><DialogContent><TextField autoFocus fullWidth sx={{ mt: 1 }} label="เหตุผล" value={reason} onChange={(event) => setReason(event.target.value)} required multiline minRows={2} /></DialogContent><DialogActions><Button onClick={() => setRejectingSlipId(null)}>ยกเลิก</Button><Button color="error" variant="contained" disabled={!reason.trim() || !!verifyingSlipId} onClick={() => rejectingSlipId && void updatePayment("reject", rejectingSlipId, { reason })}>บันทึกว่าไม่ผ่าน</Button></DialogActions></Dialog>
    <Dialog open={!!partialSlipId} onClose={() => !verifyingSlipId && setPartialSlipId(null)} fullWidth maxWidth="xs"><DialogTitle>บันทึกชำระบางส่วน</DialogTitle><DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>ยอดสั่งซื้อ {payment ? Number(payment.amount).toLocaleString("th-TH") : "-"} บาท ระบบจะสร้างหนี้จากยอดที่เหลือ</Typography><TextField autoFocus fullWidth type="number" slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} label="ยอดที่รับชำระจริง" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} required /><TextField fullWidth sx={{ mt: 2 }} label="หมายเหตุ" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={2} /></DialogContent><DialogActions><Button onClick={() => setPartialSlipId(null)}>ยกเลิก</Button><Button color="warning" variant="contained" disabled={!partialAmount || !!verifyingSlipId} onClick={() => partialSlipId && void updatePayment("partial", partialSlipId, { amount: Number(partialAmount), note })}>ยืนยันและสร้างหนี้</Button></DialogActions></Dialog>
  </Box>;
}
