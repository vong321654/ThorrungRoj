"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";
import { ADMINROLE } from "@/app/models/admin";
import { MANUALSLIPOUTCOME } from "@/app/enums/order";
import { compressImage, UPLOAD_IMAGE_TYPES } from "@/app/util/compressImage";
import { useRequireAdmin, MANAGER_ONLY } from "../../useRequireAdmin";

type Slip = {
  id: string;
  slipImageUrl: string;
  status: string;
  rejectReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

type OrderPaymentView = {
  order: {
    id: string;
    totalAmount: number | string;
    paymentMethod: string | null;
    paymentStatus: string;
    status: string;
    users: { name: string; phone: string | null; shopName: string | null } | null;
    debtRecords: Array<{ id: string; debtType: string; status: string }>;
  };
  payment: {
    id: string;
    amount: number | string;
    status: string;
    verifiedAt: string | null;
    transferSlips: Slip[];
  } | null;
};

type ManualSlipResult = { slipId: string; debtsCreated: number; warning: string | null };

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "เงินสด",
  qrScan: "สแกน QR",
  pendingPayment: "ค้างชำระ",
  pendingCart: "ค้างถัง",
  pendingBoth: "ค้างทั้งถังและเงิน",
};

const OUTCOME_OPTIONS: Array<{ value: MANUALSLIPOUTCOME; label: string; hint: string }> = [
  { value: MANUALSLIPOUTCOME.PAID, label: "จ่ายครบแล้ว", hint: "ได้รับเงินเต็มยอด" },
  { value: MANUALSLIPOUTCOME.PENDING_PAYMENT, label: "ค้างเงิน", hint: "ได้รับเงินบางส่วน ส่วนที่เหลือบันทึกเป็นหนี้เงิน" },
  { value: MANUALSLIPOUTCOME.PENDING_CART, label: "ค้างถัง", hint: "จ่ายเงินครบ แต่ยังไม่คืนถังเปล่า" },
  { value: MANUALSLIPOUTCOME.PENDING_BOTH, label: "ค้างทั้งถังและเงิน", hint: "ได้รับเงินบางส่วนและยังไม่คืนถังเปล่า" },
];

const PARTIAL_OUTCOMES = new Set([MANUALSLIPOUTCOME.PENDING_PAYMENT, MANUALSLIPOUTCOME.PENDING_BOTH]);
const CART_OUTCOMES = new Set([MANUALSLIPOUTCOME.PENDING_CART, MANUALSLIPOUTCOME.PENDING_BOTH]);

function formatBaht(value: number | string) {
  return `${Number(value).toLocaleString("th-TH")} บาท`;
}

function slipStatusLabel(status: string) {
  return status === "verified" ? "ยืนยันแล้ว" : status === "rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ";
}

// สลิปที่ superAdmin อัปโหลดแทนลูกค้ามีชื่อไฟล์ขึ้นต้นด้วย admin- (ดู recordManualSlipPayment)
function isShopUploaded(slip: Slip) {
  return /\/admin-[^/]+$/.test(slip.slipImageUrl);
}

export default function AdminOrderPaymentPage() {
  const params = useParams<{ id: string }>();
  const { admin, isAllowed } = useRequireAdmin(MANAGER_ONLY);
  const isSuperAdmin = admin?.role === ADMINROLE.SUPER_ADMIN;
  const [view, setView] = useState<OrderPaymentView | null>(null);
  const [slipUrls, setSlipUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingSlipId, setVerifyingSlipId] = useState<string | null>(null);
  const [rejectingSlipId, setRejectingSlipId] = useState<string | null>(null);
  const [partialSlipId, setPartialSlipId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [note, setNote] = useState("");
  // ฟอร์มอัปโหลดสลิปแทนลูกค้า (superAdmin)
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualPreview, setManualPreview] = useState<string | null>(null);
  const [manualOutcome, setManualOutcome] = useState<MANUALSLIPOUTCOME>(MANUALSLIPOUTCOME.PAID);
  const [manualAmount, setManualAmount] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  const payment = view?.payment ?? null;
  const order = view?.order ?? null;

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
        cache: "no-store",
      });
      const result = await response.json() as APIRESULT<OrderPaymentView>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setView(result.results);

      const urls = await Promise.all((result.results.payment?.transferSlips ?? []).map(async (slip) => {
        const imageResponse = await fetch(`/api/images?type=receipt&slipId=${encodeURIComponent(slip.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const imageResult = await imageResponse.json() as APIRESULT<{ url: string }>;
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

  // คืนหน่วยความจำของรูปตัวอย่างเมื่อเปลี่ยนรูปหรือออกจากหน้า
  useEffect(() => () => {
    if (manualPreview) URL.revokeObjectURL(manualPreview);
  }, [manualPreview]);

  async function verifySlip(slipId: string) {
    if (!payment || !window.confirm("ยืนยันว่าได้รับเงินตามสลิปนี้แล้วใช่หรือไม่?")) return;
    setVerifyingSlipId(slipId);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: payment.id, slipId }),
      });
      const result = await response.json() as APIRESULT<unknown>;
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
    setNotice(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: payment.id, slipId, action, ...extra }),
      });
      const result = await response.json() as APIRESULT<unknown>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setRejectingSlipId(null); setPartialSlipId(null); setReason(""); setPartialAmount(""); setNote("");
      await loadPayment();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ไม่สามารถอัปเดตการชำระเงินได้");
    } finally { setVerifyingSlipId(null); }
  }

  async function deleteSlip(slipId: string) {
    if (!payment || !window.confirm("ลบสลิปนี้และไฟล์รูปออกถาวรใช่หรือไม่?")) return;
    setVerifyingSlipId(slipId); setError(null); setNotice(null);
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/payments?paymentId=${encodeURIComponent(payment.id)}&slipId=${encodeURIComponent(slipId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json() as APIRESULT<unknown>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      await loadPayment();
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "ไม่สามารถลบสลิปได้"); }
    finally { setVerifyingSlipId(null); }
  }

  function chooseManualFile(file: File | undefined) {
    setManualFile(file ?? null);
    setManualPreview(file ? URL.createObjectURL(file) : null);
  }

  function resetManualForm() {
    chooseManualFile(undefined);
    setManualOutcome(MANUALSLIPOUTCOME.PAID);
    setManualAmount("");
    setManualNote("");
  }

  const isPartialOutcome = PARTIAL_OUTCOMES.has(manualOutcome);
  const orderTotal = order ? Number(order.totalAmount) : 0;
  const manualAmountValue = Number(manualAmount);
  const isManualAmountValid = !isPartialOutcome ||
    // ทศนิยมไม่เกิน 2 ตำแหน่ง ให้ตรงกับที่ API ตรวจ
    (/^\d+(\.\d{1,2})?$/.test(manualAmount.trim()) && manualAmountValue > 0 && manualAmountValue < orderTotal);

  async function saveManualSlip() {
    if (!order || !manualFile || !isManualAmountValid) return;
    const outcomeLabel = OUTCOME_OPTIONS.find((option) => option.value === manualOutcome)?.label ?? manualOutcome;
    const summary = isPartialOutcome
      ? `บันทึกว่า "${outcomeLabel}" ได้รับเงิน ${formatBaht(manualAmountValue)} จากยอด ${formatBaht(orderTotal)} ใช่หรือไม่?`
      : `บันทึกว่า "${outcomeLabel}" ได้รับเงินเต็มยอด ${formatBaht(orderTotal)} ใช่หรือไม่?`;
    if (!window.confirm(summary)) return;

    setIsSavingManual(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("orderId", order.id);
      form.set("outcome", manualOutcome);
      form.set("file", await compressImage(manualFile));
      if (isPartialOutcome) form.set("amount", manualAmount.trim());
      if (isPartialOutcome && manualNote.trim()) form.set("note", manualNote.trim());
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${await getToken()}` },
        body: form,
      });
      const result = await response.json() as APIRESULT<ManualSlipResult>;
      // 409 = สถานะออเดอร์เปลี่ยนไปแล้ว (เช่น มีคนบันทึกรับเงินไปก่อน) โหลดใหม่ให้ฟอร์มหายไปตามสถานะจริง
      if (response.status === 409) await loadPayment();
      if (!response.ok || result.status === "error") throw new Error(result.message);
      const savedOutcome = manualOutcome;
      resetManualForm();
      // โหลดใหม่ก่อน เพราะ loadPayment ล้างข้อความ error ทิ้ง คำเตือนจะไม่ขึ้น
      await loadPayment();
      // ค้างเงิน: ฟังก์ชันใน DB สร้างหนี้เงินให้ทันที / ค้างถังของออเดอร์ที่ยังไม่ส่ง: บันทึกหนี้ถังตอนจัดส่งแล้ว
      const debtText = result.results.debtsCreated > 0 || PARTIAL_OUTCOMES.has(savedOutcome)
        ? " และบันทึกหนี้ให้แล้ว ดูได้ที่หน้าหนี้ค้าง"
        : "";
      const cartLaterText = CART_OUTCOMES.has(savedOutcome) && result.results.debtsCreated === 0 && order.status !== "delivered"
        ? " (หนี้ถังจะบันทึกให้อัตโนมัติเมื่อเปลี่ยนสถานะเป็นจัดส่งแล้ว)"
        : "";
      setNotice(`บันทึกสลิปและการชำระเรียบร้อย${debtText}${cartLaterText}`);
      if (result.results.warning) setError(result.results.warning);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกสลิปไม่สำเร็จ");
    } finally {
      setIsSavingManual(false);
    }
  }

  const isPaid = order?.paymentStatus === "paid" || payment?.status === "paid";
  const hasDebts = (order?.debtRecords.length ?? 0) > 0;
  const canManualUpload = isSuperAdmin && !!order && order.status !== "cancelled" && !isPaid && !hasDebts;
  const slips = payment?.transferSlips ?? [];

  return <Box sx={{ maxWidth: 1000, mx: "auto", p: { xs: 2, md: 4 } }}>
    <Button component={Link} href="/admin/orders" sx={{ mb: 2 }}>← กลับไปรายการคำสั่งซื้อ</Button>
    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>การชำระเงินของคำสั่งซื้อ</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    {isLoading ? <CircularProgress /> : order && <Stack spacing={2}>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6">ข้อมูลการชำระเงิน</Typography>
        <Typography>ลูกค้า: {order.users?.shopName || order.users?.name || "-"}</Typography>
        <Typography>ยอดออเดอร์: {formatBaht(order.totalAmount)}</Typography>
        {payment && Number(payment.amount) !== orderTotal && <Typography>ยอดที่รับจากสลิป: {formatBaht(payment.amount)}</Typography>}
        <Typography>วิธีชำระ: {PAYMENT_METHOD_LABELS[order.paymentMethod ?? ""] ?? "-"}</Typography>
        <Typography>สถานะ: {order.paymentStatus === "paid" ? "รับชำระแล้ว" : isPaid ? "รับชำระบางส่วน ส่วนที่เหลือเป็นหนี้เงิน" : order.status === "cancelled" ? "ออเดอร์ถูกยกเลิก" : "รอชำระ / รอตรวจสอบ"}</Typography>
        {payment?.verifiedAt && <Typography color="text.secondary">ยืนยันเมื่อ: {new Date(payment.verifiedAt).toLocaleString("th-TH")}</Typography>}
        {hasDebts && <Typography color="warning.main">มีรายการหนี้ของออเดอร์นี้ ดูได้ที่หน้าหนี้ค้าง</Typography>}
      </Paper>

      {canManualUpload && <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6">อัปโหลดสลิปแทนลูกค้า</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>ใช้เมื่อลูกค้าส่งสลิปมาในแชท LINE ของร้าน ระบบจะบันทึกผลทันทีโดยไม่ต้องกดยืนยันอีกรอบ</Typography>
        <Stack spacing={2}>
          <Box>
            <Button variant="outlined" component="label" disabled={isSavingManual}>
              {manualFile ? "เปลี่ยนรูปสลิป" : "เลือกรูปสลิป"}
              <input hidden type="file" accept={UPLOAD_IMAGE_TYPES.join(",")} onChange={(event) => { chooseManualFile(event.target.files?.[0]); event.target.value = ""; }} />
            </Button>
            {manualFile && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{manualFile.name}</Typography>}
          </Box>
          {manualPreview && <Box component="img" src={manualPreview} alt="ตัวอย่างสลิป" sx={{ width: "100%", maxWidth: 360, maxHeight: 480, objectFit: "contain", borderRadius: 1, border: 1, borderColor: "divider" }} />}
          <RadioGroup value={manualOutcome} onChange={(event) => setManualOutcome(event.target.value as MANUALSLIPOUTCOME)}>
            {OUTCOME_OPTIONS.map((option) => <FormControlLabel key={option.value} value={option.value} disabled={isSavingManual} control={<Radio />} label={<Box><Typography>{option.label}</Typography><Typography variant="body2" color="text.secondary">{option.hint}</Typography></Box>} sx={{ mb: 0.5 }} />)}
          </RadioGroup>
          {isPartialOutcome && <>
            <TextField type="number" label="ยอดที่ได้รับจริง (บาท)" value={manualAmount} disabled={isSavingManual}
              onChange={(event) => setManualAmount(event.target.value)}
              error={manualAmount.trim() !== "" && !isManualAmountValid}
              helperText={`ต้องมากกว่า 0 และน้อยกว่า ${formatBaht(orderTotal)} ส่วนที่เหลือจะบันทึกเป็นหนี้เงิน`}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} sx={{ maxWidth: 320 }} />
            <TextField label="หมายเหตุหนี้ (ไม่บังคับ)" value={manualNote} disabled={isSavingManual}
              onChange={(event) => setManualNote(event.target.value)} multiline minRows={2}
              slotProps={{ htmlInput: { maxLength: 500 } }} />
          </>}
          <Box>
            <Button variant="contained" disabled={!manualFile || !isManualAmountValid || isSavingManual} onClick={() => void saveManualSlip()}>
              {isSavingManual ? "กำลังบันทึก..." : "บันทึกสลิปและการชำระ"}
            </Button>
          </Box>
        </Stack>
      </Paper>}
      {isSuperAdmin && !isPaid && hasDebts && order.status !== "cancelled" && <Alert severity="info">ออเดอร์นี้มีรายการหนี้แล้ว ถ้าลูกค้าโอนมาชำระ ให้บันทึกรับชำระที่หน้าหนี้ค้าง</Alert>}

      <Typography variant="h6">สลิปที่ส่งมา ({slips.length})</Typography>
      {slips.length === 0 ? <Alert severity="info">ยังไม่มีสลิปของออเดอร์นี้</Alert> : payment && slips.map((slip) => <Card key={slip.id} variant="outlined"><CardContent><Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography>ส่งเมื่อ {new Date(slip.createdAt).toLocaleString("th-TH")}</Typography>
          {isShopUploaded(slip) && <Chip size="small" label="ร้านอัปโหลดแทนลูกค้า" />}
        </Stack>
        <Typography>สถานะสลิป: {slipStatusLabel(slip.status)}{slip.status === "rejected" && slip.rejectReason ? ` (${slip.rejectReason})` : ""}</Typography>
        {slipUrls[slip.id] ? <Box component="img" src={slipUrls[slip.id]} alt="สลิปการโอนเงิน" sx={{ width: "100%", maxWidth: 560, maxHeight: 720, objectFit: "contain", borderRadius: 1, border: 1, borderColor: "divider" }} /> : <Typography color="text.secondary">ไม่สามารถโหลดรูปสลิปได้</Typography>}
        <Divider />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>{slip.status === "pending" && payment.status !== "paid" && order.status !== "cancelled" && <><Button variant="contained" color="success" disabled={verifyingSlipId !== null} onClick={() => void verifySlip(slip.id)}>{verifyingSlipId === slip.id ? "กำลังยืนยัน..." : "ยืนยันการชำระเงิน"}</Button><Button variant="outlined" color="warning" disabled={verifyingSlipId !== null} onClick={() => setPartialSlipId(slip.id)}>ชำระบางส่วน</Button><Button variant="outlined" color="error" disabled={verifyingSlipId !== null} onClick={() => setRejectingSlipId(slip.id)}>ไม่ผ่านการตรวจสอบ</Button></>}<Button variant="text" color="error" disabled={slip.status === "verified" || verifyingSlipId !== null} onClick={() => void deleteSlip(slip.id)}>ลบสลิป</Button></Stack>
      </Stack></CardContent></Card>)}</Stack>}
    <Dialog open={!!rejectingSlipId} onClose={() => !verifyingSlipId && setRejectingSlipId(null)} fullWidth maxWidth="xs"><DialogTitle>ไม่ผ่านการตรวจสอบสลิป</DialogTitle><DialogContent><TextField autoFocus fullWidth sx={{ mt: 1 }} label="เหตุผล" value={reason} onChange={(event) => setReason(event.target.value)} required multiline minRows={2} /></DialogContent><DialogActions><Button onClick={() => setRejectingSlipId(null)}>ยกเลิก</Button><Button color="error" variant="contained" disabled={!reason.trim() || !!verifyingSlipId} onClick={() => rejectingSlipId && void updatePayment("reject", rejectingSlipId, { reason })}>บันทึกว่าไม่ผ่าน</Button></DialogActions></Dialog>
    <Dialog open={!!partialSlipId} onClose={() => !verifyingSlipId && setPartialSlipId(null)} fullWidth maxWidth="xs"><DialogTitle>บันทึกชำระบางส่วน</DialogTitle><DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>ยอดสั่งซื้อ {order ? formatBaht(order.totalAmount) : "-"} ระบบจะสร้างหนี้จากยอดที่เหลือ</Typography><TextField autoFocus fullWidth type="number" slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} label="ยอดที่รับชำระจริง" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} required /><TextField fullWidth sx={{ mt: 2 }} label="หมายเหตุ" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={2} /></DialogContent><DialogActions><Button onClick={() => setPartialSlipId(null)}>ยกเลิก</Button><Button color="warning" variant="contained" disabled={!partialAmount || !!verifyingSlipId} onClick={() => partialSlipId && void updatePayment("partial", partialSlipId, { amount: Number(partialAmount), note })}>ยืนยันและสร้างหนี้</Button></DialogActions></Dialog>
  </Box>;
}
